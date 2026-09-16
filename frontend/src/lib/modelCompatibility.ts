import type { ModelInfo } from "@/api/model";
import type { FileData } from "@/lib/images";

export function isModelCompatible(model: ModelInfo, image: FileData): boolean {
	if (image.source === "raster") {
		return model.input.image_type !== "oct_volume";
	}

	switch (model.input.image_type) {
		case "fundus":
			return image.type === "fundus";

		case "oct_bscan":
			return image.type === "oct_bscan" || image.type === "oct_volume";

		case "oct_volume":
			return image.type === "oct_volume";
	}
}

export function getCompatibleImages(model: ModelInfo, images: FileData[]): FileData[] {
	return images.filter((image) => isModelCompatible(model, image));
}
