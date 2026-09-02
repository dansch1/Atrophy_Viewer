import type { ModelInfo, ModelMap } from "@/api/model";
import type { SlicePrediction, VolumePrediction } from "@/api/prediction";
import type { FundusData, VolumeData } from "@/lib/dicom";
import type { ModelColors } from "@/lib/modelColors";
import type { PostprocConfig } from "@/lib/postprocess";
import type { Dispatch, SetStateAction } from "react";

export type DicomPair = { volume: VolumeData; fundus?: FundusData };
export type Laterality = "L" | "R";
export type DicomPairsByLaterality = Record<string, { L: DicomPair[]; R: DicomPair[] }>;

export type ViewMode = "fundus" | "slice" | "both";

export type ViewerState = {
	// Pairs
	dicomPairs: DicomPairsByLaterality;
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
	models: ModelMap;
	selectedModel?: string;
	selectedModelInfo?: ModelInfo;
	setSelectedModel: (model: string) => void;

	// Classes
	selectedModelClasses?: string[];
	hiddenClasses: Set<number>;
	setHiddenClasses: Dispatch<SetStateAction<Set<number>>>;

	// Predictions (raw)
	predictions: Map<string, Map<string, VolumePrediction>>;
	loadingPredictions: Map<string, Set<string>>;

	// Predictions (processed)
	processedPredictions: Map<string, Map<string, VolumePrediction>>;
	processedVolumePrediction?: VolumePrediction;
	processedSlicePrediction?: SlicePrediction;

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

	selectedPostprocConfig?: PostprocConfig;
	setSelectedPostprocConfig: (update: SetStateAction<PostprocConfig>) => void;

	modelColors: Record<string, ModelColors>;
	setModelColors: Dispatch<SetStateAction<Record<string, ModelColors>>>;
	selectedModelColors: ModelColors;
};
