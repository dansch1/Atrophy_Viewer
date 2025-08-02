import * as dicomParser from "dicom-parser";
import React, { useState } from "react";
import { toast, Toaster } from "sonner";
import Controls from "./components/Controls";
import DicomViewer from "./components/DicomViewer";
import Header from "./components/Header";
import { useViewerState } from "./hooks/useViewerState";

const App: React.FC = () => {
	type DicomPair = {
		volume: File;
		fundus: File;
	};

	type DicomMetadata = {
		file: File;
		frames: number;
		studyInstanceUID: string;
	};

	const [dicomFiles, setDicomFiles] = useState<DicomPair[]>([]);
	const viewerState = useViewerState();

	const { selectedIndex, setSelectedIndex, setAnnotationCache } = viewerState;

	const currentPair = dicomFiles[selectedIndex] || null;

	const getDicomMetadata = async (file: File): Promise<DicomMetadata | null> => {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

			const frames = Number(dataSet.intString("x00280008") || 1);
			const studyInstanceUID = dataSet.string("x0020000d");

			if (!studyInstanceUID) return null;

			return {
				file,
				frames,
				studyInstanceUID,
			};
		} catch (err) {
			console.error("Failed to read DICOM metadata", { file, err });

			toast.error("Invalid DICOM file", {
				description: `${file.name || "Unnamed file"} could not be parsed.`,
			});

			return null;
		}
	};

	const handleUpload = async (files: FileList) => {
		const fileArray = Array.from(files);
		const parsed = await Promise.all(fileArray.map(getDicomMetadata));

		const isValidDicom = (d: DicomMetadata | null): d is DicomMetadata => d !== null;
		const valid = parsed.filter(isValidDicom);

		if (valid.length === 0) {
			toast.error("Parsing failed", {
				description: "No valid DICOM files found.",
			});
			return;
		}

		// TODO
		const volumeFiles = valid.filter((d) => d.frames > 1);
		const fundusFiles = valid.filter((d) => d.frames === 1);

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
		setAnnotationCache({});

		setSelectedIndex(0);
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
				<Controls volumeFiles={dicomFiles.map((p) => p.volume)} viewerState={viewerState} />
			</div>
		</div>
	);
};

export default App;
