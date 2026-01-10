import { fetchPredictions } from "@/api/prediction";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewer } from "@/context/ViewerStateProvider";
import type { Laterality } from "@/hooks/useViewerState";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import {
	BarChart3,
	ChevronLeft,
	ChevronRight,
	Image,
	List,
	Pause,
	Play,
	Square,
	SquareSplitVertical,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const Controls: React.FC = () => {
	const {
		dicomPairs,
		patientInfo,
		selectedPatient,
		setSelectedPatient,
		selectedLaterality,
		setSelectedLaterality,
		currentPairs,
		selectedPair,
		setSelectedPair,
		selectedVolume,
		selectedFundus,
		viewMode,
		setViewMode,
		showSlices,
		setShowSlices,
		models,
		selectedModel,
		setSelectedModel,
		predictions,
		setPredictions,
		loadingPredictions,
		setLoadingPredictions,
		showPredictions,
		setShowPredictions,
		showStats,
		setShowStats,
	} = useViewer();

	const [isPlaying, setIsPlaying] = useState(false);
	const [predictionMenuOpen, setPredictionMenuOpen] = useState(false);

	const abortControllers = useRef<AbortController[]>([]);

	const hasSelection = selectedVolume && selectedModel;
	const canPredict = hasSelection && !loadingPredictions.get(selectedModel)?.has(selectedVolume.sopInstanceUID);
	const hasPredictionForCurrent = hasSelection && predictions.get(selectedModel)?.has(selectedVolume.sopInstanceUID);

	useEffect(() => {
		cancelAllRequests();
		setPredictions(() => new Map());
		setLoadingPredictions(() => new Map());
	}, [dicomPairs]);

	useEffect(() => {
		cancelAllRequests();
		setShowPredictions(false);
	}, [selectedModel]);

	useEffect(() => {
		if (showPredictions) {
			tryFetchPredictions(selectedPair);
		}
	}, [selectedPair, showPredictions]);

	const tryFetchPredictions = async (index: number) => {
		if (!selectedModel) {
			showError("No model selected", "Please select a model before toggling prediction.");
			return false;
		}

		const volume = currentPairs[index]?.volume;

		if (!volume) {
			showError("No volume file selected", "Please select a valid DICOM volume file before toggling prediction.");
			return false;
		}

		const key = volume.sopInstanceUID;
		const file = volume.file;

		if (predictions.get(selectedModel)?.has(key)) {
			return true;
		}

		if (loadingPredictions.get(selectedModel)?.has(key)) {
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
			if (err.name === "AbortError") {
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

				set.delete(volume.sopInstanceUID);
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

	return (
		<footer className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self-start flex gap-2">
				<Select value={selectedPatient ?? ""} onValueChange={setSelectedPatient}>
					<SelectTrigger className="w-50 bg-background">
						<SelectValue placeholder="Select patient" />
					</SelectTrigger>
					<SelectContent>
						{patientInfo.size === 0 ? (
							<SelectItem value="__none__" disabled>
								No patients
							</SelectItem>
						) : (
							[...patientInfo].map(([pid, name]) => (
								<SelectItem key={pid} value={pid}>
									{name}
								</SelectItem>
							))
						)}
					</SelectContent>
				</Select>

				<Tabs value={selectedLaterality} onValueChange={(v) => setSelectedLaterality(v as Laterality)}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger
							value="L"
							disabled={!selectedPatient || (dicomPairs[selectedPatient]?.L.length ?? 0) === 0}
						>
							OS
						</TabsTrigger>
						<TabsTrigger
							value="R"
							disabled={!selectedPatient || (dicomPairs[selectedPatient]?.R.length ?? 0) === 0}
						>
							OD
						</TabsTrigger>
					</TabsList>
				</Tabs>
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
					disabled={currentPairs.length < 2}
				>
					{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
				</Button>

				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedPair(Math.min(currentPairs.length - 1, selectedPair + 1))}
					disabled={selectedPair >= currentPairs.length - 1}
				>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>

			<div className="justify-self-end flex gap-2">
				<Tooltip delayDuration={1000}>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							onClick={() =>
								setViewMode(viewMode === "slice" ? "fundus" : viewMode === "fundus" ? "both" : "slice")
							}
							disabled={currentPairs.length === 0}
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
								? "Mode: Fundus"
								: viewMode === "slice"
								? "Mode: Volume"
								: "Mode: Fundus & Volume"}
						</p>
					</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={1000}>
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
						<p>{showSlices ? "Hide slices" : "Show slices"}</p>
					</TooltipContent>
				</Tooltip>

				<Select value={selectedModel ?? ""} onValueChange={setSelectedModel}>
					<SelectTrigger className="w-50 bg-background">
						<SelectValue placeholder="Select model" />
					</SelectTrigger>
					<SelectContent>
						{models.size === 0 ? (
							<SelectItem value="__none__" disabled>
								No models available
							</SelectItem>
						) : (
							[...models.keys()].map((name) => {
								const displayName = name.replace(/\.[^/.]+$/, "");
								return (
									<SelectItem key={name} value={name}>
										{displayName}
									</SelectItem>
								);
							})
						)}
					</SelectContent>
				</Select>

				{hasPredictionForCurrent ? (
					<Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
							<Button
								variant={showPredictions ? "default" : "outline"}
								size="icon"
								onClick={() => setShowPredictions(!showPredictions)}
								disabled={!canPredict}
							>
								<Image className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{showPredictions ? "Hide predictions" : "Show predictions"}</p>
						</TooltipContent>
					</Tooltip>
				) : (
					<Tooltip delayDuration={1000}>
						<DropdownMenu open={predictionMenuOpen} onOpenChange={setPredictionMenuOpen}>
							<DropdownMenuTrigger asChild>
								<TooltipTrigger asChild>
									<Button
										variant={showPredictions ? "default" : "outline"}
										size="icon"
										onClick={(e) => {
											e.preventDefault();
											setPredictionMenuOpen(true);
										}}
										disabled={!canPredict}
									>
										<Image className="w-4 h-4" />
									</Button>
								</TooltipTrigger>
							</DropdownMenuTrigger>

							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Predictions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={async () => {
										setPredictionMenuOpen(false);

										if (await tryFetchPredictions(selectedPair)) {
											setShowPredictions(true);
										}
									}}
								>
									Predict current
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={async () => {
										setPredictionMenuOpen(false);

										const pending = currentPairs
											.map((p, i) => ({ i, key: p.volume.sopInstanceUID }))
											.filter(({ key }) => !predictions.get(selectedModel!)?.has(key))
											.filter(({ key }) => !loadingPredictions.get(selectedModel!)?.has(key))
											.map(({ i }) => i);

										const results = await Promise.allSettled(
											pending.map((i) => tryFetchPredictions(i))
										);

										if (results[pending.indexOf(selectedPair)]?.status === "fulfilled") {
											setShowPredictions(true);
										}
									}}
								>
									Predict all
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<TooltipContent>
							<p>Load predictions</p>
						</TooltipContent>
					</Tooltip>
				)}

				<Tooltip delayDuration={1000}>
					<TooltipTrigger asChild>
						<Button
							variant={showStats ? "default" : "outline"}
							size="icon"
							onClick={() => setShowStats(!showStats)}
							disabled={currentPairs.length === 0}
						>
							<BarChart3 className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>{showStats ? "Hide stats" : "Show stats"}</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</footer>
	);
};

export default Controls;
