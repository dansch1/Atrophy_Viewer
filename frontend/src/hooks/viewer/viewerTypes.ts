import type { ModelInfo, ModelMap } from "@/api/model";
import type { Prediction, PredictionResult } from "@/api/prediction";
import type { BscanData, DicomLaterality, FundusData, VolumeData } from "@/lib/dicom";
import type { FileData, RasterData } from "@/lib/images";
import type { ModelColors } from "@/lib/modelColors";
import type { PostprocConfig } from "@/lib/postprocess";
import type { Dispatch, SetStateAction } from "react";

export type Laterality = DicomLaterality | "U";
export type ViewMode = "fundus" | "oct" | "both";

export type ImageExam = {
	examId: string;
	examDate?: Date;
	fundus: FundusData[];
	bscans: BscanData[];
	volumes: VolumeData[];
	rasters: RasterData[];
};

export type ImageExamsByLat = Record<string, Record<Laterality, ImageExam[]>>;
export type PredictionMap = Map<string, Map<string, PredictionResult>>;

export type ViewerState = {
	// Images
	imageExams: ImageExamsByLat;
	loadImages: (files: FileList) => Promise<void>;

	// Patients
	patientInfo: Map<string, string>;
	selectedPatient?: string;
	setSelectedPatient: (id: string) => void;

	// Laterality
	selectedLaterality: Laterality;
	setSelectedLaterality: (lat: Laterality) => void;

	// Exams
	currentExams: ImageExam[];
	selectedExamIndex: number;
	setSelectedExamIndex: (index: number) => void;
	selectedExam?: ImageExam;

	// Selected images
	selectedEyeImages: FileData[];
	setSelectedImages: (images: FileData[]) => void;

	selectedFundus?: FundusData;
	selectedVolume?: VolumeData;
	selectedOct?: VolumeData | BscanData;
	selectedRaster?: RasterData;

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
	predictions: PredictionMap;
	loadingPredictions: Map<string, Set<string>>;

	// Predictions (processed)
	processedPredictions: PredictionMap;
	processedFundusPrediction?: Prediction;
	processedVolumePrediction?: PredictionResult;
	processedOctPrediction?: Prediction;
	processedRasterPrediction?: Prediction;

	// Prediction controller
	showPredictions: boolean;
	setShowPredictions: (value: boolean) => void;
	predictImages: (images: FileData[]) => Promise<boolean[]>;

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
