import { fetchAnnotations } from "@/api/annotation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewer } from "@/context/ViewerStateProvider";
import { showError, showSuccess } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Image, List, Pause, Play } from "lucide-react";
import React, { useEffect, useState } from "react";

const Controls: React.FC = () => {
	const {
		dicomPairs,
		selectedIndex,
		setSelectedIndex,
		selectedVolume,
		selectedFundus,
		showSlices,
		setShowSlices,
		annotations,
		setAnnotations,
		loadingAnnotations,
		setLoadingAnnotations,
		showAnnotations,
		setShowAnnotations,
		models,
		selectedModel,
		setSelectedModel,
	} = useViewer();

	const [isPlaying, setIsPlaying] = useState(false);

	useEffect(() => {
		const updateAnnotations = async () => {
			if (!showAnnotations) {
				return;
			}

			if (!(await tryFetchAnnotations(selectedIndex))) {
				setShowAnnotations(false);
			}
		};

		updateAnnotations();
	}, [selectedVolume]);

	const handleAnnotations = async () => {
		if (showAnnotations) {
			setShowAnnotations(false);
			return;
		}

		if (await tryFetchAnnotations(selectedIndex)) {
			setShowAnnotations(true);
		}
	};

	const tryFetchAnnotations = async (index: number) => {
		if (annotations[index]) {
			return true;
		}

		if (loadingAnnotations.has(index)) {
			return false;
		}

		const file = dicomPairs[index]?.volume.file;

		if (!file) {
			showError("No volume file selected", "Please select a valid DICOM volume file before toggling annotation.");
			return false;
		}

		if (!selectedModel) {
			showError("No model selected", "Please select a model before toggling annotation.");
			return false;
		}

		setLoadingAnnotations((prev) => new Set(prev).add(index));

		try {
			const data = await fetchAnnotations(file, selectedModel);

			setAnnotations((prev) => ({
				...prev,
				[index]: data,
			}));
		} catch (err) {
			console.error("Annotation request failed", { file, err });
			showError("Annotation error", "Failed to annotate the volume file. Please try again.");
			return false;
		} finally {
			setLoadingAnnotations((prev) => {
				const next = new Set(prev);
				next.delete(index);
				return next;
			});
		}

		showSuccess("Annotation added", `Annotations loaded for file: ${file.name}`);
		return true;
	};

	return (
		<footer className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self-start text-sm">
				{dicomPairs.length > 0 ? `File: ${selectedIndex + 1} / ${dicomPairs.length}` : "No files selected"}
			</div>

			<div className="justify-self-center flex gap-2">
				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
					disabled={selectedIndex <= 0}
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
					onClick={() => setSelectedIndex(Math.min(dicomPairs.length - 1, selectedIndex + 1))}
					disabled={selectedIndex >= dicomPairs.length - 1}
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
								variant={showSlices ? "default" : "outline"}
								size="icon"
								onClick={() => setShowSlices(!showSlices)}
								disabled={!selectedFundus}
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
								onClick={handleAnnotations}
								disabled={
									!dicomPairs[selectedIndex] ||
									!selectedModel ||
									loadingAnnotations.has(selectedIndex)
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
