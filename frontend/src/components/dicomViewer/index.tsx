import { useViewer } from "@/context/ViewerStateProvider";
import { showError } from "@/lib/toast";
import { getDicomPixelData, type DicomPixelData } from "@/utils/dicom";
import React, { useEffect, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import FundusViewer from "./FundusViewer";
import { LegendBox } from "./LegendBox";
import SliceViewer from "./SliceViewer";
import { ZoomControls } from "./ZoomControls";

const DicomViewer: React.FC = () => {
	const { dicomPairs, selectedPair } = useViewer();

	const [fundusData, setFundusData] = useState<DicomPixelData | null>(null);
	const [volumeData, setVolumeData] = useState<DicomPixelData | null>(null);

	const currentPair = dicomPairs[selectedPair];

	useEffect(() => {
		const loadData = async () => {
			if (!currentPair?.fundus || !currentPair?.volume) {
				setFundusData(null);
				setVolumeData(null);
				return;
			}

			const files = [
				{ label: "Fundus", file: currentPair.fundus, set: setFundusData },
				{ label: "Volume", file: currentPair.volume, set: setVolumeData },
			];

			const results = await Promise.allSettled(files.map((f) => getDicomPixelData(f.file)));

			results.forEach((result, i) => {
				const { label, file, set } = files[i];

				if (result.status === "fulfilled") {
					set(result.value);
				} else {
					set(null);

					console.error("Failed to read DICOM pixel data", { file, err: result.reason });
					showError("Parsing failed", `Failed to load ${label.toLowerCase()} image: ${file.name}`);
				}
			});
		};

		loadData();
	}, [dicomPairs, selectedPair]);

	return (
		<div className="relative w-full h-full">
			<TransformWrapper centerOnInit minScale={0.5} maxScale={5}>
				<LegendBox />
				<ZoomControls />

				<div className="flex items-center justify-center w-full h-full">
					<TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
						<div className="flex flex-row gap-5 items-center justify-center flex-grow w-full h-full">
							<FundusViewer fundusData={fundusData} volumeData={volumeData} />
							<SliceViewer volumeData={volumeData} />
						</div>
					</TransformComponent>
				</div>
			</TransformWrapper>
		</div>
	);
};

export default DicomViewer;
