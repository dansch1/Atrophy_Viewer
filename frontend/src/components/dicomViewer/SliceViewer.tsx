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
		selectedSliceAnnotations,
		showAnnotations,
		showFilenames,
		selectedLabelColors,
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

				<div className="absolute top-2 left-3 text-sm text-center text-green-500">
					{`${selectedSlice + 1} / ${selectedVolume.frames}`}
				</div>

				{selectedSliceAnnotations && showAnnotations && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{selectedSliceAnnotations.map(({ x0, x1, cls }, i) => {
							if (x0 >= x1 || x0 < 0 || x1 > selectedVolume.cols) {
								return null;
							}

							const width = x1 - x0;
							const color = selectedLabelColors.getColorByIndex(cls);

							return (
								<rect
									key={`slice-annotation-${i}`}
									x={x0}
									y="0"
									width={width}
									height="100%"
									fill={color}
									fillOpacity="0.3"
									stroke={color}
									strokeWidth="0.1"
								/>
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
