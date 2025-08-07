import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom } from "@/utils/dicom";
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
		selectedModel,
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
			if (!selectedVolume || selectedSlice === null || !imgCanvasRef.current) {
				return;
			}

			const { cols, rows, pixelData } = selectedVolume;
			const frameSize = cols * rows;
			const offset = selectedSlice * frameSize;
			const slice = pixelData.slice(offset, offset + frameSize);

			renderDicom(slice, cols, rows, imgCanvasRef.current);
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

				{selectedSliceAnnotations && showAnnotations && selectedModel && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{selectedSliceAnnotations.map((annotation, i) => {
							const { x0, x1, cls } = annotation;

							if (x0 >= x1 || x0 < 0 || x1 > selectedVolume.cols) {
								return null;
							}

							const color = selectedLabelColors?.getColorByIndex(cls);

							const rectX = (x0 / selectedVolume.cols) * 100;
							const rectWidth = ((x1 - x0) / selectedVolume.cols) * 100;

							return (
								<rect
									key={`annotation-${i}`}
									x={`${rectX}%`}
									y="0"
									width={`${rectWidth}%`}
									height="100%"
									fill={color}
									fillOpacity="0.3"
									stroke={color}
									strokeWidth="1"
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
