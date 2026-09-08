import { z } from "zod";
import { fetchWithTimeout } from "./http";
import {
	ImageTypeSchema,
	ModelTaskSchema,
	PredictionScopeSchema,
	type ImageType,
	type ModelTask,
	type PredictionScope,
} from "./model";

const BoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const DetectionPredictionSchema = z.object({
	kind: z.literal("object_detection"),
	boxes: z.array(BoxSchema),
	scores: z.array(z.number()),
	classes: z.array(z.number().int()),
});

const ClassPredictionSchema = z.object({
	kind: z.literal("classification"),
	scores: z.array(z.number()),
});

const PredictionSchema = z.discriminatedUnion("kind", [DetectionPredictionSchema, ClassPredictionSchema]);

const StreamMsgSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("meta"),
		model: z.string(),
		task: ModelTaskSchema,
		image_type: ImageTypeSchema,
		prediction_scope: PredictionScopeSchema,
		count: z.number().int().positive(),
	}),
	z.object({
		type: z.literal("prediction"),
		i: z.number().int().nonnegative(),
		pred: PredictionSchema,
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

export type Prediction = z.infer<typeof PredictionSchema>;
export type PredictionResult = {
	scope: PredictionScope;
	items: Array<Prediction | null>;
};

export type PredictionMeta = {
	model: string;
	task: ModelTask;
	imageType: ImageType;
	scope: PredictionScope;
	count: number;
};

export async function streamPredictions(
	file: File,
	model: string,
	opts?: {
		controller?: AbortController;
		slices?: number[];
		onMeta?: (meta: PredictionMeta) => void;
		onPred?: (i: number, pred: Prediction) => void;
		onDone?: () => void;
		onError?: (message: string) => void;
	},
): Promise<void> {
	const formData = new FormData();

	formData.append("file", file);
	formData.append("model", model);

	if (opts?.slices?.length) {
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
	const processLine = (line: string) => {
		if (!line) {
			return;
		}

		const msg = StreamMsgSchema.parse(JSON.parse(line));

		switch (msg.type) {
			case "meta":
				opts?.onMeta?.({
					model: msg.model,
					task: msg.task,
					imageType: msg.image_type,
					scope: msg.prediction_scope,
					count: msg.count,
				});
				break;
			case "prediction":
				opts?.onPred?.(msg.i, msg.pred);
				break;
			case "done":
				opts?.onDone?.();
				break;
			case "error": {
				const errorMessage = msg.message ?? "Unknown error";
				opts?.onError?.(errorMessage);
				throw new Error(errorMessage);
			}
		}
	};

	while (true) {
		const { value, done } = await reader.read();
		buffer += decoder.decode(value, { stream: !done });

		let nlIndex: number;
		while ((nlIndex = buffer.indexOf("\n")) !== -1) {
			processLine(buffer.slice(0, nlIndex).trim());
			buffer = buffer.slice(nlIndex + 1);
		}

		if (done) {
			break;
		}
	}

	processLine(buffer.trim());
}
