import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewerState } from "@/hooks/useViewerState";
import { ChevronLeft, ChevronRight, Image, List, Pause, Play } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface ControlsProps {
	volumeFiles: File[];
	viewerState: ViewerState;
}

const Controls: React.FC<ControlsProps> = ({ volumeFiles, viewerState }) => {
	const {
		selectedIndex,
		setSelectedIndex,
		showSlices,
		setShowSlices,
		showAnnotations,
		setShowAnnotations,
		annotationCache,
		setAnnotationCache,
	} = viewerState;

	const [isPlaying, setIsPlaying] = useState(false);
	const [model, setModel] = useState("default");
	const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

	useEffect(() => {
		const updateAnnotations = async () => {
			if (!showAnnotations) return;

			if (!(await tryFetchAnnotations(selectedIndex))) {
				setShowAnnotations(false);
			}
		};

		updateAnnotations();
	}, [selectedIndex]);

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
		if (annotationCache[index]) {
			return true;
		}

		if (loadingIndex === index) {
			return false;
		}

		const file = volumeFiles[index];

		if (!file) {
			console.error("No volume file selected for annotation", { index, volumeFiles });
			toast.error("No volume file selected", {
				description: "Please select a valid DICOM volume file before toggling annotation.",
			});

			return false;
		}

		setLoadingIndex(index);

		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("model", model);

			const response = await fetch(`${import.meta.env.VITE_API_BASE}/analyze`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`HTTP ${response.status}: ${text}`);
			}

			const data = await response.json();

			setAnnotationCache((prev) => ({
				...prev,
				[index]: data,
			}));
		} catch (err) {
			console.error("Annotation request failed", err);
			toast.error("Annotation error", {
				description: "Failed to annotate the volume file. Please try again.",
			});

			return false;
		} finally {
			setLoadingIndex(null);
		}

		return true;
	};
	return (
		<footer className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self-start text-sm truncate max-w-xs">
				{volumeFiles.length > 0 ? volumeFiles[selectedIndex]?.name || "Unnamed file" : "No files selected"}
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
					disabled={volumeFiles.length < 2}
				>
					{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
				</Button>
				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedIndex(Math.min(volumeFiles.length - 1, selectedIndex + 1))}
					disabled={selectedIndex >= volumeFiles.length - 1}
				>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>

			<div className="justify-self-end flex gap-2">
				<TooltipProvider>
					<Tooltip delayDuration={500}>
						<TooltipTrigger asChild>
							<div>
								<Select value={model} onValueChange={setModel}>
									<SelectTrigger className="w-50 bg-background">
										<SelectValue placeholder="Model" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">Test</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Select model</p>
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
									volumeFiles.length <= selectedIndex ||
									!volumeFiles[selectedIndex] ||
									loadingIndex === selectedIndex
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
