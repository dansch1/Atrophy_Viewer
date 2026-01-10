import { getDicomData, type DicomData } from "@/lib/dicom";
import { showError, showSuccess } from "@/lib/toast";
import { useRef, useState } from "react";
import type { DicomPairsByLaterality } from "./viewerTypes";

export function useDicomImport(setDicomPairs: (pairs: DicomPairsByLaterality) => void) {
	const [loadingPairs, setLoadingPairs] = useState(false);
	const uploadTokenRef = useRef(0);

	const loadDicomPairs = async (files: FileList) => {
		const token = ++uploadTokenRef.current;
		setLoadingPairs(true);

		try {
			const fileArray = Array.from(files);

			const parsed = await Promise.all(
				fileArray.map((file) =>
					getDicomData(file).catch((err) => {
						console.error("Failed to read DICOM", { file, err });
						return null;
					})
				)
			);

			if (token !== uploadTokenRef.current) {
				return;
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

			if (token !== uploadTokenRef.current) {
				return;
			}

			setDicomPairs(byPatient);

			const total = pairs.length;
			const patients = Object.keys(byPatient).length;

			showSuccess("DICOM files loaded successfully", `${total} scan(s) across ${patients} patient(s).`);
		} finally {
			if (token === uploadTokenRef.current) {
				setLoadingPairs(false);
			}
		}
	};

	return { loadingPairs, loadDicomPairs };
}
