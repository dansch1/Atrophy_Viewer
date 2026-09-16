import { fetchModels, type ModelMap } from "@/api/model";
import type { Prediction, PredictionResult } from "@/api/prediction";
import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { FileData } from "@/lib/images";
import { ModelColors } from "@/lib/modelColors";
import { isModelCompatible } from "@/lib/modelCompatibility";
import { createPostprocConfig, postprocessPredictionResult, type PostprocConfig } from "@/lib/postprocess";
import { showError } from "@/lib/toast";
import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { usePersistentModelColors } from "../usePersistentModelColors";
import { getExamImages, STANDALONE_PATIENT_ID } from "./imageExams";
import { useImageImport } from "./useImageImport";
import { usePredictionsController } from "./usePredictionsController";
import { useViewerNav } from "./useViewerNav";
import type { ImageExam, ImageExamsByLat, Laterality, PredictionMap, ViewerState, ViewMode } from "./viewerTypes";

type ImageSelection = {
	fundusId?: string;
	octId?: string;
};

function getSelectedImages(exam: ImageExam, selection?: ImageSelection): FileData[] {
	const fundus = exam.fundus.find((image) => image.id === selection?.fundusId) ?? exam.fundus[0];

	const octImages = [...exam.volumes, ...exam.bscans];
	const oct = octImages.find((image) => image.id === selection?.octId) ?? octImages[0];

	return [fundus, oct, exam.rasters[0]].filter((image): image is FileData => image !== undefined);
}

function getDisplayedPrediction(
	imagePrediction: PredictionResult | undefined,
	sliceIndex?: number,
): Prediction | undefined {
	if (!imagePrediction) {
		return undefined;
	}

	if (imagePrediction.scope === "image") {
		return imagePrediction.items[0] ?? undefined;
	}

	if (imagePrediction.scope === "slice" && sliceIndex !== undefined) {
		return imagePrediction.items[sliceIndex] ?? undefined;
	}

	return undefined;
}

export function useViewerState(): ViewerState {
	const { start, stop } = useGlobalLoader();
	const { nav, dispatch } = useViewerNav();

	// Images
	const setImageExams = useCallback(
		(exams: ImageExamsByLat) => dispatch({ type: "SET_IMAGE_EXAMS", payload: exams }),
		[dispatch],
	);
	const loadImages = useImageImport(setImageExams);

	// Patients
	const patientInfo = useMemo(() => {
		const map = new Map<string, string>();

		for (const [patientId, scans] of Object.entries(nav.imageExams)) {
			if (patientId === STANDALONE_PATIENT_ID) {
				map.set(patientId, "Uploaded images");
				continue;
			}

			const images = [...scans.L, ...scans.R, ...scans.U].flatMap((exam) => getExamImages(exam));
			const patientName = images
				.map((image) => (image.source === "dicom" ? image.patientName : undefined))
				.find((name): name is string => !!name);

			map.set(patientId, patientName ?? `Unknown (${patientId})`);
		}

		return map;
	}, [nav.imageExams]);

	const setSelectedPatient = useCallback((id: string) => dispatch({ type: "SET_PATIENT", payload: id }), [dispatch]);

	// Laterality
	const setSelectedLaterality = useCallback(
		(lat: Laterality) => dispatch({ type: "SET_LATERALITY", payload: lat }),
		[dispatch],
	);

	// Exams
	const currentExams = useMemo(() => {
		if (!nav.selectedPatient) {
			return [];
		}

		return nav.imageExams[nav.selectedPatient]?.[nav.selectedLaterality] ?? [];
	}, [nav.imageExams, nav.selectedPatient, nav.selectedLaterality]);

	const selectedExam = currentExams[nav.selectedExamIndex];

	// Selected Images
	const [selections, setSelections] = useState<Map<ImageExam, ImageSelection>>(new Map());
	const selection = selectedExam ? selections.get(selectedExam) : undefined;

	const selectedEyeImages = useMemo(
		() => currentExams.flatMap((exam) => getSelectedImages(exam, selections.get(exam))),
		[currentExams, selections],
	);

	const setSelectedImages = useCallback(
		(images: FileData[]) => {
			if (!selectedExam) {
				return;
			}

			const fundus = images.find((image) => image.source === "dicom" && image.type === "fundus");
			const oct = images.find(
				(image) => image.source === "dicom" && (image.type === "oct_volume" || image.type === "oct_bscan"),
			);

			setSelections((prev) => {
				const next = new Map(prev);
				next.set(selectedExam, {
					fundusId: fundus?.id,
					octId: oct?.id,
				});
				return next;
			});
		},
		[selectedExam],
	);

	const selectedFundus =
		selectedExam?.fundus.find((image) => image.id === selection?.fundusId) ?? selectedExam?.fundus[0];

	const octImages = selectedExam ? [...selectedExam.volumes, ...selectedExam.bscans] : [];
	const selectedOct = octImages.find((image) => image.id === selection?.octId) ?? octImages[0];

	const selectedVolume = selectedOct?.type === "oct_volume" ? selectedOct : undefined;

	const selectedRaster = selectedExam?.rasters[0];

	const setSelectedExamIndex = useCallback(
		(index: number) => dispatch({ type: "SET_EXAM", payload: index }),
		[dispatch],
	);

	// Slices
	const selectedSlice = selectedVolume
		? Math.min(nav.selectedSlice, Math.max(0, selectedVolume.frames - 1))
		: nav.selectedSlice;

	const setSelectedSlice = useCallback(
		(index: number) => dispatch({ type: "SET_SLICE", payload: index }),
		[dispatch],
	);

	// View
	const setViewMode = useCallback((mode: ViewMode) => dispatch({ type: "SET_VIEW_MODE", payload: mode }), [dispatch]);
	const setShowSlices = useCallback(
		(value: boolean) => dispatch({ type: "SET_SHOW_SLICES", payload: value }),
		[dispatch],
	);

	// Models
	const [models, setModels] = useState<ModelMap>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>();

	const selectedModelInfo = selectedModel ? models.get(selectedModel) : undefined;
	const selectedModelClasses = selectedModelInfo?.classes;
	const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(new Set());

	// Predictions
	const [predictions, setPredictions] = useState<PredictionMap>(new Map());
	const [loadingPredictions, setLoadingPredictions] = useState<Map<string, Set<string>>>(new Map());

	const setShowPredictions = useCallback(
		(value: boolean) => dispatch({ type: "SET_SHOW_PREDICTIONS", payload: value }),
		[dispatch],
	);

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

	const setSelectedPostprocConfig = useCallback(
		(update: SetStateAction<PostprocConfig>) => {
			if (!selectedModel || !selectedModelInfo) {
				return;
			}

			setPostprocessByModel((prev) => {
				const current = prev[selectedModel] ?? createPostprocConfig(selectedModelInfo);
				if (!current) {
					return prev;
				}

				const next = typeof update === "function" ? update(current) : update;

				return {
					...prev,
					[selectedModel]: next,
				};
			});
		},
		[selectedModel, selectedModelInfo, setPostprocessByModel],
	);

	const [modelColors, setModelColors] = usePersistentModelColors("viewer:modelColors");
	const emptyClassColors = useMemo(() => new ModelColors([], []), []);
	const selectedModelColors = selectedModel ? (modelColors[selectedModel] ?? emptyClassColors) : emptyClassColors;

	// Predictions (processed)
	const processedPredictions = useMemo(() => {
		const result: PredictionMap = new Map();

		for (const [modelId, images] of predictions) {
			const modelInfo = models.get(modelId);
			if (!modelInfo) {
				continue;
			}

			const config = postprocessByModel[modelId] ?? createPostprocConfig(modelInfo);
			const processedImages = new Map<string, PredictionResult>();

			for (const [imageId, imagePrediction] of images) {
				processedImages.set(imageId, postprocessPredictionResult(imagePrediction, config));
			}
			result.set(modelId, processedImages);
		}

		return result;
	}, [predictions, models, postprocessByModel]);

	const selectedModelPredictions = selectedModel ? processedPredictions.get(selectedModel) : undefined;

	const currentPredictionImage = [selectedFundus, selectedOct, selectedRaster].find(
		(image) => image && selectedModelInfo && isModelCompatible(selectedModelInfo, image),
	);

	const processedCurrentResult = currentPredictionImage
		? selectedModelPredictions?.get(currentPredictionImage.id)
		: undefined;

	const processedFundusPrediction = getDisplayedPrediction(
		selectedFundus ? selectedModelPredictions?.get(selectedFundus.id) : undefined,
	);

	const processedVolumeResult = selectedVolume ? selectedModelPredictions?.get(selectedVolume.id) : undefined;

	const processedOctPrediction = getDisplayedPrediction(
		selectedOct ? selectedModelPredictions?.get(selectedOct.id) : undefined,
		selectedVolume ? selectedSlice : undefined,
	);

	const processedRasterPrediction = getDisplayedPrediction(
		selectedRaster ? selectedModelPredictions?.get(selectedRaster.id) : undefined,
	);

	const { cancelAllPredictionRequests, predictImages } = usePredictionsController({
		selectedModel,
		selectedModelInfo,
		predictions,
		setPredictions,
		loadingPredictions,
		setLoadingPredictions,
	});

	// On new images: cancel + reset predictions state
	useEffect(() => {
		cancelAllPredictionRequests();
		setPredictions(() => new Map());
		setLoadingPredictions(() => new Map());
		setSelections(() => new Map());
		setShowPredictions(false);
	}, [nav.imageExams, cancelAllPredictionRequests, setShowPredictions]);

	// On model change: cancel outstanding requests + hide overlay
	useEffect(() => {
		cancelAllPredictionRequests();
		setShowPredictions(false);
	}, [selectedModel, cancelAllPredictionRequests, setShowPredictions]);

	// Disable overlay if no predictions exist
	useEffect(() => {
		if (!nav.showPredictions) {
			return;
		}

		if (!selectedModel) {
			setShowPredictions(false);
			return;
		}

		const modelPredictions = predictions.get(selectedModel);
		const modelLoading = loadingPredictions.get(selectedModel);
		const available = [selectedFundus, selectedOct, selectedRaster].some(
			(image) => image !== undefined && (modelPredictions?.has(image.id) || modelLoading?.has(image.id)),
		);

		if (!available) {
			setShowPredictions(false);
		}
	}, [
		nav.showPredictions,
		selectedModel,
		selectedFundus,
		selectedOct,
		selectedRaster,
		predictions,
		loadingPredictions,
		setShowPredictions,
	]);

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
			} catch (err) {
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
		// Images
		imageExams: nav.imageExams,
		loadImages,

		// Patients
		patientInfo,
		selectedPatient: nav.selectedPatient,
		setSelectedPatient,

		// Laterality
		selectedLaterality: nav.selectedLaterality,
		setSelectedLaterality,

		// Exams
		currentExams,
		selectedExamIndex: nav.selectedExamIndex,
		setSelectedExamIndex,
		selectedExam,

		// Selected images
		selectedEyeImages,
		setSelectedImages,

		selectedFundus,
		selectedVolume,
		selectedOct,
		selectedRaster,

		// Slices
		selectedSlice,
		setSelectedSlice,

		// View
		viewMode: nav.viewMode,
		setViewMode,

		showSlices: nav.showSlices,
		setShowSlices,

		// Models
		models,
		selectedModel,
		selectedModelInfo,
		setSelectedModel,

		// Classes
		selectedModelClasses,
		hiddenClasses,
		setHiddenClasses,

		// Predictions (raw)
		predictions,
		loadingPredictions,

		// Predictions (processed)
		processedPredictions,
		processedCurrentResult,
		processedFundusPrediction,
		processedVolumeResult,
		processedOctPrediction,
		processedRasterPrediction,

		// Prediction controller
		showPredictions: nav.showPredictions,
		setShowPredictions,
		predictImages,

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
