import { z } from "zod";
import { fetchWithTimeout } from "./http";
import { ModelTaskSchema, type ModelTask } from "./model";

const BoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const DetectionPredictionSchema = z.object({
	kind: z.literal("detection"),
	boxes: z.array(BoxSchema),
	scores: z.array(z.number()),
	classes: z.array(z.number().int()),
});

const ClassPredictionSchema = z.object({
	kind: z.literal("class"),
	scores: z.array(z.number()),
});

const SlicePredictionSchema = z.discriminatedUnion("kind", [DetectionPredictionSchema, ClassPredictionSchema]);

const StreamMsgSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("meta"),
		model: z.string(),
		task: ModelTaskSchema,
		slices: z.number().int(),
	}),
	z.object({
		type: z.literal("slice"),
		i: z.number().int(),
		pred: SlicePredictionSchema,
	}),
	z.object({
		type: z.literal("done"),
	}),
	z.object({
		type: z.literal("error"),
		message: z.string().optional(),
	}),
]);

export type Box = z.infer<typeof BoxSchema>;

export type DetectionPrediction = z.infer<typeof DetectionPredictionSchema>;
export type ClassPrediction = z.infer<typeof ClassPredictionSchema>;

export type SlicePrediction = z.infer<typeof SlicePredictionSchema>;
export type VolumePrediction = Array<SlicePrediction | null>;

export type PredictionMeta = {
	model: string;
	task: ModelTask;
	slices: number;
};

export async function streamPredictions(
	file: File,
	model: string,
	opts?: {
		controller?: AbortController;
		slices?: number[];
		onMeta?: (meta: PredictionMeta) => void;
		onSlice?: (i: number, pred: SlicePrediction) => void;
		onDone?: () => void;
		onError?: (message: string) => void;
	},
): Promise<void> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("model", model);

	if (opts?.slices && opts.slices.length > 0) {
		formData.append("slices", JSON.stringify(opts.slices));
	}

	const response = await fetchWithTimeout(
		`${import.meta.env.VITE_API_BASE}/predict`,
		{
			method: "POST",
			body: formData,
		},
		opts?.controller,
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	if (!response.body) {
		throw new Error("Streaming not supported: response.body is null");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");

	let buffer = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });

		let nlIndex: number;
		while ((nlIndex = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, nlIndex).trim();
			buffer = buffer.slice(nlIndex + 1);

			if (!line) {
				continue;
			}

			const raw = JSON.parse(line);
			const msg = StreamMsgSchema.parse(raw);

			if (msg.type === "meta") {
				opts?.onMeta?.({
					model: msg.model,
					task: msg.task,
					slices: msg.slices,
				});
			} else if (msg.type === "slice") {
				opts?.onSlice?.(msg.i, msg.pred);
			} else if (msg.type === "done") {
				opts?.onDone?.();
			} else if (msg.type === "error") {
				const message = msg.message ?? "Unknown error";
				opts?.onError?.(message);
				throw new Error(message);
			}
		}
	}
}
