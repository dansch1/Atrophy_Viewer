import { fetchModels } from "@/api/model";
import type { VolumePredictions } from "@/api/prediction";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ModelColors } from "@/lib/modelColors";
import { postprocessVolume, type PostprocessParams } from "@/lib/postprocess";
import { showError } from "@/lib/toast";
import { useEffect, useMemo, useState } from "react";
import { usePersistentModelColors } from "../usePersistentModelColors";
import { useDicomImport } from "./useDicomImport";
import { usePredictionsController } from "./usePredictionsController";
import { useViewerNav } from "./useViewerNav";
import type { DicomPairsByLaterality, ViewerState } from "./viewerTypes";

export function useViewerState(): ViewerState {
	// Nav reducer
	const { nav, dispatch } = useViewerNav();

	// Pairs
	const setDicomPairs = (files: DicomPairsByLaterality) => dispatch({ type: "SET_DICOM_PAIRS", payload: files });
	const { loadingPairs, loadDicomPairs } = useDicomImport(setDicomPairs);

	// Models
	const [models, setModels] = useState<Map<string, string[]>>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>();
	const [loadingModels, setLoadingModels] = useState(false);

	const selectedModelLabels = selectedModel ? models.get(selectedModel) : undefined;
	const [hiddenLabels, setHiddenLabels] = useState<Set<number>>(new Set());

	// Predictions
	const [predictions, setPredictions] = useState<Map<string, Map<string, VolumePredictions>>>(new Map());
	const [loadingPredictions, setLoadingPredictions] = useState<Map<string, Set<string>>>(new Map());

	// Stats
	const [showStats, setShowStats] = useState(false);

	// Settings
	const [showDates, setShowDates] = usePersistentState("viewer:showDates", true);
	const [showFilenames, setShowFilenames] = usePersistentState("viewer:showFilenames", true);
	const [showScores, setShowScores] = usePersistentState("viewer:showScores", false);

	const [postParameters, setPostParameters] = usePersistentState<PostprocessParams>("viewer:postParameters", {
		scoreThreshold: 0.5,
		nmsIouThreshold: 0.5,
		topK: 100,
	});

	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");
	const emptyLabelColors = useMemo(() => new ModelColors([], []), []);
	const selectedModelColors = selectedModel ? modelColors[selectedModel] : emptyLabelColors;

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
		if (!nav.selectedPatient) return [];
		return nav.dicomPairs[nav.selectedPatient]?.[nav.selectedLaterality] ?? [];
	}, [nav.dicomPairs, nav.selectedPatient, nav.selectedLaterality]);

	const selectedVolume = currentPairs[nav.selectedPair]?.volume;
	const selectedFundus = currentPairs[nav.selectedPair]?.fundus;

	// Predictions (raw)
	const selectedVolumePredictions =
		selectedModel && selectedVolume
			? predictions.get(selectedModel)?.get(selectedVolume.sopInstanceUID)
			: undefined;

	// const selectedSlicePredictions = selectedVolumePredictions?.[nav.selectedSlice];

	// Predictions (processed)
	const processedPredictions = useMemo(() => {
		const out = new Map<string, Map<string, VolumePredictions>>();

		for (const [modelName, volumesMap] of predictions) {
			const processedVolumes = new Map<string, VolumePredictions>();
			for (const [sopInstanceUID, volumePreds] of volumesMap) {
				processedVolumes.set(sopInstanceUID, postprocessVolume(volumePreds, postParameters));
			}

			out.set(modelName, processedVolumes);
		}

		return out;
	}, [predictions, postParameters]);

	const processedVolumePredictions = useMemo(() => {
		return selectedVolumePredictions ? postprocessVolume(selectedVolumePredictions, postParameters) : undefined;
	}, [selectedVolumePredictions, postParameters]);

	const processedSlicePredictions = processedVolumePredictions?.[nav.selectedSlice];

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
	}, [nav.dicomPairs]);

	// On model change: cancel outstanding requests + hide overlay
	useEffect(() => {
		cancelAllPredictionRequests();
		dispatch({ type: "SET_SHOW_PREDICTIONS", payload: false });
	}, [selectedModel]);

	// Disable overlay if no cached predictions exist
	useEffect(() => {
		if (!nav.showPredictions) return;

		const model = selectedModel;
		const uid = selectedVolume?.sopInstanceUID;

		const hasCached = !!model && !!uid && hasPrediction(model, uid);

		if (!hasCached) {
			dispatch({ type: "SET_SHOW_PREDICTIONS", payload: false });
		}
	}, [nav.showPredictions, selectedModel, selectedVolume]);

	// Load models once
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

		void loadModels();
	}, [setModelColors]);

	// Reset hidden labels when model labels change
	useEffect(() => {
		setHiddenLabels(() => new Set());
	}, [selectedModelLabels]);

	return {
		// Files
		dicomPairs: nav.dicomPairs,
		loadingPairs,
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
		setSelectedModel,
		loadingModels,

		// Labels
		selectedModelLabels,
		hiddenLabels,
		setHiddenLabels,

		// Predictions
		predictions,
		loadingPredictions,

		processedPredictions,
		processedVolumePredictions,
		processedSlicePredictions,

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

		postParameters,
		setPostParameters,

		modelColors,
		setModelColors,
		selectedModelColors,
	};
}
