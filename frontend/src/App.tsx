import React from "react";
import { Toaster } from "sonner";
import Controls from "./components/Controls";
import DicomViewer from "./components/dicomViewer";
import { GlobalLoader } from "./components/GlobalLoader";
import Header from "./components/Header";
import { useViewer } from "./context/ViewerStateProvider";

const App: React.FC = () => {
	const { dicomPairs } = useViewer();

	return (
		<div>
			<GlobalLoader />
			<Toaster position="top-center" />

			<div className="flex flex-col h-screen">
				<Header />
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
