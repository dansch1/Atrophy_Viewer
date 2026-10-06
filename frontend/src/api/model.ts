import { z } from "zod";
import { fetchWithTimeout } from "./http";

export const ModelTaskSchema = z.enum(["object_detection", "classification"]);
export const ImageTypeSchema = z.enum(["fundus", "oct_bscan", "oct_volume"]);
export const PredictionScopeSchema = z.enum(["image", "slice", "volume"]);

const ModelInputSchema = z.discriminatedUnion("image_type", [
	z.object({
		image_type: z.literal("fundus"),
		prediction_scope: z.literal("image"),
	}),
	z.object({
		image_type: z.literal("oct_bscan"),
		prediction_scope: z.literal("image"),
	}),
	z.object({
		image_type: z.literal("oct_volume"),
		prediction_scope: z.enum(["slice", "volume"]),
	}),
]);

const DetectionPostprocConfigSchema = z.object({
	type: z.literal("object_detection"),
	thresholds: z.array(z.number()),
	nms_iou_threshold: z.number(),
	top_k: z.number().int().nonnegative(),
});

const ClassPostprocConfigSchema = z.object({
	type: z.literal("classification"),
	thresholds: z.array(z.number()),
});

const PostprocConfigSchema = z.discriminatedUnion("type", [DetectionPostprocConfigSchema, ClassPostprocConfigSchema]);

const ModelInfoSchema = z.object({
	model_id: z.string(),
	name: z.string(),
	task: ModelTaskSchema,
	classes: z.array(z.string()),
	input: ModelInputSchema,
	postproc_config: PostprocConfigSchema.optional(),
});

const ModelMapSchema = z
	.object({ models: z.record(z.string(), ModelInfoSchema) })
	.transform((data) => new Map(Object.entries(data.models)));

export type ModelTask = z.infer<typeof ModelTaskSchema>;
export type ImageType = z.infer<typeof ImageTypeSchema>;
export type PredictionScope = z.infer<typeof PredictionScopeSchema>;

export type ModelInput = z.infer<typeof ModelInputSchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;
export type ModelMap = z.infer<typeof ModelMapSchema>;

export async function fetchModels(): Promise<ModelMap> {
	const response = await fetchWithTimeout(`${import.meta.env.VITE_API_BASE}/models`);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	const data = await response.json();

	return ModelMapSchema.parse(data);
}
