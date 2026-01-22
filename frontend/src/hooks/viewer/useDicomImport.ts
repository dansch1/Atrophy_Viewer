import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import { getDicomData, type DicomData } from "@/lib/dicom";
import { showError, showSuccess } from "@/lib/toast";
import { useRef } from "react";
import type { DicomPairsByLaterality } from "./viewerTypes";

export function useDicomImport(setDicomPairs: (pairs: DicomPairsByLaterality) => void) {
	const { start, update, stop } = useGlobalLoader();

	const loaderTokenRef = useRef<string | null>(null);
	const uploadTokenRef = useRef(0);

	const loadDicomPairs = async (files: FileList) => {
		loaderTokenRef.current = start("Parsing DICOM files...");
		const uploadToken = ++uploadTokenRef.current;

		try {
			const fileArray = Array.from(files);

			const parsed: (DicomData | null)[] = [];

			for (let i = 0; i < fileArray.length; i++) {
				if (uploadToken !== uploadTokenRef.current) {
					return;
				}

				const file = fileArray[i];
				update(loaderTokenRef.current!, `Parsing DICOM ${i + 1} / ${fileArray.length}: ${file.name}`);

				try {
					parsed.push(await getDicomData(file));
				} catch (err) {
					console.error("Failed to read DICOM", { file, err });
					parsed.push(null);
				}
			}

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

			// TODO: handle multiple files from the same vist
			const makeKey = (study: string, lat: string) => `${study}-${lat}`;
			const fundusMap = new Map(fundusFiles.map((f) => [makeKey(f.studyInstanceUID, f.laterality), f]));

			const pairs = volumeFiles.map((volume) => ({
				volume,
				fundus: fundusMap.get(makeKey(volume.studyInstanceUID, volume.laterality)),
			}));

			if (pairs.length === 0) {
				showError("Missing volumes", "Fundus images require a matching volume with the same StudyInstanceUID.");
				return;
			}

			const byPatient: DicomPairsByLaterality = {};

			for (const p of pairs) {
				const pid = p.volume.patientID;
				const lat = p.volume.laterality;

				if (!byPatient[pid]) {
					byPatient[pid] = { L: [], R: [] };
				}

				byPatient[pid][lat].push(p);
			}

			for (const scans of Object.values(byPatient)) {
				scans.L.sort((a, b) => a.volume.acquisitionDate.getTime() - b.volume.acquisitionDate.getTime());
				scans.R.sort((a, b) => a.volume.acquisitionDate.getTime() - b.volume.acquisitionDate.getTime());
			}

			if (uploadToken !== uploadTokenRef.current) {
				return;
			}

			setDicomPairs(byPatient);

			const total = pairs.length;
			const patients = Object.keys(byPatient).length;

			showSuccess("DICOM files loaded successfully", `${total} scan(s) across ${patients} patient(s).`);
		} finally {
			if (uploadToken === uploadTokenRef.current && loaderTokenRef.current) {
				stop(loaderTokenRef.current);
				loaderTokenRef.current = null;
			}
		}
	};

	return loadDicomPairs;
}
