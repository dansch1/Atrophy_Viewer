import type { ModelInfo } from "@/api/model";
import type { Box, DetectionPrediction, SlicePrediction, VolumePrediction } from "@/api/prediction";

type DetectionPostprocConfig = {
	type: "detection";
	scoreThreshold: number;
	nmsIouThreshold: number;
	topK: number;
};

type ClassPostprocConfig = {
	type: "class";
	thresholds: number[];
};

export type PostprocConfig = DetectionPostprocConfig | ClassPostprocConfig;

export function createPostprocConfig(model: ModelInfo): PostprocConfig | undefined {
	if (!model.postproc_config) {
		return undefined;
	}

	switch (model.postproc_config.type) {
		case "detection":
			return {
				type: "detection",
				scoreThreshold: model.postproc_config.score_threshold,
				nmsIouThreshold: model.postproc_config.nms_iou_threshold,
				topK: model.postproc_config.top_k,
			};

		case "class":
			return {
				type: "class",
				thresholds: [...model.postproc_config.thresholds],
			};
	}
}

export function postprocessVolume(volume: VolumePrediction, config: PostprocConfig): VolumePrediction {
	return volume.map((prediction) => postprocessPrediction(prediction, config));
}

function postprocessPrediction(prediction: SlicePrediction | null, config: PostprocConfig): SlicePrediction | null {
	if (!prediction) {
		return null;
	}

	if (prediction.kind === "class") {
		return prediction;
	}

	if (config.type !== "detection") {
		return prediction;
	}

	return postprocessDetection(prediction, config);
}

function postprocessDetection(prediction: DetectionPrediction, config: DetectionPostprocConfig): DetectionPrediction {
	const candidates = prediction.scores
		.map((score, index) => ({ score, index }))
		.filter(({ score }) => score >= config.scoreThreshold)
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
		kind: "detection",
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

export function isClassPositive(score: number, classIndex: number, config?: PostprocConfig): boolean {
	const threshold = (config?.type === "class" ? config.thresholds[classIndex] : undefined) ?? 0.5;
	return score >= threshold;
}
