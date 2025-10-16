import { fetchAnnotations } from "@/api/annotation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewer } from "@/context/ViewerStateProvider";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Image, List, Pause, Play, Square, SquareSplitVertical } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const Controls: React.FC = () => {
	const {
		dicomPairs,
		selectedPair,
		setSelectedPair,
		selectedFundus,
		setSelectedSlice,
		models,
		selectedModel,
		setSelectedModel,
		viewMode,
		setViewMode,
		showSlices,
		setShowSlices,
		annotations,
		setAnnotations,
		loadingAnnotations,
		setLoadingAnnotations,
		showAnnotations,
		setShowAnnotations,
	} = useViewer();

	const [isPlaying, setIsPlaying] = useState(false);
	const abortControllers = useRef<AbortController[]>([]);

	useEffect(() => {
		setShowAnnotations(false);
		cancelAllRequests();

		resetViewer();
	}, [dicomPairs]);

	useEffect(() => {
		setShowAnnotations(false);
		cancelAllRequests();
	}, [selectedModel]);

	useEffect(() => {
		if (showAnnotations) {
			tryFetchAnnotations(selectedPair);
		}
	}, [selectedPair, annotations]);

	const resetViewer = () => {
		setSelectedPair(0);
		setSelectedSlice(0);
		setViewMode("slice");
		setShowSlices(false);
		setAnnotations(new Map());
	};

	const tryFetchAnnotations = async (index: number) => {
		if (!selectedModel) {
			showError("No model selected", "Please select a model before toggling annotation.");
			return false;
		}

		if (annotations.get(selectedModel)?.has(index)) {
			return true;
		}

		if (loadingAnnotations.get(selectedModel)?.has(index)) {
			return false;
		}

		const file = dicomPairs[index]?.volume.file;

		if (!file) {
			showError("No volume file selected", "Please select a valid DICOM volume file before toggling annotation.");
			return false;
		}

		setLoadingAnnotations((prev) => {
			const next = new Map(prev);
			const set = new Set(next.get(selectedModel) ?? []);
			set.add(index);
			next.set(selectedModel, set);
			return next;
		});

		const controller = new AbortController();
		abortControllers.current.push(controller);

		try {
			const data = await fetchAnnotations(file, selectedModel, controller);

			setAnnotations((prev) => {
				const next = new Map(prev);
				const perModel = new Map(next.get(selectedModel) ?? []);
				perModel.set(index, data);
				next.set(selectedModel, perModel);
				return next;
			});

			showSuccess("Annotation added", `Annotations loaded for file: ${file.name}`);
			return true;
		} catch (err: any) {
			if (err.name === "AbortError") {
				showInfo("Request cancelled", `The annotation request for ${file.name} was cancelled.`);
			} else {
				console.error("Annotation request failed", { file, err });
				showError("Annotation error", "Failed to annotate the volume file. Please try again.");
			}

			return false;
		} finally {
			setLoadingAnnotations((prev) => {
				const next = new Map(prev);
				const set = new Set(next.get(selectedModel) ?? []);
				set.delete(index);
				next.set(selectedModel, set);
				return next;
			});

			abortControllers.current = abortControllers.current.filter((c) => c !== controller);
		}
	};

	const cancelAllRequests = () => {
		abortControllers.current.forEach((c) => c.abort());
		abortControllers.current = [];
	};

	const toggleAnnotations = () => {
		if (showAnnotations) {
			setShowAnnotations(false);
			return;
		}

		setShowAnnotations(true);
		tryFetchAnnotations(selectedPair);
	};

	return (
		<footer className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self-start text-sm">
				{dicomPairs.length > 0 ? `File: ${selectedPair + 1} / ${dicomPairs.length}` : "No files selected"}
			</div>

			<div className="justify-self-center flex gap-2">
				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedPair(Math.max(0, selectedPair - 1))}
					disabled={selectedPair <= 0}
				>
					<ChevronLeft className="w-4 h-4" />
				</Button>
				<Button
					onClick={() => setIsPlaying(!isPlaying)}
					variant="default"
					size="icon"
					disabled={dicomPairs.length < 2}
				>
					{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
				</Button>
				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedPair(Math.min(dicomPairs.length - 1, selectedPair + 1))}
					disabled={selectedPair >= dicomPairs.length - 1}
				>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>

			<div className="justify-self-end flex gap-2">
				<div>
					<Select value={selectedModel ?? ""} onValueChange={setSelectedModel}>
						<SelectTrigger className="w-50 bg-background">
							<SelectValue placeholder="Select model" />
						</SelectTrigger>
						<SelectContent>
							{models.length === 0 ? (
								<SelectItem value="default" disabled>
									No models available
								</SelectItem>
							) : (
								models.map((model) => {
									const name = model.name.replace(/\.[^/.]+$/, "");

									return (
										<SelectItem key={model.name} value={model.name}>
											{name}
										</SelectItem>
									);
								})
							)}
						</SelectContent>
					</Select>
				</div>

				<TooltipProvider>
					<Tooltip delayDuration={500}>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={() =>
									setViewMode(
										viewMode === "fundus" ? "slice" : viewMode === "slice" ? "both" : "fundus"
									)
								}
							>
								{viewMode === "fundus" ? (
									<Image className="w-4 h-4" />
								) : viewMode === "slice" ? (
									<Square className="w-4 h-4" />
								) : (
									<SquareSplitVertical className="w-4 h-4 transform rotate-90" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{viewMode === "fundus"
									? "Show Fundus"
									: viewMode === "slice"
									? "Show Volume"
									: "Show Fundus & Volume"}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip delayDuration={500}>
						<TooltipTrigger asChild>
							<Button
								variant={showSlices ? "default" : "outline"}
								size="icon"
								onClick={() => setShowSlices(!showSlices)}
								disabled={!selectedFundus || viewMode === "slice"}
							>
								<List className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show slices</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip delayDuration={500}>
						<TooltipTrigger asChild>
							<Button
								variant={showAnnotations ? "default" : "outline"}
								size="icon"
								onClick={toggleAnnotations}
								disabled={
									!dicomPairs[selectedPair] ||
									!selectedModel ||
									!!loadingAnnotations.get(selectedModel)?.has(selectedPair)
								}
							>
								<Image className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show annotations</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</footer>
	);
};

export default Controls;
