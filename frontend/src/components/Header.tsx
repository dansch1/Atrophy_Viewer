import { Button } from "@/components/ui/button";
import { Download, UploadCloud } from "lucide-react";
import React, { useRef, useState, type DragEvent } from "react";

import { useViewer } from "@/context/ViewerStateProvider";
import { getDicomData, type DicomData } from "@/lib/dicom";
import { showError, showSuccess } from "@/lib/toast";
import { HelpDialog } from "./dialogs/HelpDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";

const Header = () => {
	const { setDicomPairs } = useViewer();

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

	const onFileUpload = async (files: FileList) => {
		const fileArray = Array.from(files);

		const parsed = await Promise.all(
			fileArray.map((file) =>
				getDicomData(file).catch((err) => {
					console.error("Failed to read DICOM", { file, err });
					return null;
				})
			)
		);

		const valid = parsed.filter((d): d is DicomData => d !== null);

		if (valid.length === 0) {
			showError("Parsing failed", "No valid DICOM files found.");
			return;
		}

		const volumeFiles = [];
		const fundusFiles = [];

		for (const d of valid) {
			if (d.type === "volume") {
				volumeFiles.push(d);
			} else if (d.type === "fundus") {
				fundusFiles.push(d);
			}
		}

		// TODO
		const pairs = [];
		const fundusMap = new Map(fundusFiles.map((f) => [f.studyInstanceUID, f]));

		for (const volume of volumeFiles) {
			const fundus = fundusMap.get(volume.studyInstanceUID);
			pairs.push({ volume, fundus });
		}

		if (pairs.length === 0) {
			showError("Missing volumes", "Fundus images require a matching volume with the same StudyInstanceUID.");

			return;
		}

		setDicomPairs(pairs);
		showSuccess("DICOM files loaded successfully", `${pairs.length} volume file(s) loaded.`);
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
