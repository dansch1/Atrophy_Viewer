import * as dicomParser from "dicom-parser";
import type { Pt } from "./vec2";

export type DicomLaterality = "L" | "R";

export type PixelSpacing = {
	row: number;
	col: number;
};

export type SlicePosition = {
	p0: Pt;
	p1: Pt;
};

type DicomDataBase = {
	id: string;
	source: "dicom";
	file: File;
	patientID: string;
	patientName?: string;
	studyInstanceUID: string;
	laterality: DicomLaterality;
	acquisitionDate: Date;
	rows: number;
	cols: number;
};

export type FundusData = DicomDataBase & {
	type: "fundus";
	image: ImageData;
};

export type BscanData = DicomDataBase & {
	type: "oct_bscan";
	image: ImageData;
};

export type VolumeData = DicomDataBase & {
	type: "oct_volume";
	frames: number;
	images: ImageData[];
	slicePositions: SlicePosition[];
	pixelSpacing: PixelSpacing;
};

export type DicomData = FundusData | BscanData | VolumeData;

const UID_OCT = "1.2.840.10008.5.1.4.1.1.77.1.5.4";
const UID_FUNDUS = "1.2.840.10008.5.1.4.1.1.77.1.5.1";

export async function getDicomData(file: File): Promise<DicomData> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const sopInstanceUID = dataSet.string("x00080018");

	const patientID = dataSet.string("x00100020");
	const patientName = dataSet.string("x00100010")?.replace("^", ", ").trim();

	const sopClassUID = dataSet.string("x00080016");
	const studyInstanceUID = dataSet.string("x0020000d");

	const laterality = dataSet.string("x00200062")?.toUpperCase();
	const acquisitionDate = readAcquisitionDate(dataSet);

	const rows = dataSet.uint16("x00280010");
	const cols = dataSet.uint16("x00280011");
	const frames = dataSet.intString("x00280008") ?? 1;

	const bitsAllocated = dataSet.uint16("x00280100");
	const pixelDataElement = dataSet.elements.x7fe00010;

	if (
		!sopInstanceUID ||
		!sopClassUID ||
		!patientID ||
		!studyInstanceUID ||
		!laterality ||
		!acquisitionDate ||
		!rows ||
		!cols ||
		!pixelDataElement
	) {
		throw new Error(`Missing required data in file: ${file.name}`);
	}

	if (laterality !== "L" && laterality !== "R") {
		throw new Error(`Unsupported laterality in file: ${file.name}`);
	}

	const base: DicomDataBase = {
		id: sopInstanceUID,
		source: "dicom",
		file,
		patientID,
		patientName,
		studyInstanceUID,
		laterality,
		acquisitionDate,
		rows,
		cols,
	};

	const pixelData =
		bitsAllocated === 16
			? new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2)
			: new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

	if (sopClassUID === UID_FUNDUS) {
		return {
			...base,
			type: "fundus",
			image: normalizeDicom(pixelData, cols, rows),
		};
	}

	if (sopClassUID === UID_OCT) {
		if (frames === 1) {
			return {
				...base,
				type: "oct_bscan",
				image: normalizeDicom(pixelData, cols, rows),
			};
		}

		const images = Array.from({ length: frames }, (_, frame) =>
			normalizeDicom(pixelsForFrame(pixelData, frame, rows, cols), cols, rows),
		);

		const slicePositions = readSlicePositions(dataSet);
		const pixelSpacing = readPixelSpacing(dataSet);

		if (!slicePositions || images.length !== slicePositions.length || !pixelSpacing) {
			throw new Error(`Inconsistent data in OCT volume: ${file.name}`);
		}

		return {
			...base,
			type: "oct_volume",
			frames,
			images,
			slicePositions,
			pixelSpacing,
		};
	}

	throw new Error(`DICOM file could not be classified: ${file.name}`);
}

function readAcquisitionDate(dataSet: dicomParser.DataSet): Date | undefined {
	const value = dataSet.string("x00080022") ?? dataSet.string("x0008002a")?.slice(0, 8);
	if (!value || !/^\d{8}$/.test(value)) {
		return undefined;
	}

	return new Date(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8));
}

function pixelsForFrame(pixelData: Uint8Array | Uint16Array, frame: number, rows: number, cols: number) {
	const size = rows * cols;
	const start = frame * size;
	return pixelData.subarray(start, start + size);
}

function normalizeDicom(pixelData: Uint8Array | Uint16Array, cols: number, rows: number): ImageData {
	const imageData = new ImageData(cols, rows);

	let min = Infinity;
	let max = -Infinity;
	for (let i = 0; i < pixelData.length; i++) {
		min = Math.min(min, pixelData[i]);
		max = Math.max(max, pixelData[i]);
	}

	const range = max - min || 1;
	for (let i = 0; i < pixelData.length; i++) {
		const value = ((pixelData[i] - min) / range) * 255;
		const offset = i * 4;

		imageData.data[offset] = value;
		imageData.data[offset + 1] = value;
		imageData.data[offset + 2] = value;
		imageData.data[offset + 3] = 255;
	}

	return imageData;
}

function readSlicePositions(dataSet: dicomParser.DataSet): SlicePosition[] | undefined {
	const slicePositions: SlicePosition[] = [];

	// PerFrameFunctionalGroupsSequence (5200,9230)
	const perFrame = dataSet.elements.x52009230;
	if (!perFrame || !perFrame.items || perFrame.items.length === 0) {
		return undefined;
	}

	for (const it of perFrame.items) {
		const frameDs = it?.dataSet;
		if (!frameDs) {
			continue;
		}

		// OphthalmicFrameLocationSequence (0022,0031)
		const frameLoc = frameDs.elements.x00220031;
		if (!frameLoc || !frameLoc.items || frameLoc.items.length === 0) {
			continue;
		}

		const locItemDs = frameLoc.items[0]?.dataSet;
		if (!locItemDs) continue;

		// Frame Location (0022,0032)
		const row0 = locItemDs.float("x00220032", 0) ?? NaN;
		const col0 = locItemDs.float("x00220032", 1) ?? NaN;
		const row1 = locItemDs.float("x00220032", 2) ?? NaN;
		const col1 = locItemDs.float("x00220032", 3) ?? NaN;

		// Skip incomplete frames
		if (!Number.isFinite(row0) || !Number.isFinite(col0) || !Number.isFinite(row1) || !Number.isFinite(col1)) {
			continue;
		}

		slicePositions.push({
			p0: { x: col0, y: row0 },
			p1: { x: col1, y: row1 },
		});
	}

	return slicePositions.length > 0 ? slicePositions : undefined;
}

function readPixelSpacing(dataSet: dicomParser.DataSet): PixelSpacing | undefined {
	// SharedFunctionalGroupsSequence (5200,9229)
	const sharedFg = dataSet.elements.x52009229;
	if (!sharedFg || !sharedFg.items || sharedFg.items.length === 0) {
		return undefined;
	}

	const sharedItem = sharedFg.items[0];
	if (!sharedItem?.dataSet) {
		return undefined;
	}

	// PixelMeasuresSequence (0028,9110)
	const pixelMeasures = sharedItem.dataSet.elements.x00289110;
	if (!pixelMeasures || !pixelMeasures.items || pixelMeasures.items.length === 0) {
		return undefined;
	}

	const pmItem = pixelMeasures.items[0];
	if (!pmItem?.dataSet) {
		return undefined;
	}

	// PixelSpacing (0028,0030)
	const ps = pmItem.dataSet.string("x00280030");
	if (!ps) {
		return undefined;
	}

	const [row, col] = ps.split("\\").map(Number);
	return { row, col }; // mm / px
}

