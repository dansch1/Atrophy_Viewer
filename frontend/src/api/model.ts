import { z } from "zod";
import { fetchWithTimeout } from "./http";

export const ModelTaskSchema = z.enum(["object_detection", "classification"]);

const ModelCapabilitiesSchema = z.object({
	boxes: z.boolean(),
	scores: z.boolean(),
});

const DetectionPostprocConfigSchema = z.object({
	type: z.literal("detection"),
	score_threshold: z.number(),
	nms_iou_threshold: z.number(),
	top_k: z.number().int().nonnegative(),
});

const ClassPostprocConfigSchema = z.object({
	type: z.literal("class"),
	thresholds: z.array(z.number()),
});

const PostprocConfigSchema = z.discriminatedUnion("type", [DetectionPostprocConfigSchema, ClassPostprocConfigSchema]);

const ModelInfoSchema = z.object({
	model_id: z.string(),
	name: z.string(),
	task: ModelTaskSchema,
	classes: z.array(z.string()),
	capabilities: ModelCapabilitiesSchema,
	postproc_config: PostprocConfigSchema.optional(),
});

const ModelMapSchema = z
	.object({ models: z.record(z.string(), ModelInfoSchema) })
	.transform((data) => new Map(Object.entries(data.models)));

export type ModelTask = z.infer<typeof ModelTaskSchema>;
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
