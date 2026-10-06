import { useViewer } from "@/context/ViewerStateProvider";
import { passesClassThreshold } from "@/lib/postprocess";
import { unitNormal } from "@/lib/vec2";
import React from "react";

const ClassVolumeFundusOverlay: React.FC = () => {
	const { selectedVolume, hiddenClasses, processedVolumeResult, selectedPostprocConfig, selectedModelColors } =
		useViewer();

	if (!selectedVolume || !processedVolumeResult || processedVolumeResult.scope !== "slice") {
		return null;
	}

	return (
		<svg className="absolute top-0 left-0 w-full h-full">
			{processedVolumeResult.items.flatMap((prediction, sliceIndex) => {
				if (prediction?.kind !== "classification") {
					return [];
				}

				const slicePosition = selectedVolume.slicePositions[sliceIndex];
				if (!slicePosition) {
					return [];
				}

				const positiveClasses = prediction.scores
					.map((score, cls) => ({ cls, score }))
					.filter(
						({ cls, score }) =>
							!hiddenClasses.has(cls) && passesClassThreshold(score, cls, selectedPostprocConfig),
					);

				if (positiveClasses.length === 0) {
					return [];
				}

				const { p0, p1 } = slicePosition;
				const { nx, ny } = unitNormal(p0, p1);
				const centerOffset = (positiveClasses.length - 1) / 2;

				return positiveClasses.map(({ cls, score }, classIndex) => {
					const offset = (classIndex - centerOffset) * 4;
					const dx = nx * offset;
					const dy = ny * offset;

					const color = selectedModelColors.getColorByIndex(cls);
					const opacity = 0.4 + score * 0.6;

					return (
						<line
							key={`class-${sliceIndex}-${cls}`}
							x1={p0.x + dx}
							y1={p0.y + dy}
							x2={p1.x + dx}
							y2={p1.y + dy}
							stroke={color}
							strokeWidth={2}
							strokeOpacity={opacity}
							vectorEffect="non-scaling-stroke"
						/>
					);
				});
			})}
		</svg>
	);
};

export default ClassVolumeFundusOverlay;
