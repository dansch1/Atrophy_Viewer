import * as dicomParser from "dicom-parser";

export type DicomMetadata = {
	file: File;
	frames: number;
	studyInstanceUID: string;
};

export async function getDicomMetadata(file: File): Promise<DicomMetadata> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const frames = Number(dataSet.intString("x00280008") ?? 1);
	const studyInstanceUID = dataSet.string("x0020000d");

	if (!studyInstanceUID) {
		throw new Error(`Missing StudyInstanceUID in file: ${file.name}`);
	}

	return {
		file,
		frames,
		studyInstanceUID,
	};
}

export type DicomPixelData = {
	rows: number;
	cols: number;
	frames: number;
	pixelData: Uint8Array | Uint16Array;
};

export async function getDicomPixelData(file: File): Promise<DicomPixelData> {
	const arrayBuffer = await file.arrayBuffer();
	const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

	const rows = dataSet.uint16("x00280010");
	const cols = dataSet.uint16("x00280011");
	const frames = Number(dataSet.intString("x00280008") ?? 1);
	const bitsAllocated = dataSet.uint16("x00280100");
	const pixelDataElement = dataSet.elements.x7fe00010;

	if (!pixelDataElement || !rows || !cols) {
		throw new Error(`Missing required pixel data in file: ${file.name}`);
	}

	const pixelData =
		bitsAllocated === 16
			? new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2)
			: new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

	return { rows, cols, frames, pixelData };
}
