import { useViewer } from "@/context/ViewerStateProvider";
import type { DicomPixelData } from "@/utils/dicom";
import { renderImage } from "@/utils/image";
import React, { useEffect, useRef } from "react";

type Props = {
	fundusData: DicomPixelData | null;
	volumeData: DicomPixelData | null;
};

const FundusViewer: React.FC<Props> = ({ fundusData, volumeData }) => {
	const { dicomPairs, selectedPair, selectedSlice, setSelectedSlice, showSlices, showFilenames } = useViewer();

	const imgCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		setSelectedSlice(null);
	}, [dicomPairs, selectedPair]);

	useEffect(() => {
		if (!showSlices) {
			setSelectedSlice(null);
		}
	}, [showSlices]);

	useEffect(() => {
		const renderFundus = () => {
			if (!fundusData || !imgCanvasRef.current) {
				return;
			}

			const { cols, rows, pixelData } = fundusData;
			renderImage(pixelData, cols, rows, imgCanvasRef.current);
		};

		renderFundus();
	}, [fundusData]);

	if (!fundusData) {
		return null;
	}

	return (
		<div className="flex flex-col items-center">
			<div className="relative">
				<canvas ref={imgCanvasRef} />
				{volumeData && showSlices && (
					<svg className="absolute top-0 left-0 w-full h-full">
						{Array.from({ length: volumeData.frames }).map((_, i) => {
							const y = `${(i / volumeData.frames) * 100}%`;

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

			{showFilenames && (
				<div className="text-sm text-muted-foreground mt-1">
					{dicomPairs[selectedPair]?.fundus?.name ?? "Unknown fundus file"}
				</div>
			)}
		</div>
	);
};

export default FundusViewer;
