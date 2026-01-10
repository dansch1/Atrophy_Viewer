import type { Box, SlicePredictions, VolumePredictions } from "@/api/prediction";

export function area(b: Box): number {
	const [x1, y1, x2, y2] = b;
	return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

export function iou(a: Box, b: Box): number {
	const [ax1, ay1, ax2, ay2] = a;
	const [bx1, by1, bx2, by2] = b;

	const ix1 = Math.max(ax1, bx1);
	const iy1 = Math.max(ay1, by1);
	const ix2 = Math.min(ax2, bx2);
	const iy2 = Math.min(ay2, by2);

	const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
	if (inter <= 0) {
		return 0;
	}

	const union = area(a) + area(b) - inter;
	return union <= 0 ? 0 : inter / union;
}

export type PostprocessParams = {
	scoreThreshold: number;
	nmsIouThreshold: number;
	topK: number; // 0 = off
};

export function postprocessSlice(slice: SlicePredictions, p: PostprocessParams): SlicePredictions {
	const n = Math.min(slice.boxes.length, slice.scores.length, slice.classes.length);

	// score filter
	const idx: number[] = [];
	for (let i = 0; i < n; i++) {
		if (slice.scores[i] >= p.scoreThreshold) idx.push(i);
	}

	if (idx.length === 0) {
		return { boxes: [], scores: [], classes: [] };
	}

	idx.sort((a, b) => slice.scores[b] - slice.scores[a]);

	// batched NMS
	const kept: number[] = [];
	const keptByClass = new Map<number, number[]>();

	for (const i of idx) {
		const cls = slice.classes[i];
		const box = slice.boxes[i];

		const keptInCls = keptByClass.get(cls) ?? [];
		let suppressed = false;

		for (const j of keptInCls) {
			if (iou(box, slice.boxes[j]) > p.nmsIouThreshold) {
				suppressed = true;
				break;
			}
		}

		if (suppressed) {
			continue;
		}

		kept.push(i);
		keptInCls.push(i);
		keptByClass.set(cls, keptInCls);

		// topK
		if (p.topK > 0 && kept.length >= p.topK) {
			break;
		}
	}

	return {
		boxes: kept.map((i) => slice.boxes[i]),
		scores: kept.map((i) => slice.scores[i]),
		classes: kept.map((i) => slice.classes[i]),
	};
}

export function postprocessVolume(volume: SlicePredictions[], p: PostprocessParams): VolumePredictions {
	return volume.map((s) => postprocessSlice(s, p));
}
