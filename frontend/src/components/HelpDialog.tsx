import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

export function HelpDialog() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant={isOpen ? "default" : "outline"} size="icon">
					<CircleHelp className="w-5 h-5" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Help</DialogTitle>
					<DialogDescription>
						Upload and analyze OCT volume files with corresponding fundus images.
					</DialogDescription>
				</DialogHeader>
				<div className="text-sm space-y-2">
					<p>
						This tool allows you to upload Optical Coherence Tomography (OCT) volume data along with
						associated fundus images in DICOM format.
					</p>
					<p>
						It automatically detects and annotates Geographic Atrophy (GA) across all B-scan slices in the
						volume. The annotated results are then projected and visualized on the corresponding fundus
						image for spatial reference and analysis.
					</p>
					<p>
						This facilitates accurate assessment, visualization, and review of GA progression across imaging
						modalities.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
