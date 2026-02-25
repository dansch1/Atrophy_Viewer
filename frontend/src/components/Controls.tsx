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
import type { Laterality } from "@/hooks/viewer/viewerTypes";
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
import React, { useEffect, useMemo, useState } from "react";

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
		loadingPredictions,
		showPredictions,
		setShowPredictions,
		predictCurrent,
		predictAll,
		showStats,
		setShowStats,
	} = useViewer();

	const [isPlaying, setIsPlaying] = useState(false);
	const [predictionMenuOpen, setPredictionMenuOpen] = useState(false);

	useEffect(() => {
		if (!isPlaying) {
			return;
		}

		if (currentPairs.length < 2) {
			setIsPlaying(false);
			return;
		}

		const id = window.setInterval(() => {
			if (selectedPair >= currentPairs.length - 1) {
				setIsPlaying(false);
				return;
			}

			setSelectedPair(selectedPair + 1);
		}, 350);

		return () => window.clearInterval(id);
	}, [isPlaying, selectedPair, currentPairs.length, setSelectedPair]);

	const hasSelection = !!(selectedModel && selectedVolume);

	const isCurrentLoading = useMemo(() => {
		if (!hasSelection) {
			return false;
		}

		return loadingPredictions.get(selectedModel)?.has(selectedVolume.sopInstanceUID) ?? false;
	}, [hasSelection, loadingPredictions, selectedModel, selectedVolume]);

	const hasPredictionForCurrent = useMemo(() => {
		if (!hasSelection) {
			return false;
		}

		return predictions.get(selectedModel)?.has(selectedVolume.sopInstanceUID) ?? false;
	}, [hasSelection, predictions, selectedModel, selectedVolume]);

	const canOpenPredictionMenu = hasSelection && !isCurrentLoading;

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
					onClick={() => setIsPlaying((p) => !p)}
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
								disabled={!hasSelection}
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
										disabled={!canOpenPredictionMenu}
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
										setShowPredictions(true);

										const ok = await predictCurrent();
										if (!ok) {
											setShowPredictions(false);
										}
									}}
								>
									Predict current
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={async () => {
										setPredictionMenuOpen(false);
										setShowPredictions(true);

										const results = await predictAll();
										if (!results[selectedPair]) {
											setShowPredictions(false);
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
