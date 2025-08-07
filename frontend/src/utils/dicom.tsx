import * as dicomParser from "dicom-parser";

export type DicomMetadata = {
	file: File;
	studyInstanceUID: string;
	rows: number;
	cols: number;
	frames: number;
	pixelData: Uint8Array | Uint16Array;
};

export async function getDicomMetadata(file: File): Promise<DicomMetadata> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const studyInstanceUID = dataSet.string("x0020000d");
	const rows = dataSet.uint16("x00280010");
	const cols = dataSet.uint16("x00280011");
	const frames = Number(dataSet.intString("x00280008") ?? 1);
	const bitsAllocated = dataSet.uint16("x00280100");
	const pixelDataElement = dataSet.elements.x7fe00010;

	if (!studyInstanceUID || !rows || !cols || !pixelDataElement) {
		throw new Error(`Missing required metadata in file: ${file.name}`);
	}

	const pixelData =
		bitsAllocated === 16
			? new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2)
			: new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

	return {
		file,
		studyInstanceUID,
		rows,
		cols,
		frames,
		pixelData,
	};
}

export const renderDicom = (data: ArrayLike<number>, width: number, height: number, canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return;
	}

	const imageData = normalizeDicom(data, width, height);
	canvas.width = width;
	canvas.height = height;
	ctx.putImageData(imageData, 0, 0);
};

export function normalizeDicom(data: ArrayLike<number>, width: number, height: number): ImageData {
	let min = Infinity,
		max = -Infinity;

	for (let i = 0; i < data.length; i++) {
		if (data[i] < min) min = data[i];
		if (data[i] > max) max = data[i];
	}

	const imageData = new ImageData(width, height);

	for (let i = 0; i < width * height; i++) {
		const val = Math.round(((data[i] - min) / (max - min)) * 255);
		imageData.data[i * 4 + 0] = val;
		imageData.data[i * 4 + 1] = val;
		imageData.data[i * 4 + 2] = val;
		imageData.data[i * 4 + 3] = 255;
	}

	return imageData;
}
