import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom, type SlicePosition } from "@/lib/dicom";
import { withAlpha } from "@/lib/utils";
import { dot, lerp, mid, type Pt, unitNormal } from "@/lib/vec2";
import React, { useEffect, useRef } from "react";

const FundusViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedFundus,
		selectedSlice,
		setSelectedSlice,
		viewMode,
		setViewMode,
		showSlices,
		hiddenLabels,
		processedVolumePredictions,
		showPredictions,
		showFilenames,
		showScores,
		selectedModelColors,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (selectedFundus && imgCanvasRef.current) {
			renderDicom(selectedFundus.image, imgCanvasRef.current);
		}
	}, [selectedFundus, viewMode]);

	if (!selectedFundus || viewMode === "slice") {
		return null;
	}

	function sliceIntervalToPolygon(
		i: number,
		xStart: number,
		xEnd: number,
		slices: SlicePosition[],
		cols: number
	): [Pt, Pt, Pt, Pt] {
		const { p0, p1 } = slices[i];

		const mi = mid(p0, p1);
		const { nx, ny } = unitNormal(p0, p1);

		const prev = i > 0 ? slices[i - 1] : null;
		const next = i < slices.length - 1 ? slices[i + 1] : null;

		const halfGapTo = (s: SlicePosition | null): number => {
			if (!s) {
				return 1;
			}

			const ms = mid(s.p0, s.p1);
			return Math.abs(dot(ms.x - mi.x, ms.y - mi.y, nx, ny)) / 2;
		};

		const hp = prev ? halfGapTo(prev) : halfGapTo(next);
		const hn = next ? halfGapTo(next) : halfGapTo(prev);

		const t0 = xStart / (cols - 1);
		const t1 = xEnd / (cols - 1);

		const A = lerp(p0, p1, t0);
		const B = lerp(p0, p1, t1);

		const Aminus = { x: A.x - nx * hp, y: A.y - ny * hp };
		const Bminus = { x: B.x - nx * hp, y: B.y - ny * hp };
		const Bplus = { x: B.x + nx * hn, y: B.y + ny * hn };
		const Aplus = { x: A.x + nx * hn, y: A.y + ny * hn };

		return [Aplus, Aminus, Bminus, Bplus];
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				{selectedVolume && processedVolumePredictions && showPredictions && (
					<svg className="absolute top-0 left-0 w-full h-full">
						<g>
							{processedVolumePredictions.flatMap(({ boxes, scores, classes }, i) =>
								boxes.map((box, j) => {
									const cls = classes[j];
									if (hiddenLabels.has(cls)) {
										return null;
									}

									const [x1, , x2] = box;

									const xStart = Math.max(0, Math.min(selectedVolume.cols, Math.min(x1, x2)));
									const xEnd = Math.max(0, Math.min(selectedVolume.cols, Math.max(x1, x2)));

									if (xStart >= xEnd) {
										return null;
									}

									const points = sliceIntervalToPolygon(
										i,
										xStart,
										xEnd,
										selectedVolume.slicePositions,
										selectedVolume.cols
									);

									const color = selectedModelColors.getColorByIndex(cls);
									const score = scores[j];
									const scoreColor = withAlpha(color, Math.pow(score, 1.5));

									return (
										<polygon
											key={`fundus-prediction-${i}-${j}`}
											points={points.map((p) => `${p.x},${p.y}`).join(" ")}
											fill={showScores ? scoreColor : color}
											fillOpacity={1}
											stroke={color}
											strokeWidth={0.1}
											className="cursor-pointer"
											onClick={() => console.log("Clicked", { sliceIndex: i, detIndex: j, cls })}
										/>
									);
								})
							)}
						</g>
					</svg>
				)}

				{selectedVolume && showSlices && (
					<svg className="absolute top-0 left-0 w-full h-full">
						<g>
							{selectedVolume.slicePositions.map(({ p0, p1 }, i) => {
								return (
									<g key={`fundus-slice-${i}`} className="group">
										<line
											x1={p0.x}
											x2={p1.x}
											y1={p0.y}
											y2={p1.y}
											stroke="transparent"
											strokeWidth={10}
											className="cursor-pointer"
											onClick={() => {
												setSelectedSlice(i);
												setViewMode("both");
											}}
										/>
										<line
											x1={p0.x}
											x2={p1.x}
											y1={p0.y}
											y2={p1.y}
											stroke={selectedSlice === i ? "blue" : "red"}
											strokeWidth={2}
											className="group-hover:stroke-blue-500 pointer-events-none"
										/>
									</g>
								);
							})}
						</g>
					</svg>
				)}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedFundus.file.name}</div>}
		</div>
	);
};

export default FundusViewer;
