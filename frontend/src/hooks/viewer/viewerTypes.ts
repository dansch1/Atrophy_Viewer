import type { SlicePredictions, VolumePredictions } from "@/api/prediction";
import type { FundusData, VolumeData } from "@/lib/dicom";
import type { ModelColors } from "@/lib/modelColors";
import type { PostprocessParams } from "@/lib/postprocess";
import type { Dispatch, SetStateAction } from "react";

export type DicomPair = { volume: VolumeData; fundus?: FundusData };
export type Laterality = "L" | "R";
export type DicomPairsByLaterality = Record<string, { L: DicomPair[]; R: DicomPair[] }>;

export type ViewMode = "fundus" | "slice" | "both";

export type ViewerState = {
	// Pairs
	dicomPairs: DicomPairsByLaterality;
	loadingPairs: boolean;
	loadDicomPairs: (files: FileList) => Promise<void>;

	// Patients
	patientInfo: Map<string, string>;
	selectedPatient?: string;
	setSelectedPatient: (id: string) => void;

	// Laterality
	selectedLaterality: Laterality;
	setSelectedLaterality: (lat: Laterality) => void;

	// Pairs
	currentPairs: DicomPair[];
	selectedPair: number;
	setSelectedPair: (index: number) => void;

	selectedVolume?: VolumeData;
	selectedFundus?: FundusData;

	// Slices
	selectedSlice: number;
	setSelectedSlice: (index: number) => void;

	// View
	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;

	showSlices: boolean;
	setShowSlices: (value: boolean) => void;

	// Models
	models: Map<string, string[]>;
	selectedModel?: string;
	setSelectedModel: (model: string) => void;
	loadingModels: boolean;

	// Labels
	selectedModelLabels?: string[];
	hiddenLabels: Set<number>;
	setHiddenLabels: (fn: (prev: Set<number>) => Set<number>) => void;

	// Predictions (raw)
	predictions: Map<string, Map<string, VolumePredictions>>;
	loadingPredictions: Map<string, Set<string>>;

	// Predictions (processed)
	processedPredictions: Map<string, Map<string, VolumePredictions>>;
	processedVolumePredictions?: VolumePredictions;
	processedSlicePredictions?: SlicePredictions;

	// Prediction controller
	showPredictions: boolean;
	setShowPredictions: (value: boolean) => void;
	predictCurrent: () => Promise<boolean>;
	predictAll: () => Promise<boolean[]>;

	// Stats
	showStats: boolean;
	setShowStats: (value: boolean) => void;

	// Settings
	showDates: boolean;
	setShowDates: (value: boolean) => void;
	showFilenames: boolean;
	setShowFilenames: (value: boolean) => void;
	showScores: boolean;
	setShowScores: (value: boolean) => void;

	postParameters: PostprocessParams;
	setPostParameters: Dispatch<SetStateAction<PostprocessParams>>;

	modelColors: Record<string, ModelColors>;
	setModelColors: Dispatch<SetStateAction<Record<string, ModelColors>>>;
	selectedModelColors: ModelColors;
};
