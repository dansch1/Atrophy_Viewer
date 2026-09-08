import { clamp } from "@/lib/utils";
import { useReducer } from "react";
import { getExam, getExams, getFirstAvailableLat, getLastSlice } from "./imageExams";
import type { ImageExamsByLat, Laterality, ViewMode } from "./viewerTypes";

export type NavState = {
	imageExams: ImageExamsByLat;
	selectedPatient?: string;
	selectedLaterality: Laterality;
	selectedExamIndex: number;
	selectedSlice: number;
	viewMode: ViewMode;
	showSlices: boolean;
	showPredictions: boolean;
};

export type NavAction =
	| { type: "SET_IMAGE_EXAMS"; payload: ImageExamsByLat }
	| { type: "SET_PATIENT"; payload: string }
	| { type: "SET_LATERALITY"; payload: Laterality }
	| { type: "SET_EXAM"; payload: number }
	| { type: "SET_SLICE"; payload: number }
	| { type: "SET_VIEW_MODE"; payload: ViewMode }
	| { type: "SET_SHOW_SLICES"; payload: boolean }
	| { type: "SET_SHOW_PREDICTIONS"; payload: boolean }
	| { type: "RESET_WITHIN_PATIENT" };

const initialNavState: NavState = {
	imageExams: {},
	selectedPatient: undefined,
	selectedLaterality: "L",
	selectedExamIndex: 0,
	selectedSlice: 0,
	viewMode: "oct",
	showSlices: false,
	showPredictions: false,
};

function reducer(state: NavState, action: NavAction): NavState {
	switch (action.type) {
		case "SET_IMAGE_EXAMS": {
			const imageExams = action.payload;
			const patientIds = Object.keys(imageExams);

			const selectedPatient =
				state.selectedPatient && patientIds.includes(state.selectedPatient)
					? state.selectedPatient
					: patientIds[0];

			const selectedLaterality = getFirstAvailableLat(imageExams, selectedPatient);

			return {
				...state,
				imageExams,
				selectedPatient,
				selectedLaterality,
				selectedExamIndex: 0,
				selectedSlice: 0,
				viewMode: "oct",
				showSlices: false,
				showPredictions: false,
			};
		}

		case "SET_PATIENT": {
			const selectedPatient = action.payload;
			const selectedLaterality = getFirstAvailableLat(state.imageExams, selectedPatient);

			const exam = getExam(state.imageExams, selectedPatient, selectedLaterality, 0);
			const selectedSlice = clamp(state.selectedSlice, 0, getLastSlice(exam));

			return {
				...state,
				selectedPatient,
				selectedLaterality,
				selectedExamIndex: 0,
				selectedSlice,
				showPredictions: false,
			};
		}

		case "SET_LATERALITY": {
			const lat = action.payload;

			const exam = getExam(state.imageExams, state.selectedPatient, lat, 0);
			const selectedSlice = clamp(state.selectedSlice, 0, getLastSlice(exam));

			return {
				...state,
				selectedLaterality: lat,
				selectedExamIndex: 0,
				selectedSlice,
				showPredictions: false,
			};
		}

		case "SET_EXAM": {
			const exams = getExams(state.imageExams, state.selectedPatient, state.selectedLaterality);
			const selectedExamIndex = clamp(action.payload, 0, Math.max(0, exams.length - 1));

			const exam = exams[selectedExamIndex];
			const selectedSlice = clamp(state.selectedSlice, 0, getLastSlice(exam));

			return {
				...state,
				selectedExamIndex,
				selectedSlice,
			};
		}

		case "SET_SLICE": {
			const exam = getExam(
				state.imageExams,
				state.selectedPatient,
				state.selectedLaterality,
				state.selectedExamIndex,
			);
			const selectedSlice = clamp(action.payload, 0, getLastSlice(exam));

			return {
				...state,
				selectedSlice,
			};
		}

		case "SET_VIEW_MODE":
			return { ...state, viewMode: action.payload };

		case "SET_SHOW_SLICES":
			return { ...state, showSlices: action.payload };

		case "SET_SHOW_PREDICTIONS":
			return { ...state, showPredictions: action.payload };

		case "RESET_WITHIN_PATIENT":
			return {
				...state,
				selectedExamIndex: 0,
				selectedSlice: 0,
				showPredictions: false,
			};

		default:
			return state;
	}
}

export function useViewerNav() {
	const [nav, dispatch] = useReducer(reducer, initialNavState);

	return {
		nav,
		dispatch,
	};
}
