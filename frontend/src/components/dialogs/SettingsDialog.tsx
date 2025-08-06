import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useViewer } from "@/context/ViewerStateProvider";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ChevronDown, ChevronRight, Moon, Settings, Sun } from "lucide-react";
import React, { useState } from "react";

export function SettingsDialog() {
	const [isOpen, setIsOpen] = useState(false);
	const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});

	const { isDark, setIsDark } = useDarkMode();
	const { showFilenames, setShowFilenames, models, modelColors, setModelColors } = useViewer();

	const toggleModel = (modelName: string) => {
		setExpandedModels((prev) => ({
			...prev,
			[modelName]: !prev[modelName],
		}));
	};

	const handleColorChange = (model: string, cls: string, color: string) => {
		setModelColors((prev) => {
			const updated = { ...prev };
			updated[model]?.setColorByLabel(cls, color);

			return updated;
		});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant={isOpen ? "default" : "outline"} size="icon">
					<Settings className="w-5 h-5" />
				</Button>
			</DialogTrigger>
			<DialogContent className="bg-secondary">
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

					<span className="text-muted-foreground">Show Filenames</span>
					<Switch id="filenames-toggle" checked={showFilenames} onCheckedChange={setShowFilenames} />

					{/* Section: Legend */}
					<h4 className="col-span-2 text-sm font-semibold text-foreground mt-4 mb-2">Legend</h4>

					{models.map((model) => (
						<React.Fragment key={model.name}>
							<button
								onClick={() => toggleModel(model.name)}
								className="col-span-2 w-full flex items-center justify-between text-muted-foreground hover:text-foreground transition cursor-pointer"
							>
								<span className="font-medium text-left">{model.name}</span>
								{expandedModels[model.name] ? (
									<ChevronDown className="w-4 h-4" />
								) : (
									<ChevronRight className="w-4 h-4" />
								)}
							</button>

							{expandedModels[model.name] &&
								model.classes.map((cls) => (
									<React.Fragment key={`${model.name}-${cls}`}>
										<span className="text-muted-foreground ml-4">{cls}</span>
										<input
											type="color"
											value={modelColors[model.name]?.getColorByLabel(cls) ?? "#000000"}
											onChange={(e) => {
												requestIdleCallback(() => {
													handleColorChange(model.name, cls, e.target.value);
												});
											}}
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
