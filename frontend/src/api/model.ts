import { z } from "zod";
import { fetchWithTimeout } from "./http";

export const ModelMapSchema = z
	.record(z.string(), z.array(z.string()))
	.transform((rec) => new Map<string, string[]>(Object.entries(rec)));

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
