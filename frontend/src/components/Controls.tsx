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
import { getExamImages, hasAlternativeImages } from "@/hooks/viewer/imageExams";
import type { Laterality } from "@/hooks/viewer/viewerTypes";
import type { FileData } from "@/lib/images";
import { getCompatibleImages, isModelCompatible } from "@/lib/modelCompatibility";
import {
	BarChart3,
	BrainCircuit,
	ChevronLeft,
	ChevronRight,
	Eye,
	EyeOff,
	Image,
	Images,
	List,
	Pause,
	Play,
	Square,
	SquareSplitVertical,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ImageSelectionDialog, { ImageTypeIcon } from "./ImageSelectionDialog";

const Controls: React.FC = () => {
	const {
		imageExams,
		patientInfo,
		selectedPatient,
		setSelectedPatient,
		selectedLaterality,
		setSelectedLaterality,
		currentExams,
		selectedExamIndex,
		setSelectedExamIndex,
		selectedExam,
		selectedEyeImages,
		setSelectedImages,
		selectedFundus,
		selectedVolume,
		selectedOct,
		selectedRaster,
		viewMode,
		setViewMode,
		showSlices,
		setShowSlices,
		models,
		selectedModel,
		selectedModelInfo,
		setSelectedModel,
		predictions,
		loadingPredictions,
		showPredictions,
		setShowPredictions,
		predictImages,
		showStats,
		setShowStats,
	} = useViewer();

	const [isPlaying, setIsPlaying] = useState(false);
	const [imageDialogOpen, setImageDialogOpen] = useState(false);
	const [predictionMenuOpen, setPredictionMenuOpen] = useState(false);

	useEffect(() => {
		if (!isPlaying) {
			return;
		}

		if (currentExams.length < 2) {
			setIsPlaying(false);
			return;
		}

		const id = window.setInterval(() => {
			if (selectedExamIndex >= currentExams.length - 1) {
				setIsPlaying(false);
				return;
			}

			setSelectedExamIndex(selectedExamIndex + 1);
		}, 350);

		return () => window.clearInterval(id);
	}, [isPlaying, selectedExamIndex, currentExams.length, setSelectedExamIndex]);

	const examImages = getExamImages(selectedExam);

	const currentImages = [selectedFundus, selectedOct, selectedRaster].filter(
		(image): image is FileData => image !== undefined,
	);

	const currentImage = selectedModelInfo
		? currentImages.find((image) => isModelCompatible(selectedModelInfo, image))
		: undefined;

	const compatibleImages = selectedModelInfo ? getCompatibleImages(selectedModelInfo, selectedEyeImages) : [];

	const canSwitchView = !!selectedFundus && !!selectedOct;
	const canSelectImages = hasAlternativeImages(selectedExam);

	const selectedPatientImages = selectedPatient ? imageExams[selectedPatient] : undefined;
	const leftExamCount = selectedPatientImages?.L.length ?? 0;
	const rightExamCount = selectedPatientImages?.R.length ?? 0;
	const showLateralityTabs = !!selectedPatient && selectedLaterality !== "U";

	const modelPredictions = selectedModel ? predictions.get(selectedModel) : undefined;
	const modelLoading = selectedModel ? loadingPredictions.get(selectedModel) : undefined;

	const selectedIds = currentImages.map((image) => image.id);

	const imagesToPredict = compatibleImages.filter(
		(image) => !modelPredictions?.has(image.id) && !modelLoading?.has(image.id),
	);

	const canPredictCurrent =
		!!currentImage && !modelPredictions?.has(currentImage.id) && !modelLoading?.has(currentImage.id);

	const canPredictAll = imagesToPredict.length > 0;

	const hasPredictionForCurrent = !!currentImage && modelPredictions?.has(currentImage.id) === true;

	const canShowStats = compatibleImages.length > 0;

	const runPredictions = async (images: FileData[]) => {
		const results = await predictImages(images);

		if (results.some(Boolean)) {
			setShowPredictions(true);
		}
	};

	return (
		<>
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
								[...patientInfo].map(([patientId, name]) => (
									<SelectItem key={patientId} value={patientId}>
										{name}
									</SelectItem>
								))
							)}
						</SelectContent>
					</Select>

					{showLateralityTabs && (
						<Tabs value={selectedLaterality} onValueChange={(v) => setSelectedLaterality(v as Laterality)}>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="L" disabled={leftExamCount === 0}>
									OS
								</TabsTrigger>
								<TabsTrigger value="R" disabled={rightExamCount === 0}>
									OD
								</TabsTrigger>
							</TabsList>
						</Tabs>
					)}
				</div>

				<div className="justify-self-center flex gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setSelectedExamIndex(Math.max(0, selectedExamIndex - 1))}
						disabled={selectedExamIndex <= 0}
					>
						<ChevronLeft className="w-4 h-4" />
					</Button>

					<Button
						variant="default"
						size="icon"
						onClick={() => setIsPlaying((p) => !p)}
						disabled={currentExams.length < 2}
					>
						{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
					</Button>

					<Button
						variant="outline"
						size="icon"
						onClick={() => setSelectedExamIndex(Math.min(currentExams.length - 1, selectedExamIndex + 1))}
						disabled={selectedExamIndex >= currentExams.length - 1}
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>

				<div className="justify-self-end flex gap-2">
					{canSwitchView && (
						<Tooltip delayDuration={1000}>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									onClick={() =>
										setViewMode(
											viewMode === "oct" ? "fundus" : viewMode === "fundus" ? "both" : "oct",
										)
									}
								>
									{viewMode === "fundus" ? (
										<Image className="w-4 h-4" />
									) : viewMode === "oct" ? (
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
										: viewMode === "oct"
											? "Mode: OCT"
											: "Mode: Fundus & OCT"}
								</p>
							</TooltipContent>
						</Tooltip>
					)}

					<Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
							<Button
								variant={showSlices ? "default" : "outline"}
								size="icon"
								onClick={() => setShowSlices(!showSlices)}
								disabled={!selectedFundus || !selectedVolume || viewMode === "oct"}
							>
								<List className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{showSlices ? "Hide slices" : "Show slices"}</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={() => setImageDialogOpen(true)}
								disabled={!canSelectImages}
							>
								<Images className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Select images</p>
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
								[...models].map(([modelId, modelInfo]) => {
									return (
										<SelectItem key={modelId} value={modelId}>
											<div className="flex items-center gap-2">
												<span>{modelInfo.name}</span>
												<span className="text-muted-foreground">
													<ImageTypeIcon imageType={modelInfo.input.image_type} />
												</span>
											</div>
										</SelectItem>
									);
								})
							)}
						</SelectContent>
					</Select>

					<Tooltip delayDuration={1000}>
						<DropdownMenu open={predictionMenuOpen} onOpenChange={setPredictionMenuOpen}>
							<DropdownMenuTrigger asChild>
								<TooltipTrigger asChild>
									<Button
										variant={predictionMenuOpen ? "default" : "outline"}
										size="icon"
										disabled={!selectedModel || (!canPredictCurrent && !canPredictAll)}
									>
										<BrainCircuit className="w-4 h-4" />
									</Button>
								</TooltipTrigger>
							</DropdownMenuTrigger>

							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Predictions</DropdownMenuLabel>
								<DropdownMenuSeparator />

								<DropdownMenuItem
									disabled={!canPredictCurrent}
									onClick={() => currentImage && void runPredictions([currentImage])}
								>
									Predict current
								</DropdownMenuItem>

								<DropdownMenuItem
									disabled={!canPredictAll}
									onClick={() => void runPredictions(imagesToPredict)}
								>
									Predict all exams
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<TooltipContent>
							<p>Run predictions</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
							<Button
								variant={showPredictions ? "default" : "outline"}
								size="icon"
								onClick={() => setShowPredictions(!showPredictions)}
								disabled={!hasPredictionForCurrent}
							>
								{showPredictions ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{showPredictions ? "Hide predictions" : "Show predictions"}</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
							<Button
								variant={showStats ? "default" : "outline"}
								size="icon"
								onClick={() => setShowStats(!showStats)}
								disabled={!canShowStats && !showStats}
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

			<ImageSelectionDialog
				open={imageDialogOpen}
				onOpenChange={setImageDialogOpen}
				images={examImages}
				selectedIds={selectedIds}
				onConfirm={setSelectedImages}
			/>
		</>
	);
};

export default Controls;
