import { useViewer } from "@/context/ViewerStateProvider";
import { renderImage } from "@/lib/images";
import React, { useEffect, useRef } from "react";
import ClassImageOverlay from "./overlays/ClassImageOverlay";
import DetectionImageOverlay from "./overlays/DetectionImageOverlay";

const OctViewer: React.FC = () => {
	const {
		selectedFundus,
		selectedVolume,
		selectedOct,
		selectedSlice,
		viewMode,
		processedOctPrediction,
		showPredictions,
		showFilenames,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);
	const image = selectedOct?.type === "oct_volume" ? selectedOct.images[selectedSlice] : selectedOct?.image;

	useEffect(() => {
		if (!image || !imgCanvasRef.current) {
			return;
		}

		renderImage(image, imgCanvasRef.current);
	}, [image, viewMode]);

	if (!image || (selectedFundus && viewMode === "fundus")) {
		return null;
	}

	const renderPrediction = () => {
		if (!showPredictions || !processedOctPrediction) {
			return null;
		}

		switch (processedOctPrediction.kind) {
			case "object_detection":
				return <DetectionImageOverlay prediction={processedOctPrediction} />;
			case "classification":
				return <ClassImageOverlay prediction={processedOctPrediction} />;
		}
	};

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				{selectedVolume && (
					<div className="absolute top-2 left-3 z-5 text-sm text-center text-green-500">
						{`${selectedSlice + 1} / ${selectedVolume.frames}`}
					</div>
				)}

				{renderPrediction()}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedOct!.file.name}</div>}
		</div>
	);
};

export default OctViewer;
