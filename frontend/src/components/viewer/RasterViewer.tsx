import { useViewer } from "@/context/ViewerStateProvider";
import { renderImage } from "@/lib/images";
import React, { useEffect, useRef } from "react";
import ClassImageOverlay from "./overlays/ClassImageOverlay";
import DetectionImageOverlay from "./overlays/DetectionImageOverlay";

const RasterViewer: React.FC = () => {
	const { selectedRaster, processedRasterPrediction, showPredictions, showFilenames } = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!selectedRaster || !imgCanvasRef.current) {
			return;
		}

		renderImage(selectedRaster.image, imgCanvasRef.current);
	}, [selectedRaster]);

	if (!selectedRaster) {
		return null;
	}

	const renderPrediction = () => {
		if (!showPredictions || !processedRasterPrediction) {
			return null;
		}

		switch (processedRasterPrediction.kind) {
			case "object_detection":
				return <DetectionImageOverlay prediction={processedRasterPrediction} />;
			case "classification":
				return <ClassImageOverlay prediction={processedRasterPrediction} />;
		}
	};

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				{renderPrediction()}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedRaster.file.name}</div>}
		</div>
	);
};

export default RasterViewer;
