import type { Laterality } from "@/hooks/useViewerState";
import * as dicomParser from "dicom-parser";

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
	row0: number;
	col0: number;
	row1: number;
	col1: number;
};

export type VolumeData = DicomDataBase & {
	type: "volume";
	slicePositions: SlicePosition[];
	images: ImageData[];
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
	const acquisitionDate: Date | undefined = (() => {
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

		return {
			type: "volume",
			...base,
			images,
			slicePositions,
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

function readSlicePositions(dataSet: dicomParser.DataSet): SlicePosition[] {
	const slicePositions = [];
	const items = dataSet.elements.x52009230?.items ?? [];

	for (const it of items) {
		const ds = it?.dataSet?.elements.x00220031?.items?.[0]?.dataSet;

		if (!ds) {
			continue;
		}

		const f = (i: number) => ds.float("x00220032", i);
		const row0 = f(0);
		const col0 = f(1);
		const row1 = f(2);
		const col1 = f(3);

		if (!row0 || !col0 || !row1 || !col1) {
			continue;
		}

		slicePositions.push({ row0, col0, row1, col1 });
	}

	return slicePositions;
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
