import type { SlicePredictions, VolumePredictions } from "@/api/prediction";
import { streamPredictions } from "@/api/prediction";
import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
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
	const { start, update, stop } = useGlobalLoader();

	const { currentPairs, selectedModel, predictions, setPredictions, loadingPredictions, setLoadingPredictions } =
		options;

	const abortControllers = useRef<AbortController[]>([]);
	const loaderTokensRef = useRef<Map<string, string>>(new Map());

	const cancelAllPredictionRequests = useCallback(() => {
		abortControllers.current.forEach((c) => c.abort());
		abortControllers.current = [];
		loaderTokensRef.current.forEach((t) => stop(t));
		loaderTokensRef.current.clear();
	}, [stop]);

	const isLoading = useCallback(
		(model: string, sopInstanceUID: string) => loadingPredictions.get(model)?.has(sopInstanceUID) ?? false,
		[loadingPredictions],
	);

	const hasPrediction = useCallback(
		(model: string, sopInstanceUID: string) => predictions.get(model)?.has(sopInstanceUID) ?? false,
		[predictions],
	);

	const makeRequestKey = (model: string, uid: string) => `${model}::${uid}`;

	const emptySlice = (): SlicePredictions => ({
		boxes: [],
		scores: [],
		classes: [],
	});

	const createEmptyVolume = (total: number): VolumePredictions => Array.from({ length: total }, emptySlice);

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
					"Please select a valid DICOM volume file before loading predictions.",
				);
				return false;
			}

			const uid = volume.sopInstanceUID;
			const file = volume.file;

			if (hasPrediction(selectedModel, uid)) {
				return true;
			}
			if (isLoading(selectedModel, uid)) {
				return false;
			}

			const requestKey = makeRequestKey(selectedModel, uid);
			if (!loaderTokensRef.current.has(requestKey)) {
				const t = start(`Predicting: ${file.name}`);
				loaderTokensRef.current.set(requestKey, t);
			}
			const loaderToken = loaderTokensRef.current.get(requestKey)!;

			setLoadingPredictions((prev) => {
				const next = new Map(prev);
				const set = new Set(next.get(selectedModel) ?? []);
				set.add(uid);
				next.set(selectedModel, set);
				return next;
			});

			const controller = new AbortController();
			abortControllers.current.push(controller);

			let completed = false;
			let totalSlices: number = 0;

			const setSlice = (i: number, pred: SlicePredictions) => {
				setPredictions((prev) => {
					const next = new Map(prev);
					const perModel = new Map(next.get(selectedModel) ?? []);
					const existing = perModel.get(uid);
					if (!existing) {
						return prev;
					}

					const volumePreds = existing.slice();
					volumePreds[i] = pred;

					perModel.set(uid, volumePreds);
					next.set(selectedModel, perModel);
					return next;
				});
			};

			try {
				await streamPredictions(file, selectedModel, {
					controller,
					onMeta: ({ slices }) => {
						totalSlices = slices;
						update(loaderToken, `Loading model: ${selectedModel}`);

						setPredictions((prev) => {
							const next = new Map(prev);
							const perModel = new Map(next.get(selectedModel) ?? []);
							perModel.set(uid, createEmptyVolume(totalSlices));
							next.set(selectedModel, perModel);
							return next;
						});
					},
					onSlice: (i, pred) => {
						setSlice(i, pred);
						update(loaderToken, `Predicting: ${file.name} (${i + 1}/${totalSlices})`);
					},
					onDone: () => {
						completed = true;
						update(loaderToken, `Finished predicting: ${file.name}`);
					},
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
				if (!completed) {
					// remove partial/empty predictions so user can retry
					setPredictions((prev) => {
						const next = new Map(prev);
						const perModel = new Map(next.get(selectedModel) ?? []);

						perModel.delete(uid);
						if (perModel.size === 0) {
							next.delete(selectedModel);
						} else {
							next.set(selectedModel, perModel);
						}

						return next;
					});
				}

				setLoadingPredictions((prev) => {
					const next = new Map(prev);
					const set = new Set(next.get(selectedModel) ?? []);

					set.delete(uid);
					if (set.size === 0) {
						next.delete(selectedModel);
					} else {
						next.set(selectedModel, set);
					}

					return next;
				});

				abortControllers.current = abortControllers.current.filter((c) => c !== controller);

				const t = loaderTokensRef.current.get(requestKey);
				if (t) {
					stop(t);
					loaderTokensRef.current.delete(requestKey);
				}
			}
		},
		[
			selectedModel,
			currentPairs,
			setLoadingPredictions,
			setPredictions,
			hasPrediction,
			isLoading,
			start,
			update,
			stop,
		],
	);

	const predictCurrent = useCallback(
		async (selectedPair: number) => {
			return await tryFetchPredictions(selectedPair);
		},
		[tryFetchPredictions],
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
