import * as dicomParser from "dicom-parser";
import React, { useState } from "react";
import { toast, Toaster } from "sonner";
import Controls from "./components/Controls";
import DicomViewer from "./components/DicomViewer";
import Header from "./components/Header";
import { useViewerState } from "./hooks/useViewerState";

const App: React.FC = () => {
	const [dicomFiles, setDicomFiles] = useState<DicomPair[]>([]);
	const viewerState = useViewerState();

	type DicomPair = {
		volume: File;
		fundus: File;
	};

	const currentPair = dicomFiles[viewerState.selectedIndex] || null;

	const getDicomMetadata = async (file: File) => {
		const arrayBuffer = await file.arrayBuffer();
		const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

		return {
			file,
			frames: Number(dataSet.intString("x00280008") || 1),
			studyInstanceUID: dataSet.string("x0020000d"),
		};
	};

	const handleUpload = async (files: FileList) => {
		const fileArray = Array.from(files);
		const parsed = await Promise.all(fileArray.map(getDicomMetadata));

		// TODO
		const volumeFiles = parsed.filter((d) => d && d.frames > 1);
		const fundusFiles = parsed.filter((d) => d && d.frames === 1);

		const matched: { volume: File; fundus: File }[] = [];

		for (const vol of volumeFiles) {
			const match = fundusFiles.find(
				(fun) => fun.studyInstanceUID && vol.studyInstanceUID && fun.studyInstanceUID === vol.studyInstanceUID
			);

			if (match) {
				matched.push({ volume: vol.file, fundus: match.file });
			}
		}

		if (matched.length === 0) {
			console.error("No matching fundus/volume pairs found", {
				volumeFiles,
				fundusFiles,
			});
			toast.error("No matching fundus/volume pairs found", {
				description: "Each volume must have a corresponding fundus image with the same StudyInstanceUID.",
			});

			return;
		}

		setDicomFiles(matched);
		viewerState.setSelectedIndex(0);
	};

	return (
		<div>
			<Toaster position="top-center" />
			<div className="flex flex-col h-screen">
				<Header onFileUpload={handleUpload} />
				<main className="flex-1">
					{currentPair ? (
						<DicomViewer
							fundusFile={currentPair.fundus}
							volumeFile={currentPair.volume}
							viewerState={viewerState}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
							No DICOM files loaded. Please upload a fundus/volume pair.
						</div>
					)}
				</main>
				<Controls files={dicomFiles.map((p) => p.volume)} viewerState={viewerState} />
			</div>
		</div>
	);
};

export default App;
