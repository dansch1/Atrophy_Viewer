import type { ViewerState } from "@/hooks/useViewerState";
import * as dicomParser from "dicom-parser";
import React, { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import { ZoomControls } from "./ZoomControls";

interface DicomViewerProps {
	fundusFile: File;
	volumeFile: File;
	viewerState: ViewerState;
}

const DicomViewer: React.FC<DicomViewerProps> = ({ fundusFile, volumeFile, viewerState }) => {
	type DicomPixelData = {
		rows: number;
		cols: number;
		frames: number;
		pixelData: Uint8Array | Uint16Array;
	};

	const { showSlices } = viewerState;

	const fundusCanvasRef = useRef<HTMLCanvasElement>(null);
	const sliceCanvasRef = useRef<HTMLCanvasElement>(null);

	const [fundusData, setFundusData] = useState<DicomPixelData | null>(null);
	const [volumeData, setVolumeData] = useState<DicomPixelData | null>(null);
	const [selectedSlice, setSelectedSlice] = useState<number | null>(null);

	useEffect(() => {
		const loadData = async () => {
			setFundusData(await getDicomPixelData(fundusFile));
			setVolumeData(await getDicomPixelData(volumeFile));

			setSelectedSlice(null);
		};

		loadData();
	}, [fundusFile, volumeFile]);

	useEffect(() => {
		renderFundus();
	}, [fundusData]);

	useEffect(() => {
		if (!showSlices) {
			setSelectedSlice(null);
		}
	}, [showSlices]);

	useEffect(() => {
		renderSelectedSlice();
	}, [selectedSlice]);

	const getDicomPixelData = async (file: File): Promise<DicomPixelData | null> => {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

			const rows = dataSet.uint16("x00280010");
			const cols = dataSet.uint16("x00280011");
			const frames = Number(dataSet.intString("x00280008") ?? 1);
			const bitsAllocated = dataSet.uint16("x00280100");
			const pixelDataElement = dataSet.elements.x7fe00010;

			if (!pixelDataElement || !rows || !cols) return null;

			const pixelData =
				bitsAllocated === 16
					? new Uint16Array(
							dataSet.byteArray.buffer,
							pixelDataElement.dataOffset,
							pixelDataElement.length / 2
					  )
					: new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

			return { rows, cols, frames, pixelData };
		} catch (err) {
			console.error("DICOM parsing error:", err);
			toast.error("Failed to read DICOM file", {
				description: file?.name,
			});

			return null;
		}
	};

	const renderFundus = () => {
		if (!fundusData || !fundusCanvasRef.current) return;

		const { cols, rows, pixelData } = fundusData;
		renderImage(pixelData, cols, rows, fundusCanvasRef.current);
	};

	const renderSelectedSlice = () => {
		if (!volumeData || selectedSlice === null || !sliceCanvasRef.current) return;

		const { cols, rows, pixelData } = volumeData;
		const frameSize = cols * rows;
		const offset = selectedSlice * frameSize;
		const slice = pixelData.slice(offset, offset + frameSize);

		renderImage(slice, cols, rows, sliceCanvasRef.current);
	};

	const renderImage = (data: ArrayLike<number>, width: number, height: number, canvas: HTMLCanvasElement) => {
		const imageData = normalizeImageData(data, width, height);
		canvas.width = width;
		canvas.height = height;
		canvas.getContext("2d")?.putImageData(imageData, 0, 0);
	};

	const normalizeImageData = (data: ArrayLike<number>, width: number, height: number) => {
		let min = Infinity,
			max = -Infinity;

		for (let i = 0; i < data.length; i++) {
			if (data[i] < min) min = data[i];
			if (data[i] > max) max = data[i];
		}

		const imageData = new ImageData(width, height);

		for (let i = 0; i < width * height; i++) {
			const val = Math.round(((data[i] - min) / (max - min)) * 255);
			imageData.data[i * 4 + 0] = val;
			imageData.data[i * 4 + 1] = val;
			imageData.data[i * 4 + 2] = val;
			imageData.data[i * 4 + 3] = 255;
		}

		return imageData;
	};

	return (
		<div className="relative w-full h-full">
			<TransformWrapper centerOnInit minScale={0.5} maxScale={5}>
				<ZoomControls />

				<div className="absolute inset-0 flex items-center justify-center overflow-hidden">
					<TransformComponent>
						<div className="flex flex-row gap-5 items-center justify-center">
							{fundusData && (
								<div className="relative">
									<canvas ref={fundusCanvasRef} />
									{volumeData && showSlices && (
										<svg className="absolute top-0 left-0 w-full h-full">
											{Array.from({ length: volumeData.frames }).map((_, i) => {
												const y = `${(i / volumeData.frames) * 100}%`;

												return (
													<g key={i} className="group">
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
							)}
							{volumeData && selectedSlice !== null && <canvas ref={sliceCanvasRef} />}
						</div>
					</TransformComponent>
				</div>
			</TransformWrapper>
		</div>
	);
};

export default DicomViewer;
