import { useViewer } from "@/context/ViewerStateProvider";
import type { DicomPixelData } from "@/utils/dicom";
import { renderImage } from "@/utils/image";
import React, { useEffect, useRef } from "react";

type Props = {
	volumeData: DicomPixelData | null;
};

const SliceViewer: React.FC<Props> = ({ volumeData }) => {
	const {
		dicomPairs,
		selectedPair,
		selectedSlice,
		annotations,
		showAnnotations,
		showFilenames,
		selectedModel,
		modelColors,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	const sliceAnnotations = selectedSlice !== null ? annotations[selectedPair]?.[selectedSlice] ?? null : null;

	useEffect(() => {
		const renderSelectedSlice = () => {
			if (!volumeData || selectedSlice === null || !imgCanvasRef.current) {
				return;
			}

			const { cols, rows, pixelData } = volumeData;
			const frameSize = cols * rows;
			const offset = selectedSlice * frameSize;
			const slice = pixelData.slice(offset, offset + frameSize);

			renderImage(slice, cols, rows, imgCanvasRef.current);
		};

		renderSelectedSlice();
	}, [selectedSlice]);

	if (!volumeData || selectedSlice === null) {
		return null;
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />
				{showAnnotations && sliceAnnotations && selectedModel && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{sliceAnnotations.map((annotation, i) => {
							const { x0, x1, cls } = annotation;

							if (x0 >= x1 || x0 < 0 || x1 > volumeData.cols) return null;

							const color = modelColors[selectedModel]?.getColorByIndex(cls) ?? "#000000";

							const rectX = (x0 / volumeData.cols) * 100;
							const rectWidth = ((x1 - x0) / volumeData.cols) * 100;

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

			{showFilenames && (
				<div className="text-sm text-muted-foreground mt-1">
					{dicomPairs[selectedPair]?.volume?.name ?? "Unknown volume file"}
				</div>
			)}
		</div>
	);
};

export default SliceViewer;
