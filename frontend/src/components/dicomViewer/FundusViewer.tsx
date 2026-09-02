import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom } from "@/lib/dicom";
import React, { useEffect, useRef } from "react";
import ClassFundusOverlay from "./overlays/ClassFundusOverlay";
import DetectionFundusOverlay from "./overlays/DetectionFundusOverlay";

const FundusViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedFundus,
		selectedSlice,
		setSelectedSlice,
		viewMode,
		setViewMode,
		showSlices,
		selectedModelInfo,
		processedVolumePrediction,
		showPredictions,
		showFilenames,
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

	const renderPrediction = () => {
		if (!showPredictions || !processedVolumePrediction || !selectedModelInfo) {
			return null;
		}

		switch (selectedModelInfo.task) {
			case "object_detection":
				return <DetectionFundusOverlay />;
			case "classification":
				return <ClassFundusOverlay />;
			default:
				return null;
		}
	};

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				{renderPrediction()}

				{selectedVolume && showSlices && (
					<svg className="absolute top-0 left-0 w-full h-full">
						<g>
							{selectedVolume.slicePositions.map(({ p0, p1 }, i) => (
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
							))}
						</g>
					</svg>
				)}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedFundus.file.name}</div>}
		</div>
	);
};

export default FundusViewer;
