import type { VolumePredictions } from "@/api/prediction";
import { fetchPredictions } from "@/api/prediction";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import { useCallback, useRef } from "react";
import type { DicomPair } from "./viewerTypes";

type UsePredictionsControllerOptions = {
	currentPairs: DicomPair[];
	selectedModel?: string;
	predictions: Map<string, Map<string, VolumePredictions>>;
	setPredictions: React.Dispatch<React.SetStateAction<Map<string, Map<string, VolumePredictions>>>>;
	loadingPredictions: Map<string, Set<string>>;
	setLoadingPredictions: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
};

export function usePredictionsController(options: UsePredictionsControllerOptions) {
	const { currentPairs, selectedModel, predictions, setPredictions, loadingPredictions, setLoadingPredictions } =
		options;

	const abortControllers = useRef<AbortController[]>([]);

	const cancelAllPredictionRequests = useCallback(() => {
		abortControllers.current.forEach((c) => c.abort());
		abortControllers.current = [];
	}, []);

	const isLoading = useCallback(
		(model: string, sopInstanceUID: string) => loadingPredictions.get(model)?.has(sopInstanceUID) ?? false,
		[loadingPredictions]
	);

	const hasPrediction = useCallback(
		(model: string, sopInstanceUID: string) => predictions.get(model)?.has(sopInstanceUID) ?? false,
		[predictions]
	);

	const tryFetchPredictions = useCallback(
		async (index: number) => {
			if (!selectedModel) {
				showError("No model selected", "Please select a model before loading predictions.");
				return false;
			}

			const volume = currentPairs[index]?.volume;
			if (!volume) {
				showError(
					"No volume file selected",
					"Please select a valid DICOM volume file before loading predictions."
				);
				return false;
			}

			const key = volume.sopInstanceUID;
			const file = volume.file;

			if (hasPrediction(selectedModel, key)) {
				return true;
			}
			if (isLoading(selectedModel, key)) {
				return false;
			}

			setLoadingPredictions((prev) => {
				const next = new Map(prev);
				const set = new Set(next.get(selectedModel) ?? []);
				set.add(key);
				next.set(selectedModel, set);
				return next;
			});

			const controller = new AbortController();
			abortControllers.current.push(controller);

			try {
				const data = await fetchPredictions(file, selectedModel, controller);

				setPredictions((prev) => {
					const next = new Map(prev);
					const perModel = new Map(next.get(selectedModel) ?? []);
					perModel.set(key, data);
					next.set(selectedModel, perModel);
					return next;
				});

				showSuccess("Prediction complete", `Predictions loaded for file: ${file.name}`);
				return true;
			} catch (err: any) {
				if (err?.name === "AbortError") {
					showInfo("Request cancelled", `The prediction request for ${file.name} was cancelled.`);
				} else {
					console.error("Prediction request failed", { file, err });
					showError("Prediction error", "Failed to predict the volume file. Please try again.");
				}

				return false;
			} finally {
				setLoadingPredictions((prev) => {
					const next = new Map(prev);
					const set = new Set(next.get(selectedModel) ?? []);
					set.delete(key);
					next.set(selectedModel, set);
					return next;
				});

				abortControllers.current = abortControllers.current.filter((c) => c !== controller);
			}
		},
		[selectedModel, currentPairs, setLoadingPredictions, setPredictions, hasPrediction, isLoading]
	);

	const predictCurrent = useCallback(
		async (selectedPair: number) => {
			return await tryFetchPredictions(selectedPair);
		},
		[tryFetchPredictions]
	);

	const predictAll = useCallback(async () => {
		if (!selectedModel) {
			showError("No model selected", "Please select a model before predicting all.");
			return [];
		}

		return await Promise.all(currentPairs.map((_, i) => tryFetchPredictions(i)));
	}, [currentPairs, selectedModel, tryFetchPredictions]);

	return {
		cancelAllPredictionRequests,
		isLoading,
		hasPrediction,
		tryFetchPredictions,
		predictCurrent,
		predictAll,
	};
}
