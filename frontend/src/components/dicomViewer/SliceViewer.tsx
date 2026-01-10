import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom } from "@/lib/dicom";
import { clamp } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

const SliceViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedSlice,
		setSelectedSlice,
		viewMode,
		hiddenLabels,
		processedSlicePredictions,
		showPredictions,
		showFilenames,
		showScores,
		selectedModelColors,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!selectedVolume || !imgCanvasRef.current) {
			return;
		}

		const maxIdx = Math.max(0, (selectedVolume?.frames ?? 0) - 1);
		setSelectedSlice(clamp(selectedSlice, 0, maxIdx));

		renderDicom(selectedVolume.images[selectedSlice], imgCanvasRef.current);
	}, [selectedVolume, selectedSlice, viewMode]);

	if (!selectedVolume || viewMode === "fundus") {
		return null;
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				<div className="absolute top-2 left-3 z-5 text-sm text-center text-green-500">
					{`${selectedSlice + 1} / ${selectedVolume.frames}`}
				</div>

				{processedSlicePredictions && showPredictions && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{processedSlicePredictions.boxes.map((box, i) => {
							const cls = processedSlicePredictions.classes[i];

							if (hiddenLabels.has(cls)) {
								return null;
							}

							const [x1, y1, x2, y2] = box;

							const x = clamp(Math.min(x1, x2), 0, selectedVolume.cols);
							const y = clamp(Math.min(y1, y2), 0, selectedVolume.rows);
							const w = Math.max(0, clamp(Math.max(x1, x2), 0, selectedVolume.cols) - x);
							const h = Math.max(0, clamp(Math.max(y1, y2), 0, selectedVolume.rows) - y);

							if (w === 0 || h === 0) {
								return null;
							}

							const color = selectedModelColors.getColorByIndex(cls);
							const score = processedSlicePredictions.scores[i];

							return (
								<g key={`slice-prediction-${i}`}>
									<rect
										x={x}
										y={y}
										width={w}
										height={h}
										fill={color}
										fillOpacity={0.3}
										stroke={color}
										strokeWidth={0.8}
										vectorEffect="non-scaling-stroke"
									/>

									{showScores && (
										<text
											x={x}
											y={Math.max(0, y - 2)}
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
				)}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedVolume.file.name}</div>}
		</div>
	);
};

export default SliceViewer;
