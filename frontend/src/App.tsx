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
	const { dicomPairs, setDicomPairs, setSelectedPair, setAnnotations } = useViewer();

	const handleUpload = async (files: FileList) => {
		const fileArray = Array.from(files);

		const parsed: (DicomMetadata | null)[] = await Promise.all(
			fileArray.map(async (file) => {
				try {
					return await getDicomMetadata(file);
				} catch (err) {
					console.error("Failed to read DICOM metadata", { file, err });
					return null;
				}
			})
		);

		const valid = parsed.filter((d): d is DicomMetadata => d !== null);

		if (valid.length === 0) {
			showError("Parsing failed", "No valid DICOM files found.");
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
			showError(
				"No matching fundus/volume pairs found",
				"Each volume must have a corresponding fundus image with the same StudyInstanceUID."
			);

			return;
		}

		setDicomPairs(matched);
		setAnnotations({});
		setSelectedPair(0);

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
