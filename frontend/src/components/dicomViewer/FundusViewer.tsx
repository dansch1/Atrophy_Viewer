import { useViewer } from "@/context/ViewerStateProvider";
import { DEFAULT_LABEL_COLOR } from "@/lib/labelColors";
import { renderDicom } from "@/utils/dicom";
import React, { useEffect, useRef } from "react";

const FundusViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedFundus,
		selectedSlice,
		setSelectedSlice,
		showSlices,
		selectedVolumeAnnotations,
		showAnnotations,
		showFilenames,
		selectedLabelColors,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);
	const annotationCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const renderFundus = () => {
			if (!selectedFundus || !imgCanvasRef.current) {
				return;
			}

			const { cols, rows, pixelData } = selectedFundus;
			renderDicom(pixelData, cols, rows, imgCanvasRef.current);
		};

		renderFundus();
	}, [selectedFundus]);

	useEffect(() => {
		const renderVolumeAnnotation = () => {
			if (!selectedVolume || !selectedVolumeAnnotations || !annotationCanvasRef.current) {
				return;
			}

			const canvas = annotationCanvasRef.current;
			const ctx = canvas.getContext("2d");

			if (!ctx) {
				return;
			}

			const width = selectedVolume.cols;
			const height = selectedVolume.rows;

			canvas.width = width;
			canvas.height = height;

			const sliceWidth = width / selectedVolumeAnnotations.length;

			for (let i = 0; i < selectedVolumeAnnotations.length; i++) {
				const slice = selectedVolumeAnnotations[i];
				const x = i * sliceWidth;

				for (const { x0, x1, cls } of slice) {
					const color = selectedLabelColors?.getColorByIndex(cls) ?? DEFAULT_LABEL_COLOR;
					ctx.fillStyle = color;
					ctx.fillRect(x, x0, sliceWidth, x1 - x0 + 1);
				}
			}
		};

		renderVolumeAnnotation();
	}, [selectedVolume, selectedVolumeAnnotations]);

	if (!selectedFundus) {
		return null;
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				{showAnnotations && (
					<canvas ref={annotationCanvasRef} className="absolute top-0 left-0 z-10 pointer-events-none" />
				)}

				{selectedVolume && showSlices && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{Array.from({ length: selectedVolume.frames }).map((_, i) => {
							const y = `${(i / selectedVolume.frames) * 100}%`;

							return (
								<g key={`slice-${i}`} className="group">
									<line
										y1={y}
										y2={y}
										x1="0"
										x2="100%"
										stroke="transparent"
										strokeWidth="20"
										className="cursor-pointer"
										onClick={() => setSelectedSlice(i)}
									/>

									<line
										y1={y}
										y2={y}
										x1="0"
										x2="100%"
										stroke={selectedSlice === i ? "blue" : "red"}
										strokeWidth="1"
										className="group-hover:stroke-blue-500 pointer-events-none"
									/>
								</g>
							);
						})}
					</svg>
				)}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedFundus.file.name}</div>}
		</div>
	);
};

export default FundusViewer;
