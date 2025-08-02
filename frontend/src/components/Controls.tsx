import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Image, List, Pause, Play } from "lucide-react";
import React, { useState } from "react";

interface ControlsProps {
	files: File[];
	selectedIndex: number;
	setSelectedIndex: (index: number) => void;
	showSlices: boolean;
	setShowSlices: (value: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({ files, selectedIndex, setSelectedIndex, showSlices, setShowSlices }) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [model, setModel] = useState("default");
	const [showVisualization, setShowVisualization] = useState(false);

	return (
		<footer className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self-start text-sm truncate max-w-xs">
				{files.length > 0 ? files[selectedIndex]?.name || "Unnamed file" : "No files selected"}
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
					disabled={files.length < 2}
				>
					{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
				</Button>
				<Button
					variant="outline"
					size="icon"
					onClick={() => setSelectedIndex(Math.min(files.length - 1, selectedIndex + 1))}
					disabled={selectedIndex >= files.length - 1}
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
										<SelectItem value="default">Default</SelectItem>
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
							<p>Show layers</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip delayDuration={500}>
						<TooltipTrigger asChild>
							<Button
								variant={showVisualization ? "default" : "outline"}
								size="icon"
								onClick={() => setShowVisualization(!showVisualization)}
							>
								<Image className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show visualization</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</footer>
	);
};

export default Controls;
