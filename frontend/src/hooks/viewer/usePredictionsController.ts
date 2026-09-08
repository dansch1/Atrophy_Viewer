import type { ModelInfo } from "@/api/model";
import { streamPredictions, type Prediction, type PredictionResult } from "@/api/prediction";
import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import type { FileData } from "@/lib/images";
import { isModelCompatible } from "@/lib/modelCompatibility";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import { useCallback, useRef } from "react";
import type { PredictionMap } from "./viewerTypes";

type UsePredictionsControllerOptions = {
	selectedModel?: string;
	selectedModelInfo?: ModelInfo;
	predictions: PredictionMap;
	setPredictions: React.Dispatch<React.SetStateAction<PredictionMap>>;
	loadingPredictions: Map<string, Set<string>>;
	setLoadingPredictions: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
};

export function usePredictionsController(options: UsePredictionsControllerOptions) {
	const { start, update, stop } = useGlobalLoader();
	const { selectedModel, selectedModelInfo, predictions, setPredictions, loadingPredictions, setLoadingPredictions } =
		options;

	const abortControllers = useRef<Set<AbortController>>(new Set());
	const loaderTokens = useRef<Map<string, string>>(new Map());
	const activeRequests = useRef<Set<string>>(new Set());

	const cancelAllPredictionRequests = useCallback(() => {
		abortControllers.current.forEach((c) => c.abort());
		abortControllers.current.clear();
		loaderTokens.current.forEach((t) => stop(t));
		loaderTokens.current.clear();
		activeRequests.current.clear();
	}, [stop]);

	const tryFetchPredictions = useCallback(
		async (image: FileData): Promise<boolean> => {
			if (!selectedModel || !selectedModelInfo) {
				showError("No model selected", "Please select a model before loading predictions.");
				return false;
			}

			if (!isModelCompatible(selectedModelInfo, image)) {
				showError("Incompatible image", "This model cannot predict the selected image type.");
				return false;
			}

			const imageId = image.id;
			const file = image.file;

			if (predictions.get(selectedModel)?.has(imageId)) {
				return true;
			}

			const requestKey = `${selectedModel}::${imageId}`;
			if (loadingPredictions.get(selectedModel)?.has(imageId) || activeRequests.current.has(requestKey)) {
				return false;
			}
			activeRequests.current.add(requestKey);

			const controller = new AbortController();
			abortControllers.current.add(controller);

			const loaderToken = start(`Predicting: ${file.name}`, () => controller.abort());
			loaderTokens.current.set(requestKey, loaderToken);

			setLoadingPredictions((prev) => {
				const next = new Map(prev);
				const images = new Set(next.get(selectedModel) ?? []);
				images.add(imageId);
				next.set(selectedModel, images);
				return next;
			});

			let completed = false;
			let total = 1;

			const setPrediction = (i: number, pred: Prediction) => {
				setPredictions((prev) => {
					const next = new Map(prev);
					const perModel = new Map(next.get(selectedModel) ?? []);
					const existing = perModel.get(imageId);

					if (!existing) {
						return prev;
					}

					const items = existing.items.slice();
					items[i] = pred;

					perModel.set(imageId, { ...existing, items });
					next.set(selectedModel, perModel);
					return next;
				});
			};

			try {
				await streamPredictions(file, selectedModel, {
					controller,
					onMeta: (meta) => {
						total = meta.count;
						update(loaderToken, `Loading model: ${selectedModel}`);

						const initial: PredictionResult = {
							scope: meta.scope,
							items: Array.from({ length: meta.count }, () => null),
						};

						setPredictions((prev) => {
							const next = new Map(prev);
							const perModel = new Map(next.get(selectedModel) ?? []);
							perModel.set(imageId, initial);
							next.set(selectedModel, perModel);
							return next;
						});
					},
					onPred: (i, pred) => {
						setPrediction(i, pred);
						update(loaderToken, `Predicting: ${file.name} (${i + 1}/${total})`);
					},
					onDone: () => {
						completed = true;
						update(loaderToken, `Finished predicting: ${file.name}`);
					},
				});

				showSuccess("Prediction complete", `Predictions loaded for file: ${file.name}`);
				return true;
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					showInfo("Request cancelled", `The prediction request for ${file.name} was cancelled.`);
				} else {
					console.error("Prediction request failed", { image, err });
					showError("Prediction error", "Failed to predict the image. Please try again.");
				}

				return false;
			} finally {
				if (!completed) {
					// remove partial/empty predictions so user can retry
					setPredictions((prev) => {
						const next = new Map(prev);
						const perModel = new Map(next.get(selectedModel) ?? []);

						perModel.delete(imageId);
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
					const images = new Set(next.get(selectedModel) ?? []);

					images.delete(imageId);
					if (images.size === 0) {
						next.delete(selectedModel);
					} else {
						next.set(selectedModel, images);
					}

					return next;
				});

				const t = loaderTokens.current.get(requestKey);
				if (t) {
					stop(t);
					loaderTokens.current.delete(requestKey);
				}

				activeRequests.current.delete(requestKey);
				abortControllers.current.delete(controller);
			}
		},
		[
			selectedModel,
			selectedModelInfo,
			predictions,
			loadingPredictions,
			setPredictions,
			setLoadingPredictions,
			start,
			update,
			stop,
		],
	);

	const predictImages = useCallback(
		async (images: FileData[]): Promise<boolean[]> => {
			if (!selectedModel || !selectedModelInfo) {
				showError("No model selected", "Please select a model before loading predictions.");
				return [];
			}

			return await Promise.all(images.map((image) => tryFetchPredictions(image)));
		},
		[selectedModel, selectedModelInfo, tryFetchPredictions],
	);

	return {
		cancelAllPredictionRequests,
		predictImages,
	};
}
