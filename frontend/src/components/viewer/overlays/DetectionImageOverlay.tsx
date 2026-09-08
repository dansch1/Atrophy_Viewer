import type { DetectionPrediction } from "@/api/prediction";
import { useViewer } from "@/context/ViewerStateProvider";
import React from "react";

const DetectionImageOverlay: React.FC<{ prediction: DetectionPrediction }> = ({ prediction }) => {
	const { hiddenClasses, showScores, selectedModelColors } = useViewer();

	return (
		<svg className="absolute top-0 left-0 w-full h-full">
			{prediction.boxes.map((box, i) => {
				const cls = prediction.classes[i];
				if (hiddenClasses.has(cls)) {
					return null;
				}

				const [x1, y1, x2, y2] = box;

				const x = Math.min(x1, x2);
				const y = Math.min(y1, y2);
				const width = Math.abs(x2 - x1);
				const height = Math.abs(y2 - y1);

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

export default DetectionImageOverlay;
