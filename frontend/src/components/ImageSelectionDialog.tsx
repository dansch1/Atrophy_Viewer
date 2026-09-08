import type { ImageType } from "@/api/model";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { renderImage, type FileData } from "@/lib/images";
import { Check, Image, Images, Layers, ScanLine } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export function ImageTypeIcon({ imageType, className = "w-4 h-4" }: { imageType?: ImageType; className?: string }) {
	switch (imageType) {
		case "fundus":
			return <Image className={className} />;
		case "oct_bscan":
			return <ScanLine className={className} />;
		case "oct_volume":
			return <Layers className={className} />;
		default:
			return <Image className={className} />;
	}
}

function getSelectionGroup(image: FileData): "fundus" | "oct" | undefined {
	if (image.source !== "dicom") {
		return undefined;
	}

	return image.type === "fundus" ? "fundus" : "oct";
}

type ImageSelectionTileProps = {
	image: FileData;
	selected: boolean;
	onToggle: () => void;
};

const ImageSelectionTile: React.FC<ImageSelectionTileProps> = ({ image, selected, onToggle }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const preview =
		image.source === "raster" || image.type !== "oct_volume"
			? image.image
			: image.images[Math.floor(image.images.length / 2)];

	useEffect(() => {
		if (!canvasRef.current || !preview) {
			return;
		}

		renderImage(preview, canvasRef.current);
	}, [preview]);

	return (
		<button
			type="button"
			className={[
				"relative overflow-hidden rounded-md border bg-background p-1",
				"cursor-pointer hover:border-muted-foreground/60",
				selected ? "border-primary" : "border-border",
			].join(" ")}
			onClick={onToggle}
			aria-pressed={selected}
			aria-label={image.file.name}
			title={image.file.name}
		>
			<div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden">
				{preview && <canvas ref={canvasRef} className="w-full h-full object-contain" />}

				<div className="absolute top-2 left-2 rounded-md border bg-background/90 p-1 text-muted-foreground backdrop-blur-sm">
					<ImageTypeIcon imageType={image.source === "dicom" ? image.type : undefined} />
				</div>

				{selected && (
					<div className="absolute top-2 right-2 rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
						<Check className="w-4 h-4" />
					</div>
				)}
			</div>
		</button>
	);
};

type ImageSelectionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	images: FileData[];
	selectedIds: string[];
	onConfirm: (images: FileData[]) => void;
};

const ImageSelectionDialog: React.FC<ImageSelectionDialogProps> = ({
	open,
	onOpenChange,
	images,
	selectedIds,
	onConfirm,
}) => {
	const [selection, setSelection] = useState<Set<string>>(new Set());
	const wasOpen = useRef(false);

	const selectedImages = images.filter((image) => selection.has(image.id));

	useEffect(() => {
		if (open && !wasOpen.current) {
			setSelection(new Set(selectedIds));
		}

		wasOpen.current = open;
	}, [open, selectedIds]);

	const toggleImage = (image: FileData) => {
		setSelection((prev) => {
			if (prev.has(image.id)) {
				return prev;
			}

			const next = new Set(prev);
			const group = getSelectionGroup(image);

			if (group) {
				for (const candidate of images) {
					if (getSelectionGroup(candidate) === group) {
						next.delete(candidate.id);
					}
				}
			}

			next.add(image.id);
			return next;
		});
	};

	const handleConfirm = () => {
		if (selectedImages.length === 0) {
			return;
		}

		onOpenChange(false);
		onConfirm(selectedImages);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Select images</DialogTitle>
					<DialogDescription>Choose the images to display.</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{images.map((image) => (
							<ImageSelectionTile
								key={image.id}
								image={image}
								selected={selection.has(image.id)}
								onToggle={() => toggleImage(image)}
							/>
						))}
					</div>
				</div>

				<DialogFooter className="flex-row items-center sm:justify-between">
					<span className="text-sm text-muted-foreground">{selectedImages.length} selected</span>
					<Button onClick={handleConfirm} disabled={selectedImages.length === 0}>
						<Images className="w-4 h-4" />
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default ImageSelectionDialog;
