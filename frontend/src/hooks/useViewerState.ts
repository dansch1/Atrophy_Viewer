import type { SliceAnnotations, VolumeAnnotations } from "@/api/annotation";
import { fetchModels } from "@/api/model";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { FundusData, VolumeData } from "@/lib/dicom";
import { ModelColors } from "@/lib/modelColors";
import { showError } from "@/lib/toast";
import { clamp } from "@/lib/utils";
import { useEffect, useMemo, useReducer, useState, type Dispatch, type SetStateAction } from "react";
import { usePersistentModelColors } from "./usePersistentModelColors";

export type DicomPair = { volume: VolumeData; fundus?: FundusData };
export type Laterality = "L" | "R";
export type DicomPairsByLaterality = Record<string, { L: DicomPair[]; R: DicomPair[] }>;

export type ViewMode = "fundus" | "slice" | "both";

export type ViewerState = {
	dicomPairs: DicomPairsByLaterality;
	setDicomPairs: (files: DicomPairsByLaterality) => void;

	patientInfo: Map<string, string>;
	selectedPatient?: string;
	setSelectedPatient: (id: string) => void;

	selectedLaterality: Laterality;
	setSelectedLaterality: (lat: Laterality) => void;

	currentPairs: DicomPair[];
	selectedPair: number;
	setSelectedPair: (index: number) => void;

	selectedVolume?: VolumeData;
	selectedFundus?: FundusData;

	selectedSlice: number;
	setSelectedSlice: (index: number) => void;

	viewMode: ViewMode;
	setViewMode: (mode: ViewMode) => void;

	showSlices: boolean;
	setShowSlices: (value: boolean) => void;

	models: Map<string, string[]>;
	setModels: Dispatch<SetStateAction<Map<string, string[]>>>;
	selectedModel?: string;
	setSelectedModel: (model: string) => void;
	loadingModels: boolean;
	setLoadingModels: (value: boolean) => void;
	selectedModelLabels?: string[];

	annotations: Map<string, Map<string, VolumeAnnotations>>;
	setAnnotations: Dispatch<SetStateAction<Map<string, Map<string, VolumeAnnotations>>>>;
	loadingAnnotations: Map<string, Set<string>>;
	setLoadingAnnotations: Dispatch<SetStateAction<Map<string, Set<string>>>>;
	selectedVolumeAnnotations?: VolumeAnnotations;
	selectedSliceAnnotations?: SliceAnnotations;

	showAnnotations: boolean;
	setShowAnnotations: (value: boolean) => void;
	showStats: boolean;
	setShowStats: (value: boolean) => void;

	showDates: boolean;
	setShowDates: (value: boolean) => void;
	showFilenames: boolean;
	setShowFilenames: (value: boolean) => void;

	modelColors: Record<string, ModelColors>;
	setModelColors: Dispatch<SetStateAction<Record<string, ModelColors>>>;
	selectedModelColors: ModelColors;
};

type NavState = {
	dicomPairs: DicomPairsByLaterality;
	selectedPatient?: string;
	selectedLaterality: Laterality;
	selectedPair: number;
	selectedSlice: number;
	viewMode: ViewMode;
	showSlices: boolean;
	showAnnotations: boolean;
};

type Action =
	| { type: "SET_DICOM_PAIRS"; payload: DicomPairsByLaterality }
	| { type: "SET_PATIENT"; payload: string }
	| { type: "SET_LATERALITY"; payload: Laterality }
	| { type: "SET_PAIR"; payload: number }
	| { type: "SET_SLICE"; payload: number }
	| { type: "SET_VIEWMODE"; payload: ViewMode }
	| { type: "SET_SHOW_SLICES"; payload: boolean }
	| { type: "SET_SHOW_ANNOTATIONS"; payload: boolean }
	| { type: "RESET_WITHIN_PATIENT" };

const initialNavState: NavState = {
	dicomPairs: {},
	selectedPatient: undefined,
	selectedLaterality: "L",
	selectedPair: 0,
	selectedSlice: 0,
	viewMode: "slice",
	showSlices: false,
	showAnnotations: false,
};

function firstAvailableLaterality(map: DicomPairsByLaterality, pid?: string): Laterality {
	return !pid || !map[pid] || map[pid].L.length > 0 ? "L" : "R";
}

function reducer(state: NavState, action: Action): NavState {
	switch (action.type) {
		case "SET_DICOM_PAIRS": {
			const dicomPairs = action.payload;
			const patientIds = Object.keys(dicomPairs);
			const selectedPatient = patientIds.includes(state.selectedPatient ?? "")
				? state.selectedPatient
				: patientIds[0];

			const selectedLaterality = firstAvailableLaterality(dicomPairs, selectedPatient);

			return {
				...state,
				dicomPairs,
				selectedPatient,
				selectedLaterality,
				selectedPair: 0,
				selectedSlice: 0,
				viewMode: "slice",
				showSlices: false,
				showAnnotations: false,
			};
		}

		case "SET_PATIENT": {
			const selectedPatient = action.payload;
			const selectedLaterality = firstAvailableLaterality(state.dicomPairs, selectedPatient);

			return {
				...state,
				selectedPatient,
				selectedLaterality,
				selectedPair: 0,
				selectedSlice: 0,
				showAnnotations: false,
			};
		}

		case "SET_LATERALITY": {
			const lat = action.payload;

			return {
				...state,
				selectedLaterality: lat,
				selectedPair: 0,
				selectedSlice: 0,
				showAnnotations: false,
			};
		}

		case "SET_PAIR": {
			const len = state.selectedPatient
				? state.dicomPairs[state.selectedPatient][state.selectedLaterality].length
				: 0;

			return { ...state, selectedPair: clamp(action.payload, 0, Math.max(0, len - 1)) };
		}

		case "SET_SLICE":
			return { ...state, selectedSlice: Math.max(0, action.payload) };

		case "SET_VIEWMODE":
			return { ...state, viewMode: action.payload };

		case "SET_SHOW_SLICES":
			return { ...state, showSlices: action.payload };

		case "SET_SHOW_ANNOTATIONS":
			return { ...state, showAnnotations: action.payload };

		case "RESET_WITHIN_PATIENT":
			return {
				...state,
				selectedPair: 0,
				selectedSlice: 0,
				showAnnotations: false,
			};

		default:
			return state;
	}
}

export function useViewerState(): ViewerState {
	const [models, setModels] = useState<Map<string, string[]>>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>();
	const [loadingModels, setLoadingModels] = useState(false);
	const selectedModelLabels = selectedModel ? models.get(selectedModel) : undefined;

	const [annotations, setAnnotations] = useState<Map<string, Map<string, VolumeAnnotations>>>(new Map());
	const [loadingAnnotations, setLoadingAnnotations] = useState<Map<string, Set<string>>>(new Map());
	const [showStats, setShowStats] = useState(false);

	const [showDates, setShowDates] = usePersistentState("viewer:showDates", true);
	const [showFilenames, setShowFilenames] = usePersistentState("viewer:showFilenames", true);
	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");

	const emptyLabelColors = useMemo(() => new ModelColors([], []), []);
	const selectedModelColors = selectedModel ? modelColors[selectedModel] : emptyLabelColors;

	const [nav, dispatch] = useReducer(reducer, initialNavState);

	const patientInfo = useMemo(() => {
		const map = new Map<string, string>();

		for (const [patientID, scans] of Object.entries(nav.dicomPairs)) {
			const allPairs = [...scans.L, ...scans.R];
			const volumeWithName = allPairs.map((p) => p.volume).find((v) => v.patientName);

			const name = volumeWithName?.patientName ?? `Unknown (${patientID})`;
			map.set(patientID, name);
		}

		return map;
	}, [nav.dicomPairs]);

	const currentPairs = useMemo(() => {
		if (!nav.selectedPatient) {
			return [];
		}

		return nav.dicomPairs[nav.selectedPatient]?.[nav.selectedLaterality] ?? [];
	}, [nav.dicomPairs, nav.selectedPatient, nav.selectedLaterality]);

	const selectedVolume = currentPairs[nav.selectedPair]?.volume;
	const selectedFundus = currentPairs[nav.selectedPair]?.fundus;

	const selectedVolumeAnnotations = selectedModel
		? annotations.get(selectedModel)?.get(selectedVolume.sopInstanceUID)
		: undefined;
	const selectedSliceAnnotations = selectedVolumeAnnotations?.[nav.selectedSlice];

	useEffect(() => {
		const loadModels = async () => {
			setLoadingModels(true);

			try {
				const map = await fetchModels();
				setModels(map);

				setModelColors((prev) => {
					const updated = { ...prev };

					for (const [name, classes] of map) {
						if (!updated[name]) {
							updated[name] = new ModelColors(classes);
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
		// Files
		dicomPairs: nav.dicomPairs,
		setDicomPairs: (files) => dispatch({ type: "SET_DICOM_PAIRS", payload: files }),

		// Patients
		patientInfo,
		selectedPatient: nav.selectedPatient,
		setSelectedPatient: (id) => dispatch({ type: "SET_PATIENT", payload: id }),

		// Laterality
		selectedLaterality: nav.selectedLaterality,
		setSelectedLaterality: (lat) => dispatch({ type: "SET_LATERALITY", payload: lat }),

		// Pairs/Slices
		currentPairs,
		selectedPair: nav.selectedPair,
		setSelectedPair: (i) => dispatch({ type: "SET_PAIR", payload: i }),

		selectedVolume,
		selectedFundus,

		selectedSlice: nav.selectedSlice,
		setSelectedSlice: (i) => dispatch({ type: "SET_SLICE", payload: i }),

		// View
		viewMode: nav.viewMode,
		setViewMode: (m) => dispatch({ type: "SET_VIEWMODE", payload: m }),

		showSlices: nav.showSlices,
		setShowSlices: (v) => dispatch({ type: "SET_SHOW_SLICES", payload: v }),

		// Models
		models,
		setModels,
		selectedModel,
		setSelectedModel,
		loadingModels,
		setLoadingModels,
		selectedModelLabels,

		// Annotations
		annotations,
		setAnnotations,
		loadingAnnotations,
		setLoadingAnnotations,
		selectedVolumeAnnotations,
		selectedSliceAnnotations,

		showAnnotations: nav.showAnnotations,
		setShowAnnotations: (v) => dispatch({ type: "SET_SHOW_ANNOTATIONS", payload: v }),
		showStats,
		setShowStats,

		// Settings
		showDates,
		setShowDates,
		showFilenames,
		setShowFilenames,
		modelColors,
		setModelColors,
		selectedModelColors,
	};
}
