import { useViewer } from "@/context/ViewerStateProvider";
import { renderDicom } from "@/lib/dicom";
import { clamp } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import ClassSliceOverlay from "./overlays/ClassSliceOverlay";
import DetectionSliceOverlay from "./overlays/DetectionSliceOverlay";

const SliceViewer: React.FC = () => {
	const {
		selectedVolume,
		selectedSlice,
		setSelectedSlice,
		viewMode,
		processedSlicePrediction,
		showPredictions,
		showFilenames,
	} = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!selectedVolume || !imgCanvasRef.current) {
			return;
		}

		const maxIdx = Math.max(0, selectedVolume.frames - 1);
		setSelectedSlice(clamp(selectedSlice, 0, maxIdx));

		renderDicom(selectedVolume.images[selectedSlice], imgCanvasRef.current);
	}, [selectedVolume, selectedSlice, viewMode]);

	if (!selectedVolume || viewMode === "fundus") {
		return null;
	}

	const renderPrediction = () => {
		if (!showPredictions || !processedSlicePrediction) {
			return null;
		}

		switch (processedSlicePrediction.kind) {
			case "detection":
				return <DetectionSliceOverlay prediction={processedSlicePrediction} />;
			case "class":
				return <ClassSliceOverlay prediction={processedSlicePrediction} />;
			default:
				return null;
		}
	};

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />

				<div className="absolute top-2 left-3 z-5 text-sm text-center text-green-500">
					{`${selectedSlice + 1} / ${selectedVolume.frames}`}
				</div>

				{renderPrediction()}
			</div>

			{showFilenames && <div className="text-sm text-muted-foreground mt-1">{selectedVolume.file.name}</div>}
		</div>
	);
};

export default SliceViewer;
