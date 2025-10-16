import { useViewer } from "@/context/ViewerStateProvider";
import React from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import FundusViewer from "./FundusViewer";
import { LegendBox } from "./LegendBox";
import SliceViewer from "./SliceViewer";
import { ZoomControls } from "./ZoomControls";

const DicomViewer: React.FC = () => {
	const { selectedVolume, selectedSlice, setSelectedSlice } = useViewer();

	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (!selectedVolume || selectedSlice === null) {
			return;
		}

		const dir = e.deltaY > 0 ? -1 : 1;
		const next = Math.max(0, Math.min(selectedVolume.frames - 1, selectedSlice + dir));

		if (next !== selectedSlice) {
			setSelectedSlice(next);
		}
	};

	return (
		<div className="relative w-full h-full" onWheel={handleWheel}>
			<TransformWrapper centerOnInit minScale={0.5} maxScale={5} wheel={{ activationKeys: ["Control", "Meta"] }}>
				<LegendBox />
				<ZoomControls />

				<div className="flex items-center justify-center w-full h-full">
					<TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
						<div className="flex flex-row gap-5 items-center justify-center flex-grow w-full h-full">
							<FundusViewer />
							<SliceViewer />
						</div>
					</TransformComponent>
				</div>
			</TransformWrapper>
		</div>
	);
};

export default DicomViewer;
