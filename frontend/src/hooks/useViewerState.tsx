import { usePersistentState } from "@/hooks/usePersistentState";
import { LabelColors } from "@/lib/labelColors";
import { showError } from "@/lib/toast";
import type { VolumeAnnotations } from "@/services/annotation";
import { fetchModels, type ModelData } from "@/services/model";
import { useEffect, useState } from "react";
import { usePersistentModelColors } from "./usePersistentModelColors";

export type DicomPair = {
	volume: File;
	fundus: File;
};

export type ModelColors = {
	[modelName: string]: LabelColors;
};

export type ViewerState = {
	dicomPairs: DicomPair[];
	setDicomPairs: (files: DicomPair[]) => void;
	selectedPair: number;
	setSelectedPair: (index: number) => void;
	selectedSlice: number | null;
	setSelectedSlice: (index: number | null) => void;
	showSlices: boolean;
	setShowSlices: (value: boolean) => void;
	annotations: Record<number, VolumeAnnotations>;
	setAnnotations: React.Dispatch<React.SetStateAction<Record<number, VolumeAnnotations>>>;
	loadingAnnotations: Set<number>;
	setLoadingAnnotations: React.Dispatch<React.SetStateAction<Set<number>>>;
	showAnnotations: boolean;
	setShowAnnotations: (value: boolean) => void;
	showFilenames: boolean;
	setShowFilenames: (value: boolean) => void;
	models: ModelData[];
	setModels: (models: ModelData[]) => void;
	loadingModels: boolean;
	setLoadingModels: (value: boolean) => void;
	selectedModel: string | null;
	setSelectedModel: (model: string) => void;
	modelColors: ModelColors;
	setModelColors: React.Dispatch<React.SetStateAction<ModelColors>>;
};

export function useViewerState(): ViewerState {
	const [dicomPairs, setDicomPairs] = useState<DicomPair[]>([]);
	const [selectedPair, setSelectedPair] = useState(0);

	const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
	const [showSlices, setShowSlices] = useState(false);

	const [annotations, setAnnotations] = useState<Record<number, any>>({});
	const [loadingAnnotations, setLoadingAnnotations] = useState<Set<number>>(new Set());
	const [showAnnotations, setShowAnnotations] = useState(false);

	const [showFilenames, setShowFilenames] = usePersistentState("viewer:showFilenames", true);

	const [models, setModels] = useState<ModelData[]>([]);
	const [loadingModels, setLoadingModels] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string | null>(null);
	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");

	useEffect(() => {
		const loadModels = async () => {
			setLoadingModels(true);

			try {
				const modelData = await fetchModels();
				setModels(modelData);

				setModelColors((prev) => {
					const updated = { ...prev };

					for (const { name, classes } of modelData) {
						if (!updated[name]) {
							updated[name] = new LabelColors(classes);
							continue;
						}

						for (let i = 0; i < classes.length; i++) {
							if (updated[name].getColorByIndex(i) === undefined) {
								updated[name].setColorByIndex(i);
							}
						}
					}

					return updated;
				});
			} catch (err) {
				console.error("Model request failed", err);
				showError("Model error", "Failed to load the models. Please reload the page or try again later.");
			} finally {
				setLoadingModels(false);
			}
		};

		loadModels();
	}, []);

	return {
		dicomPairs,
		setDicomPairs,
		selectedPair,
		setSelectedPair,
		selectedSlice,
		setSelectedSlice,
		showSlices,
		setShowSlices,
		annotations,
		setAnnotations,
		loadingAnnotations,
		setLoadingAnnotations,
		showAnnotations,
		setShowAnnotations,
		showFilenames,
		setShowFilenames,
		models,
		setModels,
		loadingModels,
		setLoadingModels,
		selectedModel,
		setSelectedModel,
		modelColors,
		setModelColors,
	};
}
