import { useViewerState } from "@/hooks/viewer/useViewerState";
import type { ViewerState } from "@/hooks/viewer/viewerTypes";
import React, { createContext, useContext } from "react";

const ViewerStateContext = createContext<ViewerState | null>(null);

export const ViewerStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const viewerState = useViewerState();
	return <ViewerStateContext.Provider value={viewerState}>{children}</ViewerStateContext.Provider>;
};

export const useViewer = (): ViewerState => {
	const context = useContext(ViewerStateContext);

	if (!context) {
		throw new Error("useViewer must be used within a ViewerStateProvider");
	}

	return context;
};
