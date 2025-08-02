import { useState } from "react";

export type ViewerState = {
	showSlices: boolean;
	setShowSlices: (value: boolean) => void;
	selectedIndex: number;
	setSelectedIndex: (index: number) => void;
	showAnnotations: boolean;
	setShowAnnotations: (value: boolean) => void;
	annotationCache: Record<number, any>;
	setAnnotationCache: React.Dispatch<React.SetStateAction<Record<number, any>>>;
};

export function useViewerState() {
	const [showSlices, setShowSlices] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showAnnotations, setShowAnnotations] = useState(false);
	const [annotationCache, setAnnotationCache] = useState<Record<number, any>>({});

	return {
		showSlices,
		setShowSlices,
		selectedIndex,
		setSelectedIndex,
		showAnnotations,
		setShowAnnotations,
		annotationCache,
		setAnnotationCache,
	};
}
