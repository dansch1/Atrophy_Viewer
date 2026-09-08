import type { ModelInfo } from "@/api/model";
import type { FileData } from "@/lib/images";

export function isModelCompatible(model: ModelInfo, image: FileData): boolean {
	if (image.source === "raster") {
		return model.input.image_type !== "oct_volume";
	}

	return model.input.image_type === image.type;
}

export function getCompatibleImages(model: ModelInfo, images: FileData[]): FileData[] {
	return images.filter((image) => isModelCompatible(model, image));
}
