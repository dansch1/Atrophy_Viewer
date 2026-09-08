import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import { getDicomData } from "@/lib/dicom";
import { getRasterData, isRasterFile, type FileData } from "@/lib/images";
import { showError, showInfo, showSuccess } from "@/lib/toast";
import { useCallback, useRef } from "react";
import { buildImageExams } from "./imageExams";
import type { ImageExamsByLat } from "./viewerTypes";

export function useImageImport(setImageExams: (exams: ImageExamsByLat) => void) {
	const { start, update, stop } = useGlobalLoader();

	const loaderTokenRef = useRef<string | null>(null);
	const uploadTokenRef = useRef(0);

	const cancelImport = useCallback(() => {
		uploadTokenRef.current += 1;

		if (loaderTokenRef.current) {
			stop(loaderTokenRef.current);
			loaderTokenRef.current = null;
		}

		showInfo("Import cancelled", "The image import was cancelled.");
	}, [stop]);

	return useCallback(
		async (files: FileList) => {
			const uploadToken = ++uploadTokenRef.current;
			const loaderToken = start("Parsing image files...", cancelImport);
			loaderTokenRef.current = loaderToken;

			try {
				const fileArray = Array.from(files);
				const parsed: (FileData | null)[] = [];

				for (let i = 0; i < fileArray.length; i++) {
					if (uploadToken !== uploadTokenRef.current) {
						return;
					}

					const file = fileArray[i];
					update(loaderToken, `Parsing image ${i + 1} / ${fileArray.length}: ${file.name}`);

					try {
						parsed.push(isRasterFile(file) ? await getRasterData(file) : await getDicomData(file));
					} catch (err) {
						console.error("Failed to read image", { file, err });
						parsed.push(null);
					}
				}

				const valid = parsed.filter((data): data is FileData => data !== null);
				if (valid.length === 0) {
					showError("Parsing failed", "No valid image files found.");
					return;
				}

				const imageExams = buildImageExams(valid);
				if (uploadToken !== uploadTokenRef.current) {
					return;
				}

				setImageExams(imageExams);
				showSuccess(
					"Image files loaded successfully",
					`${valid.length} image(s) across ${Object.keys(imageExams).length} group(s).`,
				);
			} finally {
				if (uploadToken === uploadTokenRef.current) {
					stop(loaderToken);
					if (loaderTokenRef.current === loaderToken) {
						loaderTokenRef.current = null;
					}
				}
			}
		},
		[cancelImport, setImageExams, start, stop, update],
	);
}
