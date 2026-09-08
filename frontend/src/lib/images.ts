import type { DicomData } from "./dicom";

export type RasterData = {
	id: string;
	source: "raster";
	file: File;
	image: ImageData;
	rows: number;
	cols: number;
};

export type FileData = DicomData | RasterData;

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

export function isRasterFile(file: File): boolean {
	const name = file.name.toLowerCase();
	const dotIndex = name.lastIndexOf(".");
	const extension = dotIndex >= 0 ? name.slice(dotIndex) : "";

	return RASTER_EXTENSIONS.has(extension);
}

export async function getRasterData(file: File): Promise<RasterData> {
	const bitmap = await createImageBitmap(file);

	try {
		const canvas = document.createElement("canvas");
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;

		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error(`Failed to create canvas context for file: ${file.name}`);
		}

		context.drawImage(bitmap, 0, 0);

		return {
			id: crypto.randomUUID(),
			source: "raster",
			file,
			image: context.getImageData(0, 0, bitmap.width, bitmap.height),
			rows: bitmap.height,
			cols: bitmap.width,
		};
	} finally {
		bitmap.close();
	}
}

export function renderImage(image: ImageData, canvas: HTMLCanvasElement): void {
	canvas.width = image.width;
	canvas.height = image.height;

	canvas.getContext("2d")?.putImageData(image, 0, 0);
}
