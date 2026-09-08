import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import React, { useEffect, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Toaster } from "sonner";
import Controls from "./components/Controls";
import { GlobalLoader } from "./components/GlobalLoader";
import Header from "./components/Header";
import ResearchBanner from "./components/ResearchBanner";
import Statistics from "./components/statistics";
import Viewer from "./components/viewer";
import { useViewer } from "./context/ViewerStateProvider";

const App: React.FC = () => {
	const { currentExams, showStats, setShowStats } = useViewer();
	const statsPanelRef = useRef<ImperativePanelHandle>(null);

	useEffect(() => {
		const panel = statsPanelRef.current;
		if (!panel) {
			return;
		}

		if (showStats) {
			panel.expand();
		} else {
			panel.collapse();
		}
	}, [showStats]);

	return (
		<div>
			<GlobalLoader />
			<Toaster position="top-center" />

			<div className="flex flex-col h-screen">
				<ResearchBanner />
				<Header />

				<main className="flex-1 overflow-hidden">
					{currentExams.length > 0 ? (
						<ResizablePanelGroup direction="horizontal">
							<ResizablePanel defaultSize={100} minSize={40}>
								<Viewer />
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
							No images loaded. Please upload DICOM or image files.
						</div>
					)}
				</main>

				<Controls />
			</div>
		</div>
	);
};

export default App;
