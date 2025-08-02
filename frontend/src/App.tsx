import React, { useState } from "react";
import * as dicomParser from "dicom-parser";
import Header from "./components/Header";
import DicomViewer from "./components/DicomViewer";
import Controls from "./components/Controls";
import { toast, Toaster } from "sonner";

const App: React.FC = () => {
	const [dicomFiles, setDicomFiles] = useState<DicomPair[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showSlices, setShowSlices] = useState(false);

	type DicomPair = {
		volume: File;
		enface: File;
	};

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
		const volumes = parsed.filter((d) => d && d.frames > 1);
		const enfaces = parsed.filter((d) => d && d.frames === 1);

		const matched: { volume: File; enface: File }[] = [];

		for (const vol of volumes) {
			const match = enfaces.find(
				(ef) => ef.studyInstanceUID && vol.studyInstanceUID && ef.studyInstanceUID === vol.studyInstanceUID
			);

			if (match) {
				matched.push({ volume: vol.file, enface: match.file });
			}
		}

		if (matched.length === 0) {
			toast.error("No matching enface/volume pairs found", {
				description: "Each volume must have a corresponding enface image with the same StudyInstanceUID.",
			});
			return;
		}

		setDicomFiles(matched);
		setSelectedIndex(0);
	};

	return (
		<div>
			<Toaster position="top-center" />
			<div className="flex flex-col h-screen">
				<Header onFileUpload={handleUpload} />
				<main className="flex-1">
					<DicomViewer
						enfaceFile={dicomFiles[selectedIndex]?.enface || null}
						volumeFile={dicomFiles[selectedIndex]?.volume || null}
						showSlices={showSlices}
					/>
				</main>
				<Controls
					files={dicomFiles.map((p) => p.volume)}
					selectedIndex={selectedIndex}
					setSelectedIndex={setSelectedIndex}
					showSlices={showSlices}
					setShowSlices={setShowSlices}
				/>
			</div>
		</div>
	);
};

export default App;
