import { Button } from "@/components/ui/button";
import { Download, UploadCloud } from "lucide-react";
import React, { useRef, useState, type DragEvent } from "react";

import { HelpDialog } from "./dialogs/HelpDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";

interface HeaderProps {
	onFileUpload: (files: FileList) => void;
}

const Header: React.FC<HeaderProps> = ({ onFileUpload }) => {
	const [isDragOver, setIsDragOver] = useState(false);
	const [, setShowExport] = useState(false);

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			onFileUpload(e.target.files);
		}
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			onFileUpload(e.dataTransfer.files);
		}
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = () => {
		setIsDragOver(false);
	};

	return (
		<header className="relative grid grid-cols-3 items-center p-4 bg-accent">
			<div className="justify-self start">
				<HelpDialog />
			</div>
			<div className="w-1/2 mx-auto">
				<div
					className={`flex flex-col items-center justify-center p-2 rounded border-2 border-dashed transition-colors duration-200 text-center ${
						isDragOver ? "border-primary bg-blue-50" : "border-ring"
					}`}
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
				>
					<label
						htmlFor="file-upload"
						className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
					>
						<UploadCloud className="w-5 h-5" />
						<span>Upload Files</span>
					</label>
					<input
						id="file-upload"
						ref={fileInputRef}
						type="file"
						accept=".dcm"
						onChange={handleFileChange}
						multiple
						className="hidden"
					/>
					<p className="text-xs text-muted-foreground">Drag & drop or click to upload (.dcm)</p>
				</div>
			</div>

			<div className="justify-self-end flex gap-2">
				<SettingsDialog />

				<Button onClick={() => setShowExport(true)} variant="outline" size="icon">
					<Download className="w-5 h-5" />
				</Button>
			</div>
		</header>
	);
};

export default Header;
