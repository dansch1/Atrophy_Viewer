import type { DetectionPrediction } from "@/api/prediction";
import { useViewer } from "@/context/ViewerStateProvider";
import { clamp } from "@/lib/utils";
import React from "react";

const DetectionSliceOverlay: React.FC<{ prediction: DetectionPrediction }> = ({ prediction }) => {
	const { selectedVolume, hiddenClasses, showScores, selectedModelColors } = useViewer();

	if (!selectedVolume) {
		return null;
	}

	return (
		<svg className="absolute top-0 left-0 w-full h-full">
			{prediction.boxes.map((box, i) => {
				const cls = prediction.classes[i];
				if (hiddenClasses.has(cls)) {
					return null;
				}

				const [x1, y1, x2, y2] = box;

				const x = clamp(Math.min(x1, x2), 0, selectedVolume.cols);
				const y = clamp(Math.min(y1, y2), 0, selectedVolume.rows);
				const width = Math.max(0, clamp(Math.max(x1, x2), 0, selectedVolume.cols) - x);
				const height = Math.max(0, clamp(Math.max(y1, y2), 0, selectedVolume.rows) - y);

				if (width === 0 || height === 0) {
					return null;
				}

				const color = selectedModelColors.getColorByIndex(cls);
				const score = prediction.scores[i];

				return (
					<g key={`detection-${i}`}>
						<rect
							x={x}
							y={y}
							width={width}
							height={height}
							fill={color}
							fillOpacity={0.3}
							stroke={color}
							strokeWidth={0.8}
							vectorEffect="non-scaling-stroke"
							onClick={() => console.log("Clicked")}
						/>

						{showScores && (
							<text
								x={x + 10}
								y={y + 20}
								fontSize={12}
								fill={color}
								textAnchor="start"
								dominantBaseline="ideographic"
								pointerEvents="none"
							>
								{score.toFixed(2)}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
};

export default DetectionSliceOverlay;
