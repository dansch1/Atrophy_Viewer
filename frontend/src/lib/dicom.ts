import type { Laterality } from "@/hooks/viewer/viewerTypes";
import * as dicomParser from "dicom-parser";
import type { Pt } from "./vec2";

export type PixelSpacing = { row: number; col: number }; // in mm

type DicomDataBase = {
	file: File;
	patientID: string;
	studyInstanceUID: string;
	sopInstanceUID: string;
	patientName?: string;
	laterality: Laterality;
	acquisitionDate: Date;
	rows: number;
	cols: number;
	frames: number;
};

export type SlicePosition = {
	p0: Pt;
	p1: Pt;
};

export type VolumeData = DicomDataBase & {
	type: "volume";
	images: ImageData[];
	slicePositions: SlicePosition[];
	pixelSpacing: PixelSpacing;
};

export type FundusData = DicomDataBase & {
	type: "fundus";
	image: ImageData;
};

export type DicomData = VolumeData | FundusData;

const UID_VOLUME = "1.2.840.10008.5.1.4.1.1.77.1.5.4";
const UID_FUNDUS = "1.2.840.10008.5.1.4.1.1.77.1.5.1";

export async function getDicomData(file: File): Promise<DicomData> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const sopClassUID = dataSet.string("x00080016");
	const patientID = dataSet.string("x00100020");
	const studyInstanceUID = dataSet.string("x0020000d");
	const sopInstanceUID = dataSet.string("x00080018");

	const patientName = dataSet.string("x00100010")?.replace("^", ", ").trim();
	const laterality = dataSet.string("x00200062")?.toUpperCase() as Laterality;
	const acquisitionDate = (() => {
		const s = dataSet.string("x00080022") ?? dataSet.string("x0008002a")?.slice(0, 8);
		return s && /^\d{8}$/.test(s) ? new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) : undefined;
	})();

	const rows = dataSet.uint16("x00280010");
	const cols = dataSet.uint16("x00280011");
	const frames = dataSet.intString("x00280008") ?? 1;

	const bitsAllocated = dataSet.uint16("x00280100");
	const pixelDataElement = dataSet.elements.x7fe00010;

	if (
		!sopClassUID ||
		!patientID ||
		!studyInstanceUID ||
		!sopInstanceUID ||
		!laterality ||
		!acquisitionDate ||
		!rows ||
		!cols ||
		!pixelDataElement
	) {
		throw new Error(`Missing required data in file: ${file.name}`);
	}

	const base = {
		file,
		patientID,
		patientName,
		studyInstanceUID,
		sopInstanceUID,
		laterality,
		acquisitionDate,
		rows,
		cols,
		frames,
	};

	const pixelData =
		bitsAllocated === 16
			? new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2)
			: new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

	if (sopClassUID === UID_VOLUME) {
		const images: ImageData[] = [];

		for (let frame = 0; frame < frames; frame++) {
			const framePixels = pixelsForFrame(pixelData, frame, rows, cols);
			images.push(normalizeDicom(framePixels, cols, rows));
		}

		const slicePositions = readSlicePositions(dataSet);
		const pixelSpacing = readPixelSpacing(dataSet);

		if (!slicePositions || images.length !== slicePositions.length || images.length !== frames || !pixelSpacing) {
			throw new Error(`Inconsistent data in volume file: ${file.name}`);
		}

		return {
			type: "volume",
			...base,
			images,
			slicePositions,
			pixelSpacing,
		};
	}

	if (sopClassUID === UID_FUNDUS) {
		const image = normalizeDicom(pixelData, cols, rows);

		return {
			type: "fundus",
			...base,
			image,
		};
	}

	throw new Error(`DICOM file could not be classified: ${file.name}`);
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
		const v = pixelData[i] as number;

		if (v < min) {
			min = v;
		}
		if (v > max) {
			max = v;
		}
	}

	const range = max - min || 1;
	for (let i = 0; i < cols * rows; i++) {
		const val = Math.round(((pixelData[i] - min) / range) * 255);

		imageData.data[i * 4 + 0] = val;
		imageData.data[i * 4 + 1] = val;
		imageData.data[i * 4 + 2] = val;
		imageData.data[i * 4 + 3] = 255;
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

export const renderDicom = (image: ImageData, canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return;
	}

	canvas.width = image.width;
	canvas.height = image.height;

	ctx.putImageData(image, 0, 0);
};
