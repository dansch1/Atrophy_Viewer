import { z } from "zod";
import { fetchWithTimeout } from "./http";

export const AnnotationTupleSchema = z
	.tuple([z.number(), z.number(), z.number()])
	.transform(([x0, x1, cls]) => ({ x0, x1, cls }));

export const SliceAnnotationsSchema = z.array(AnnotationTupleSchema);
export const VolumeAnnotationsSchema = z.array(SliceAnnotationsSchema);

export type AnnotationTuple = z.infer<typeof AnnotationTupleSchema>;
export type SliceAnnotations = z.infer<typeof SliceAnnotationsSchema>;
export type VolumeAnnotations = z.infer<typeof VolumeAnnotationsSchema>;

export async function fetchAnnotations(
	file: File,
	model: string,
	controller?: AbortController
): Promise<VolumeAnnotations> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("model", model);

	const response = await fetchWithTimeout(
		`${import.meta.env.VITE_API_BASE}/annotate`,
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

	return VolumeAnnotationsSchema.parse(data);
}
