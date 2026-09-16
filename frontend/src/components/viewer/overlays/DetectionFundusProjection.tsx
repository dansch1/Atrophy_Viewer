import { useViewer } from "@/context/ViewerStateProvider";
import type { SlicePosition } from "@/lib/dicom";
import { withAlpha } from "@/lib/utils";
import { dot, lerp, mid, type Pt, unitNormal } from "@/lib/vec2";
import React from "react";

const DetectionVolumeFundusOverlay: React.FC = () => {
	const { selectedVolume, hiddenClasses, processedVolumeResult, showScores, selectedModelColors } = useViewer();

	if (!selectedVolume || !processedVolumeResult || processedVolumeResult.scope !== "slice") {
		return null;
	}

	const sliceIntervalToPolygon = (
		sliceIndex: number,
		xStart: number,
		xEnd: number,
		slices: SlicePosition[],
		cols: number,
	): [Pt, Pt, Pt, Pt] => {
		const { p0, p1 } = slices[sliceIndex];

		const center = mid(p0, p1);
		const { nx, ny } = unitNormal(p0, p1);

		const prev = sliceIndex > 0 ? slices[sliceIndex - 1] : null;
		const next = sliceIndex < slices.length - 1 ? slices[sliceIndex + 1] : null;

		const halfGapTo = (slice: SlicePosition | null): number => {
			if (!slice) {
				return 1;
			}

			const sliceCenter = mid(slice.p0, slice.p1);
			return Math.abs(dot(sliceCenter.x - center.x, sliceCenter.y - center.y, nx, ny)) / 2;
		};

		const prevGap = prev ? halfGapTo(prev) : halfGapTo(next);
		const nextGap = next ? halfGapTo(next) : halfGapTo(prev);

		const t0 = xStart / (cols - 1);
		const t1 = xEnd / (cols - 1);

		const start = lerp(p0, p1, t0);
		const end = lerp(p0, p1, t1);

		const startPrev = { x: start.x - nx * prevGap, y: start.y - ny * prevGap };
		const endPrev = { x: end.x - nx * prevGap, y: end.y - ny * prevGap };
		const endNext = { x: end.x + nx * nextGap, y: end.y + ny * nextGap };
		const startNext = { x: start.x + nx * nextGap, y: start.y + ny * nextGap };

		return [startNext, startPrev, endPrev, endNext];
	};

	return (
		<svg className="absolute top-0 left-0 w-full h-full">
			<g>
				{processedVolumeResult.items.flatMap((prediction, sliceIndex) => {
					if (prediction?.kind !== "object_detection") {
						return [];
					}

					const slicePosition = selectedVolume.slicePositions[sliceIndex];
					if (!slicePosition) {
						return [];
					}

					return prediction.boxes.map((box, detectionIndex) => {
						const cls = prediction.classes[detectionIndex];
						if (hiddenClasses.has(cls)) {
							return null;
						}

						const [x1, , x2] = box;

						const xStart = Math.max(0, Math.min(selectedVolume.cols, Math.min(x1, x2)));
						const xEnd = Math.max(0, Math.min(selectedVolume.cols, Math.max(x1, x2)));

						if (xStart >= xEnd) {
							return null;
						}

						const points = sliceIntervalToPolygon(
							sliceIndex,
							xStart,
							xEnd,
							selectedVolume.slicePositions,
							selectedVolume.cols,
						);

						const color = selectedModelColors.getColorByIndex(cls);
						const score = prediction.scores[detectionIndex];
						const scoreColor = withAlpha(color, Math.pow(score, 1.5));

						return (
							<polygon
								key={`detection-${sliceIndex}-${detectionIndex}`}
								points={points.map((point) => `${point.x},${point.y}`).join(" ")}
								fill={showScores ? scoreColor : color}
								fillOpacity={1}
								stroke={color}
								strokeWidth={0.1}
							/>
						);
					});
				})}
			</g>
		</svg>
	);
};

export default DetectionVolumeFundusOverlay;
