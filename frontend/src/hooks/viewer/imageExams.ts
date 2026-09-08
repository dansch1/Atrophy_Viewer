import type { DicomData } from "@/lib/dicom";
import type { FileData } from "@/lib/images";
import type { ImageExam, ImageExamsByLat, Laterality } from "./viewerTypes";

export const STANDALONE_PATIENT_ID = "__standalone__";

export function buildImageExams(data: FileData[]): ImageExamsByLat {
	const result: ImageExamsByLat = {};

	for (const item of data) {
		const initial = { L: [], R: [], U: [] };

		if (item.source === "raster") {
			result[STANDALONE_PATIENT_ID] ??= initial;
			result[STANDALONE_PATIENT_ID].U.push({
				examId: item.id,
				fundus: [],
				bscans: [],
				volumes: [],
				rasters: [item],
			});
			continue;
		}
		result[item.patientID] ??= initial;

		const exams = result[item.patientID][item.laterality];
		let exam = exams.find((candidate) => candidate.examId === item.studyInstanceUID);

		if (!exam) {
			exam = {
				examId: item.studyInstanceUID,
				examDate: item.acquisitionDate,
				fundus: [],
				bscans: [],
				volumes: [],
				rasters: [],
			};
			exams.push(exam);
		}

		switch (item.type) {
			case "fundus":
				exam.fundus.push(item);
				break;
			case "oct_bscan":
				exam.bscans.push(item);
				break;
			case "oct_volume":
				exam.volumes.push(item);
				break;
		}

		if (!exam.examDate || item.acquisitionDate.getTime() < exam.examDate.getTime()) {
			exam.examDate = item.acquisitionDate;
		}
	}

	for (const scans of Object.values(result)) {
		for (const laterality of ["L", "R", "U"] satisfies Laterality[]) {
			scans[laterality].sort(compareExams);

			for (const exam of scans[laterality]) {
				exam.fundus.sort(compareDicomImages);
				exam.bscans.sort(compareDicomImages);
				exam.volumes.sort(compareDicomImages);
			}
		}
	}

	return result;
}

function compareExams(a: ImageExam, b: ImageExam): number {
	return (a.examDate?.getTime() ?? 0) - (b.examDate?.getTime() ?? 0);
}

function compareDicomImages(a: DicomData, b: DicomData): number {
	return a.acquisitionDate.getTime() - b.acquisitionDate.getTime();
}

export function getExams(
	imageExams: ImageExamsByLat,
	patientId: string | undefined,
	laterality: Laterality,
): ImageExam[] {
	if (!patientId) {
		return [];
	}

	return imageExams[patientId]?.[laterality] ?? [];
}

export function getExam(
	imageExams: ImageExamsByLat,
	patientId: string | undefined,
	laterality: Laterality,
	examIndex: number,
): ImageExam | undefined {
	return getExams(imageExams, patientId, laterality)[examIndex];
}

export function getExamImages(exam: ImageExam | undefined): FileData[] {
	if (!exam) {
		return [];
	}

	return [...exam.fundus, ...exam.volumes, ...exam.bscans, ...exam.rasters];
}

export function getFirstAvailableLat(imageExams: ImageExamsByLat, patientId: string | undefined): Laterality {
	if (!patientId || !imageExams[patientId]) {
		return "L";
	}

	if (imageExams[patientId].L.length > 0) {
		return "L";
	}

	if (imageExams[patientId].R.length > 0) {
		return "R";
	}

	return "U";
}

export function getLastSlice(exam: ImageExam | undefined): number {
	return Math.max(0, ...(exam?.volumes.map((volume) => volume.frames - 1) ?? []));
}

export function hasAlternativeImages(exam: ImageExam | undefined): boolean {
	if (!exam) {
		return false;
	}

	return exam.fundus.length > 1 || exam.volumes.length + exam.bscans.length > 1 || exam.rasters.length > 1;
}
