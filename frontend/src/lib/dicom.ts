import * as dicomParser from "dicom-parser";

type DicomDataBase = {
	file: File;
	studyInstanceUID: string;
	rows: number;
	cols: number;
	frames: number;
	pixelData: Uint8Array;
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
};

export type FundusData = DicomDataBase & {
	type: "fundus";
};

export type DicomData = VolumeData | FundusData;

const UID_VOLUME = "1.2.840.10008.5.1.4.1.1.77.1.5.4";
const UID_FUNDUS = "1.2.840.10008.5.1.4.1.1.77.1.5.1";

export async function getDicomData(file: File): Promise<DicomData> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const sopClassUID = dataSet.string("x00080016");
	const studyInstanceUID = dataSet.string("x0020000d");

	const rows = dataSet.uint16("x00280010");
	const cols = dataSet.uint16("x00280011");
	const frames = dataSet.intString("x00280008") || 1;

	const pixelDataElement = dataSet.elements.x7fe00010;

	if (!sopClassUID || !studyInstanceUID || !rows || !cols || !pixelDataElement) {
		throw new Error(`Missing required data in file: ${file.name}`);
	}

	const pixelData = new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

	if (sopClassUID === UID_VOLUME) {
		const slicePositions = readSlicePositions(dataSet);

		return {
			type: "volume",
			file,
			studyInstanceUID,
			rows,
			cols,
			frames,
			pixelData,
			slicePositions,
		};
	}

	if (sopClassUID === UID_FUNDUS) {
		return {
			type: "fundus",
			file,
			studyInstanceUID,
			rows,
			cols,
			frames,
			pixelData,
		};
	}

	throw new Error(`DICOM file could not be classified: ${file.name}`);
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
		const row0 = f(0),
			col0 = f(1),
			row1 = f(2),
			col1 = f(3);

		if (!row0 || !col0 || !row1 || !col1) {
			continue;
		}

		slicePositions.push({ row0, col0, row1, col1 });
	}

	return slicePositions;
}

export const renderDicom = (data: Uint8Array, width: number, height: number, canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return;
	}

	const dpr = window.devicePixelRatio;

	canvas.width = width * dpr;
	canvas.height = height * dpr;

	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const imageData = normalizeDicom(data, width, height);
	ctx.putImageData(imageData, 0, 0);
};

export function normalizeDicom(data: Uint8Array, width: number, height: number): ImageData {
	const imageData = new ImageData(width, height);

	const min = data.reduce((m, v) => (v < m ? v : m), Infinity);
	const max = data.reduce((m, v) => (v > m ? v : m), -Infinity);

	for (let i = 0; i < width * height; i++) {
		const val = Math.round(((data[i] - min) / (max - min)) * 255);

		imageData.data[i * 4 + 0] = val;
		imageData.data[i * 4 + 1] = val;
		imageData.data[i * 4 + 2] = val;
		imageData.data[i * 4 + 3] = 255;
	}

	return imageData;
}
