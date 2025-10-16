import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom, type SlicePosition } from "@/lib/dicom";
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
		selectedVolumeAnnotations,
		showAnnotations,
		showFilenames,
		selectedLabelColors,
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

	function annotationPoly(
		i: number,
		x0: number,
		x1: number,
		slices: SlicePosition[],
		cols: number
	): [Pt, Pt, Pt, Pt] {
		const s = slices[i];

		const p0 = { x: s.col0, y: s.row0 };
		const p1 = { x: s.col1, y: s.row1 };

		const mi = mid(p0, p1);
		const { nx, ny } = unitNormal(p0, p1);

		const prev = i > 0 ? slices[i - 1] : null;
		const next = i < slices.length - 1 ? slices[i + 1] : null;

		const halfGapTo = (s: SlicePosition | null): number => {
			if (!s) {
				return 1;
			}

			const ms = mid({ x: s.col0, y: s.row0 }, { x: s.col1, y: s.row1 });
			return Math.abs(dot(ms.x - mi.x, ms.y - mi.y, nx, ny)) / 2;
		};

		const hp = prev ? halfGapTo(prev) : halfGapTo(next);
		const hn = next ? halfGapTo(next) : halfGapTo(prev);

		const t0 = x0 / (cols - 1);
		const t1 = x1 / (cols - 1);

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

				{selectedVolume && selectedVolumeAnnotations && showAnnotations && (
					<svg className="absolute top-0 left-0 w-full h-full">
						<g>
							{selectedVolumeAnnotations.flatMap((sliceAnnotations, i) =>
								sliceAnnotations.map(({ x0, x1, cls }, j) => {
									if (x0 >= x1 || x0 < 0 || x1 > selectedVolume.cols || i >= selectedVolume.frames) {
										return null;
									}

									const points = annotationPoly(
										i,
										x0,
										x1,
										selectedVolume.slicePositions,
										selectedVolume.cols
									);
									const color = selectedLabelColors.getColorByIndex(cls);

									return (
										<polygon
											key={`fundus-annotation-${i}-${j}`}
											points={points.map((p) => `${p.x},${p.y}`).join(" ")}
											fill={color}
											fillOpacity={0.3}
											stroke={color}
											strokeWidth={0.1}
											className="cursor-pointer"
											onClick={() => console.log("Clicked annotation", { i, j })}
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
							{selectedVolume.slicePositions.map(({ row0, col0, row1, col1 }, i) => {
								return (
									<g key={`fundus-slice-${i}`} className="group">
										<line
											x1={col0}
											x2={col1}
											y1={row0}
											y2={row1}
											stroke="transparent"
											strokeWidth={10}
											className="cursor-pointer"
											onClick={() => {
												setSelectedSlice(i);
												setViewMode("both");
											}}
										/>
										<line
											x1={col0}
											x2={col1}
											y1={row0}
											y2={row1}
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
