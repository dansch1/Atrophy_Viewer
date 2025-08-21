import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom } from "@/lib/dicom";
import React, { useEffect, useRef } from "react";

const SliceViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedSlice,
		setSelectedSlice,
		showSlices,
		selectedSliceAnnotations,
		showAnnotations,
		showFilenames,
		selectedLabelColors,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		setSelectedSlice(null);
	}, [selectedVolume]);

	useEffect(() => {
		if (!showSlices) {
			setSelectedSlice(null);
		}
	}, [showSlices]);

	useEffect(() => {
		const renderSelectedSlice = () => {
			if (
				!selectedVolume ||
				selectedSlice === null ||
				selectedSlice < 0 ||
				selectedSlice >= selectedVolume.frames ||
				!imgCanvasRef.current
			) {
				return;
			}

			const { cols, rows, pixelData } = selectedVolume;

			const frameSize = cols * rows;
			const offset = selectedSlice * frameSize;
			const sliceData = pixelData.subarray(offset, offset + frameSize);

			renderDicom(sliceData, cols, rows, imgCanvasRef.current);
		};

		renderSelectedSlice();
	}, [selectedVolume, selectedSlice]);

	if (!selectedVolume || selectedSlice === null) {
		return null;
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

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
