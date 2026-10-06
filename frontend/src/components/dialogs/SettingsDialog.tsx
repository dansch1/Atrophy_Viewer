import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useViewer } from "@/context/ViewerStateProvider";
import { useDarkMode } from "@/hooks/useDarkMode";
import { DEFAULT_CLASS_COLOR } from "@/lib/modelColors";
import type { PostprocConfig } from "@/lib/postprocess";
import { rafThrottle } from "@/lib/utils";
import { ChevronDown, ChevronRight, Moon, Settings, Sun } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

export function SettingsDialog() {
	const {
		models,
		selectedModelClasses,
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
	} = useViewer();

	const [isOpen, setIsOpen] = useState(false);
	const { isDark, setIsDark } = useDarkMode();

	const [scoreThresholdsExpanded, setScoreThresholdsExpanded] = useState(false);
	const [modelColorsExpanded, setModelColorsExpanded] = useState<Record<string, boolean>>({});

	const handleColorChange = useMemo(
		() =>
			rafThrottle((modelId: string, className: string, color: string) => {
				setModelColors((prev) => {
					const updated = { ...prev };
					updated[modelId]?.setColorByClass(className, color);
					return updated;
				});
			}),
		[setModelColors],
	);

	useEffect(() => {
		return () => {
			handleColorChange.cancel();
		};
	}, [handleColorChange]);

	const renderPostproc = (config: PostprocConfig) => {
		switch (config.type) {
			case "object_detection":
				return renderDetectionPostproc(config);
			case "classification":
				return renderClassPostproc(config);
			default:
				return (
					<span className="col-span-2 text-muted-foreground">
						Postprocessing settings are not yet available for this type.
					</span>
				);
		}
	};

	const renderDetectionPostproc = (config: Extract<PostprocConfig, { type: "object_detection" }>) => (
		<>
			{renderThresholds(config)}

			<span className="text-muted-foreground">NMS IoU</span>
			<span className="text-foreground/80">
				{config.nmsIouThreshold.toFixed(2)}
				<Slider
					className="[&_[data-slot=slider-track]]:bg-input/80"
					value={[config.nmsIouThreshold]}
					min={0}
					max={1}
					step={0.01}
					onValueChange={([value]) =>
						setSelectedPostprocConfig({
							...config,
							nmsIouThreshold: value,
						})
					}
				/>
			</span>

			<span className="text-muted-foreground">TopK</span>
			<span className="text-foreground/80">
				{config.topK === 0 ? "Off" : config.topK}
				<Slider
					className="[&_[data-slot=slider-track]]:bg-input/80"
					value={[config.topK]}
					min={0}
					max={100}
					step={1}
					onValueChange={([value]) =>
						setSelectedPostprocConfig({
							...config,
							topK: value,
						})
					}
				/>
			</span>
		</>
	);

	const renderClassPostproc = (config: Extract<PostprocConfig, { type: "classification" }>) =>
		renderThresholds(config);

	const renderThresholds = (config: PostprocConfig) => (
		<>
			<button
				onClick={() => setScoreThresholdsExpanded((prev) => !prev)}
				className="col-span-2 w-full flex items-center justify-between text-muted-foreground hover:text-foreground transition cursor-pointer"
			>
				<span className="font-medium text-left">Thresholds</span>
				{scoreThresholdsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
			</button>

			{scoreThresholdsExpanded &&
				selectedModelClasses?.map((className, cls) => (
					<React.Fragment key={`threshold-${className}`}>
						<span className="text-muted-foreground ml-4">{className}</span>
						<span className="text-foreground/80">
							{(config.thresholds[cls] ?? 0.5).toFixed(2)}
							<Slider
								className="[&_[data-slot=slider-track]]:bg-input/80"
								value={[config.thresholds[cls] ?? 0.5]}
								min={0}
								max={1}
								step={0.01}
								onValueChange={([value]) => {
									const thresholds = [...config.thresholds];
									thresholds[cls] = value;
									setSelectedPostprocConfig({
										...config,
										thresholds,
									});
								}}
							/>
						</span>
					</React.Fragment>
				))}
		</>
	);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant={isOpen ? "default" : "outline"} size="icon">
					<Settings className="w-5 h-5" />
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-secondary max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Adjust user preferences and display options.</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-[auto_1fr] items-center gap-4 text-sm">
					{/* Section: General */}
					<h4 className="col-span-2 text-sm font-semibold text-foreground mt-4 mb-2">General</h4>

					<span className="flex items-center gap-2 text-muted-foreground">
						{isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
						<span>{isDark ? "Dark Mode" : "Light Mode"}</span>
					</span>
					<Switch id="theme-toggle" checked={isDark} onCheckedChange={setIsDark} />

					<span className="text-muted-foreground">Show Dates</span>
					<Switch id="dates-toggle" checked={showDates} onCheckedChange={setShowDates} />

					<span className="text-muted-foreground">Show Filenames</span>
					<Switch id="filenames-toggle" checked={showFilenames} onCheckedChange={setShowFilenames} />

					<span className="text-muted-foreground">Show Scores</span>
					<Switch id="scores-toggle" checked={showScores} onCheckedChange={setShowScores} />

					{/* Section: Postprocessing */}
					<h4 className="col-span-2 text-sm font-semibold text-foreground mt-4 mb-2">Postprocessing</h4>

					{selectedPostprocConfig ? (
						renderPostproc(selectedPostprocConfig)
					) : (
						<span className="col-span-2 text-muted-foreground">
							Postprocessing is not available for this model.
						</span>
					)}

					{/* Section: Legend */}
					<h4 className="col-span-2 text-sm font-semibold text-foreground mt-4 mb-2">Legend</h4>

					{[...models].map(([modelId, modelInfo]) => (
						<React.Fragment key={modelId}>
							<button
								onClick={() => {
									setModelColorsExpanded((prev) => ({
										...prev,
										[modelId]: !prev[modelId],
									}));
								}}
								className="col-span-2 w-full flex items-center justify-between text-muted-foreground hover:text-foreground transition cursor-pointer"
							>
								<span className="font-medium text-left">{modelInfo.name}</span>
								{modelColorsExpanded[modelId] ? (
									<ChevronDown className="w-4 h-4" />
								) : (
									<ChevronRight className="w-4 h-4" />
								)}
							</button>

							{modelColorsExpanded[modelId] &&
								modelInfo.classes.map((className) => (
									<React.Fragment key={`${modelId}-${className}`}>
										<span className="text-muted-foreground ml-4">{className}</span>
										<input
											type="color"
											value={
												modelColors[modelId]?.getColorByClass(className) ?? DEFAULT_CLASS_COLOR
											}
											onChange={(e) => handleColorChange(modelId, className, e.target.value)}
											className="w-10 h-6 border rounded"
										/>
									</React.Fragment>
								))}
						</React.Fragment>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
