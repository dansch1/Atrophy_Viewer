import type { SliceAnnotations, VolumeAnnotations } from "@/api/annotation";
import { fetchModels, type ModelData } from "@/api/model";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { FundusData, VolumeData } from "@/lib/dicom";
import { LabelColors } from "@/lib/labelColors";
import { showError } from "@/lib/toast";
import { useEffect, useState } from "react";
import { usePersistentModelColors } from "./usePersistentModelColors";

export type DicomPair = {
	volume: VolumeData;
	fundus?: FundusData;
};

export type ModelColors = {
	[modelName: string]: LabelColors;
};

export type ViewerState = {
	dicomPairs: DicomPair[];
	setDicomPairs: (files: DicomPair[]) => void;
	selectedPair: number;
	setSelectedPair: (index: number) => void;
	selectedVolume?: VolumeData;
	selectedFundus?: FundusData;
	selectedSlice: number;
	setSelectedSlice: (index: number) => void;
	models: ModelData[];
	setModels: (models: ModelData[]) => void;
	loadingModels: boolean;
	setLoadingModels: (value: boolean) => void;
	selectedModel?: string;
	setSelectedModel: (model: string) => void;
	viewMode: "fundus" | "slice" | "both";
	setViewMode: (mode: "fundus" | "slice" | "both") => void;
	showSlices: boolean;
	setShowSlices: (value: boolean) => void;
	annotations: Map<string, Map<number, VolumeAnnotations>>;
	setAnnotations: React.Dispatch<React.SetStateAction<Map<string, Map<number, VolumeAnnotations>>>>;
	loadingAnnotations: Map<string, Set<number>>;
	setLoadingAnnotations: React.Dispatch<React.SetStateAction<Map<string, Set<number>>>>;
	selectedVolumeAnnotations?: VolumeAnnotations;
	selectedSliceAnnotations?: SliceAnnotations;
	showAnnotations: boolean;
	setShowAnnotations: (value: boolean) => void;
	showFilenames: boolean;
	setShowFilenames: (value: boolean) => void;
	modelColors: ModelColors;
	setModelColors: React.Dispatch<React.SetStateAction<ModelColors>>;
	selectedLabelColors: LabelColors;
};

export function useViewerState(): ViewerState {
	const [dicomPairs, setDicomPairs] = useState<DicomPair[]>([]);
	const [selectedPair, setSelectedPair] = useState(0);
	const selectedVolume = dicomPairs[selectedPair]?.volume;
	const selectedFundus = dicomPairs[selectedPair]?.fundus;
	const [selectedSlice, setSelectedSlice] = useState<number>(0);

	const [models, setModels] = useState<ModelData[]>([]);
	const [loadingModels, setLoadingModels] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string>();

	const [viewMode, setViewMode] = useState<"fundus" | "slice" | "both">("slice");
	const [showSlices, setShowSlices] = useState(false);

	const [annotations, setAnnotations] = useState<Map<string, Map<number, VolumeAnnotations>>>(new Map());
	const [loadingAnnotations, setLoadingAnnotations] = useState<Map<string, Set<number>>>(new Map());
	const selectedVolumeAnnotations = selectedModel ? annotations.get(selectedModel)?.get(selectedPair) : undefined;
	const selectedSliceAnnotations = selectedVolumeAnnotations?.[selectedSlice];
	const [showAnnotations, setShowAnnotations] = useState(false);

	const [showFilenames, setShowFilenames] = usePersistentState("viewer:showFilenames", true);
	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");
	const emptyLabelColors = new LabelColors([], []);
	const selectedLabelColors = selectedModel ? modelColors[selectedModel] : emptyLabelColors;

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
			} catch (err: any) {
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
		selectedVolume,
		selectedFundus,
		selectedSlice,
		setSelectedSlice,
		models,
		setModels,
		loadingModels,
		setLoadingModels,
		selectedModel,
		setSelectedModel,
		viewMode,
		setViewMode,
		showSlices,
		setShowSlices,
		annotations,
		setAnnotations,
		loadingAnnotations,
		setLoadingAnnotations,
		selectedVolumeAnnotations,
		selectedSliceAnnotations,
		showAnnotations,
		setShowAnnotations,
		showFilenames,
		setShowFilenames,
		modelColors,
		setModelColors,
		selectedLabelColors,
	};
}
