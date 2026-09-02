import { fetchModels, type ModelMap } from "@/api/model";
import type { VolumePrediction } from "@/api/prediction";
import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ModelColors } from "@/lib/modelColors";
import { createPostprocConfig, postprocessVolume, type PostprocConfig } from "@/lib/postprocess";
import { showError } from "@/lib/toast";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { usePersistentModelColors } from "../usePersistentModelColors";
import { useDicomImport } from "./useDicomImport";
import { usePredictionsController } from "./usePredictionsController";
import { useViewerNav } from "./useViewerNav";
import type { DicomPairsByLaterality, ViewerState } from "./viewerTypes";

export function useViewerState(): ViewerState {
	const { start, stop } = useGlobalLoader();
	const { nav, dispatch } = useViewerNav();

	// Pairs
	const setDicomPairs = (files: DicomPairsByLaterality) => dispatch({ type: "SET_DICOM_PAIRS", payload: files });
	const loadDicomPairs = useDicomImport(setDicomPairs);

	// Models
	const [models, setModels] = useState<ModelMap>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>();

	const selectedModelInfo = selectedModel ? models.get(selectedModel) : undefined;
	const selectedModelClasses = selectedModelInfo?.classes;
	const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(new Set());

	// Predictions
	const [predictions, setPredictions] = useState<Map<string, Map<string, VolumePrediction>>>(new Map());
	const [loadingPredictions, setLoadingPredictions] = useState<Map<string, Set<string>>>(new Map());

	// Stats
	const [showStats, setShowStats] = useState(false);

	// Settings
	const [showDates, setShowDates] = usePersistentState("viewer:showDates", true);
	const [showFilenames, setShowFilenames] = usePersistentState("viewer:showFilenames", true);
	const [showScores, setShowScores] = usePersistentState("viewer:showScores", false);

	const [postprocessByModel, setPostprocessByModel] = usePersistentState<Record<string, PostprocConfig>>(
		"viewer:postprocessByModel",
		{},
	);

	const selectedPostprocConfig = useMemo(() => {
		if (!selectedModel || !selectedModelInfo) {
			return undefined;
		}

		return postprocessByModel[selectedModel] ?? createPostprocConfig(selectedModelInfo);
	}, [selectedModel, selectedModelInfo, postprocessByModel]);

	const setSelectedPostprocConfig = (update: SetStateAction<PostprocConfig>) => {
		if (!selectedModel || !selectedModelInfo) {
			return;
		}

		setPostprocessByModel((prev) => {
			const current = prev[selectedModel] ?? createPostprocConfig(selectedModelInfo);
			const next = typeof update === "function" ? update(current) : update;

			return {
				...prev,
				[selectedModel]: next,
			};
		});
	};

	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");
	const emptyClassColors = useMemo(() => new ModelColors([], []), []);
	const selectedModelColors = selectedModel ? modelColors[selectedModel] : emptyClassColors;

	// Derived
	// Patients
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

	// Pairs
	const currentPairs = useMemo(() => {
		if (!nav.selectedPatient) {
			return [];
		}

		return nav.dicomPairs[nav.selectedPatient]?.[nav.selectedLaterality] ?? [];
	}, [nav.dicomPairs, nav.selectedPatient, nav.selectedLaterality]);

	const selectedVolume = currentPairs[nav.selectedPair]?.volume;
	const selectedFundus = currentPairs[nav.selectedPair]?.fundus;

	// Predictions (processed)
	const processedPredictions = useMemo(() => {
		const result = new Map<string, Map<string, VolumePrediction>>();

		for (const [modelId, volumes] of predictions) {
			const modelInfo = models.get(modelId);
			if (!modelInfo) {
				continue;
			}

			const settings = postprocessByModel[modelId] ?? createPostprocConfig(modelInfo);
			const processedVolumes = new Map<string, VolumePrediction>();

			for (const [sopInstanceUID, volumePrediction] of volumes) {
				processedVolumes.set(sopInstanceUID, postprocessVolume(volumePrediction, settings));
			}

			result.set(modelId, processedVolumes);
		}

		return result;
	}, [predictions, models, postprocessByModel]);

	const processedVolumePrediction =
		selectedModel && selectedVolume
			? processedPredictions.get(selectedModel)?.get(selectedVolume.sopInstanceUID)
			: undefined;

	const processedSlicePrediction = processedVolumePrediction?.[nav.selectedSlice] ?? undefined;

	// Prediction controller
	const { cancelAllPredictionRequests, hasPrediction, predictCurrent, predictAll } = usePredictionsController({
		currentPairs,
		selectedModel,
		predictions,
		setPredictions,
		loadingPredictions,
		setLoadingPredictions,
	});

	// On new dicomPairs: cancel + reset predictions state
	useEffect(() => {
		cancelAllPredictionRequests();
		setPredictions(() => new Map());
		setLoadingPredictions(() => new Map());
		dispatch({ type: "SET_SHOW_PREDICTIONS", payload: false });
	}, [nav.dicomPairs, cancelAllPredictionRequests, dispatch]);

	// On model change: cancel outstanding requests + hide overlay
	useEffect(() => {
		cancelAllPredictionRequests();
		dispatch({ type: "SET_SHOW_PREDICTIONS", payload: false });
	}, [selectedModel, cancelAllPredictionRequests, dispatch]);

	// Disable overlay if no predictions exist
	useEffect(() => {
		if (!nav.showPredictions) {
			return;
		}

		const model = selectedModel;
		const uid = selectedVolume?.sopInstanceUID;

		const predicted = !!model && !!uid && (hasPrediction(model, uid) || loadingPredictions.get(model)?.has(uid));

		if (!predicted) {
			dispatch({ type: "SET_SHOW_PREDICTIONS", payload: false });
		}
	}, [nav.showPredictions, selectedModel, selectedVolume, hasPrediction, loadingPredictions, dispatch]);

	// Load models once
	useEffect(() => {
		const loadModels = async () => {
			const loaderToken = start("Loading models...");

			try {
				const map = await fetchModels();
				setModels(map);

				setModelColors((prev) => {
					const updated = { ...prev };

					for (const [modelId, modelInfo] of map) {
						const existing = updated[modelId];

						const existingClasses = existing?.toJSON().classes ?? [];
						const classesChanged =
							existingClasses.length !== modelInfo.classes.length ||
							existingClasses.some((className, index) => className !== modelInfo.classes[index]);

						if (!existing || classesChanged) {
							updated[modelId] = new ModelColors(modelInfo.classes);
						}
					}

					return updated;
				});
			} catch (err: any) {
				console.error("Model request failed", err);
				showError("Model error", "Failed to load the models. Please reload the page or try again later.");
			} finally {
				stop(loaderToken);
			}
		};

		void loadModels();
	}, [setModelColors, start, stop]);

	// Reset hidden classes when model changes
	useEffect(() => {
		setHiddenClasses(() => new Set());
	}, [selectedModel]);

	return {
		// Files
		dicomPairs: nav.dicomPairs,
		loadDicomPairs,

		// Patients
		patientInfo,
		selectedPatient: nav.selectedPatient,
		setSelectedPatient: (id) => dispatch({ type: "SET_PATIENT", payload: id }),

		// Laterality
		selectedLaterality: nav.selectedLaterality,
		setSelectedLaterality: (lat) => dispatch({ type: "SET_LATERALITY", payload: lat }),

		// Pairs
		currentPairs,
		selectedPair: nav.selectedPair,
		setSelectedPair: (i) => dispatch({ type: "SET_PAIR", payload: i }),

		selectedVolume,
		selectedFundus,

		// Slices
		selectedSlice: nav.selectedSlice,
		setSelectedSlice: (i) => dispatch({ type: "SET_SLICE", payload: i }),

		// View
		viewMode: nav.viewMode,
		setViewMode: (m) => dispatch({ type: "SET_VIEWMODE", payload: m }),

		showSlices: nav.showSlices,
		setShowSlices: (v) => dispatch({ type: "SET_SHOW_SLICES", payload: v }),

		// Models
		models,
		selectedModel,
		selectedModelInfo,
		setSelectedModel,

		// Classes
		selectedModelClasses,
		hiddenClasses,
		setHiddenClasses,

		// Predictions
		predictions,
		loadingPredictions,

		processedPredictions,
		processedVolumePrediction,
		processedSlicePrediction,

		// Prediction UI + commands
		showPredictions: nav.showPredictions,
		setShowPredictions: (v) => dispatch({ type: "SET_SHOW_PREDICTIONS", payload: v }),
		predictCurrent: () => predictCurrent(nav.selectedPair),
		predictAll,

		// Stats
		showStats,
		setShowStats,

		// Settings
		showDates,
		setShowDates,

		showFilenames,
		setShowFilenames,

		showScores,
		setShowScores,

		selectedPostprocConfig,
		setSelectedPostprocConfig,

		modelColors,
		setModelColors,
		selectedModelColors,
	};
}
