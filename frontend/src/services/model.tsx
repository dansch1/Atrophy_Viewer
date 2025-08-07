import { z } from "zod";
import { fetchWithTimeout } from "./fetch";

export const ModelDataSchema = z.object({
	name: z.string(),
	classes: z.array(z.string()),
});

export const ModelListSchema = z.array(ModelDataSchema);

export type ModelData = z.infer<typeof ModelDataSchema>;

export async function fetchModels(): Promise<ModelData[]> {
	const response = await fetchWithTimeout(`${import.meta.env.VITE_API_BASE}/models`);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	const data = await response.json();

	return ModelListSchema.parse(data);
}
