import { z } from "zod";
import { fetchWithTimeout } from "./http";

const BoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const ModelPredictionSchema = z.object({
	boxes: z.array(BoxSchema),
	scores: z.array(z.number()),
	classes: z.array(z.number()),
});

const PredictionResponseSchema = z.object({
	model: z.string(),
	slices: z.number(),
	results: z.array(ModelPredictionSchema),
});

export type Box = z.infer<typeof BoxSchema>;
export type SlicePredictions = z.infer<typeof ModelPredictionSchema>;
export type VolumePredictions = SlicePredictions[];

export async function fetchPredictions(
	file: File,
	model: string,
	controller?: AbortController
): Promise<VolumePredictions> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("model", model);

	const response = await fetchWithTimeout(
		`${import.meta.env.VITE_API_BASE}/predict`,
		{
			method: "POST",
			body: formData,
		},
		controller
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	const data = await response.json();

	return PredictionResponseSchema.parse(data).results;
}
