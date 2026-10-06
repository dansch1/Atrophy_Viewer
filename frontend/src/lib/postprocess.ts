import type { ModelInfo } from "@/api/model";
import type { Box, DetectionPrediction, Prediction, PredictionResult } from "@/api/prediction";

type DetectionPostprocConfig = {
	type: "object_detection";
	thresholds: number[];
	nmsIouThreshold: number;
	topK: number;
};

type ClassPostprocConfig = {
	type: "classification";
	thresholds: number[];
};

export type PostprocConfig = DetectionPostprocConfig | ClassPostprocConfig;

export function createPostprocConfig(model: ModelInfo): PostprocConfig | undefined {
	if (!model.postproc_config) {
		return undefined;
	}

	switch (model.postproc_config.type) {
		case "object_detection":
			return {
				type: "object_detection",
				thresholds: [...model.postproc_config.thresholds],
				nmsIouThreshold: model.postproc_config.nms_iou_threshold,
				topK: model.postproc_config.top_k,
			};

		case "classification":
			return {
				type: "classification",
				thresholds: [...model.postproc_config.thresholds],
			};
	}
}

export function postprocessPredictionResult(prediction: PredictionResult, config?: PostprocConfig): PredictionResult {
	return {
		...prediction,
		items: prediction.items.map((item) => postprocessPrediction(item, config)),
	};
}

function postprocessPrediction(prediction: Prediction | null, config?: PostprocConfig): Prediction | null {
	if (!prediction) {
		return null;
	}

	if (prediction.kind === "object_detection" && config?.type === "object_detection") {
		return postprocessDetection(prediction, config);
	}

	return prediction;
}

function postprocessDetection(prediction: DetectionPrediction, config: DetectionPostprocConfig): DetectionPrediction {
	const candidates = prediction.scores
		.map((score, index) => ({ score, index }))
		.filter(({ score, index }) => passesClassThreshold(score, prediction.classes[index], config))
		.sort((a, b) => b.score - a.score)
		.map(({ index }) => index);

	const keep: number[] = [];
	let remaining = candidates;

	while (remaining.length > 0) {
		const current = remaining[0];
		keep.push(current);

		remaining = remaining.slice(1).filter((index) => {
			if (prediction.classes[index] !== prediction.classes[current]) {
				return true;
			}

			return intersectionOverUnion(prediction.boxes[current], prediction.boxes[index]) <= config.nmsIouThreshold;
		});
	}

	const selected = config.topK > 0 ? keep.slice(0, config.topK) : keep;

	return {
		kind: "object_detection",
		boxes: selected.map((i) => prediction.boxes[i]),
		scores: selected.map((i) => prediction.scores[i]),
		classes: selected.map((i) => prediction.classes[i]),
	};
}

function intersectionOverUnion(a: Box, b: Box): number {
	const left = Math.max(a[0], b[0]);
	const top = Math.max(a[1], b[1]);
	const right = Math.min(a[2], b[2]);
	const bottom = Math.min(a[3], b[3]);

	const intersectionWidth = Math.max(0, right - left);
	const intersectionHeight = Math.max(0, bottom - top);
	const intersection = intersectionWidth * intersectionHeight;

	const union = area(a) + area(b) - intersection;

	return union > 0 ? intersection / union : 0;
}

export function area(box: Box): number {
	const [x1, y1, x2, y2] = box;
	return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

export function passesClassThreshold(score: number, classIndex: number, config?: PostprocConfig): boolean {
	const threshold = config?.thresholds[classIndex] ?? 0.5;
	return score >= threshold;
}
