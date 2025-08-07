import React from "react";
import { Toaster } from "sonner";
import Controls from "./components/Controls";
import DicomViewer from "./components/dicomViewer";
import { GlobalLoader } from "./components/GlobalLoader";
import Header from "./components/Header";
import { useViewer } from "./context/ViewerStateProvider";
import { showError, showSuccess } from "./lib/toast";
import { getDicomMetadata, type DicomMetadata } from "./utils/dicom";

const App: React.FC = () => {
	const { dicomPairs, setDicomPairs, setSelectedIndex, setAnnotations } = useViewer();

	const handleUpload = async (files: FileList) => {
		const fileArray = Array.from(files);

		const parsed = await Promise.all(
			fileArray.map((file) =>
				getDicomMetadata(file).catch((err) => {
					console.error("Failed to read DICOM metadata", { file, err });
					return null;
				})
			)
		);

		const valid = parsed.filter((d): d is DicomMetadata => d !== null);

		if (valid.length === 0) {
			showError("Parsing failed", "No valid DICOM files found.");
			return;
		}

		const volumeFiles = [];
		const fundusFiles = [];

		for (const d of valid) {
			if (d.frames > 1) volumeFiles.push(d);
			else fundusFiles.push(d);
		}

		const volumeMap = new Map(volumeFiles.map((v) => [v.studyInstanceUID, v]));

		const matched = fundusFiles
			.filter((f) => f.studyInstanceUID && volumeMap.has(f.studyInstanceUID))
			.map((f) => ({
				volume: volumeMap.get(f.studyInstanceUID)!,
				fundus: f,
			}));

		if (matched.length === 0) {
			showError(
				"No matching fundus/volume pairs found",
				"Each volume must have a corresponding fundus image with the same StudyInstanceUID."
			);

			return;
		}

		setDicomPairs(matched);
		setAnnotations({});
		setSelectedIndex(0);

		showSuccess("DICOM files loaded successfully", `${matched.length} pair(s) matched.`);
	};

	return (
		<div>
			<GlobalLoader />
			<Toaster position="top-center" />

			<div className="flex flex-col h-screen">
				<Header onFileUpload={handleUpload} />
				<main className="flex-1 overflow-hidden">
					{dicomPairs.length > 0 ? (
						<DicomViewer />
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
							No DICOM files loaded. Please upload a fundus/volume pair.
						</div>
					)}
				</main>
				<Controls />
			</div>
		</div>
	);
};

export default App;
