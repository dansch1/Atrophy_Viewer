import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import React, { useEffect, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Toaster } from "sonner";
import Controls from "./components/Controls";
import DicomViewer from "./components/dicomViewer";
import { GlobalLoader } from "./components/GlobalLoader";
import Header from "./components/Header";
import Statistics from "./components/statistics";
import { useViewer } from "./context/ViewerStateProvider";

const App: React.FC = () => {
	const { currentPairs, showStats, setShowStats } = useViewer();

	const statsPanelRef = useRef<ImperativePanelHandle>(null);

	useEffect(() => {
		if (!statsPanelRef) {
			return;
		}

		if (showStats) {
			statsPanelRef.current?.expand();
		} else {
			statsPanelRef.current?.collapse();
		}
	}, [showStats]);

	return (
		<div>
			<GlobalLoader />
			<Toaster position="top-center" />

			<div className="flex flex-col h-screen">
				<Header />
				<main className="flex-1 overflow-hidden">
					{currentPairs.length > 0 ? (
						<ResizablePanelGroup direction="horizontal">
							<ResizablePanel defaultSize={100} minSize={40}>
								<DicomViewer />
							</ResizablePanel>

							<ResizableHandle withHandle />

							<ResizablePanel
								ref={statsPanelRef}
								defaultSize={0}
								minSize={30}
								collapsible
								onCollapse={() => setShowStats(false)}
								onExpand={() => setShowStats(true)}
							>
								<Statistics />
							</ResizablePanel>
						</ResizablePanelGroup>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
							No DICOM files loaded. Please upload at least one OCT volume scan (fundus optional).
						</div>
					)}
				</main>
				<Controls />
			</div>
		</div>
	);
};

export default App;
