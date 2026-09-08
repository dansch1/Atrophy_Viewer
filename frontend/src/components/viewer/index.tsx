import { useViewer } from "@/context/ViewerStateProvider";
import React from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import ToggleLegend from "../ToggleLegend";
import FundusViewer from "./FundusViewer";
import OctViewer from "./OctViewer";
import RasterViewer from "./RasterViewer";
import { ZoomControls } from "./ZoomControls";

const Viewer: React.FC = () => {
	const { selectedExam, selectedVolume, selectedSlice, setSelectedSlice, showDates } = useViewer();

	const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (!selectedVolume || event.ctrlKey || event.metaKey) {
			return;
		}

		const dir = event.deltaY > 0 ? -1 : 1;
		const next = Math.max(0, Math.min(selectedVolume.frames - 1, selectedSlice + dir));

		if (next !== selectedSlice) {
			setSelectedSlice(next);
		}
	};

	return (
		<div className="relative w-full h-full" onWheel={handleWheel}>
			<TransformWrapper centerOnInit minScale={0.5} maxScale={5} wheel={{ activationKeys: ["Control", "Meta"] }}>
				<ToggleLegend variant="overlay" />
				<ZoomControls />

				{showDates && selectedExam?.examDate && (
					<div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-background rounded-md border shadow text-sm md:text-base font-medium">
						{selectedExam.examDate.toDateString()}
					</div>
				)}

				<div className="flex items-center justify-center w-full h-full">
					<TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
						<div className="flex flex-row gap-5 items-center justify-center flex-grow w-full h-full">
							<FundusViewer />
							<OctViewer />
							<RasterViewer />
						</div>
					</TransformComponent>
				</div>
			</TransformWrapper>
		</div>
	);
};

export default Viewer;
