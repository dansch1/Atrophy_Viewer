import { clamp } from "@/lib/utils";
import { useReducer } from "react";
import type { DicomPairsByLaterality, Laterality, ViewMode } from "./viewerTypes";

export type NavState = {
	dicomPairs: DicomPairsByLaterality;
	selectedPatient?: string;
	selectedLaterality: Laterality;
	selectedPair: number;
	selectedSlice: number;
	viewMode: ViewMode;
	showSlices: boolean;
	showPredictions: boolean;
};

export type NavAction =
	| { type: "SET_DICOM_PAIRS"; payload: DicomPairsByLaterality }
	| { type: "SET_PATIENT"; payload: string }
	| { type: "SET_LATERALITY"; payload: Laterality }
	| { type: "SET_PAIR"; payload: number }
	| { type: "SET_SLICE"; payload: number }
	| { type: "SET_VIEWMODE"; payload: ViewMode }
	| { type: "SET_SHOW_SLICES"; payload: boolean }
	| { type: "SET_SHOW_PREDICTIONS"; payload: boolean }
	| { type: "RESET_WITHIN_PATIENT" };

const initialNavState: NavState = {
	dicomPairs: {},
	selectedPatient: undefined,
	selectedLaterality: "L",
	selectedPair: 0,
	selectedSlice: 0,
	viewMode: "slice",
	showSlices: false,
	showPredictions: false,
};

function firstAvailableLat(map: DicomPairsByLaterality, pid: string | undefined): Laterality {
	return !pid || !map[pid] || map[pid].L.length > 0 ? "L" : "R";
}

function getLastSlice(map: DicomPairsByLaterality, pid: string | undefined, lat: Laterality, pairIndex: number) {
	if (!pid || !map[pid] || !map[pid][lat][pairIndex]) {
		return 0;
	}

	const pairs = map[pid][lat];
	const vol = pairs[pairIndex].volume;
	const frames = vol.frames;

	return Math.max(0, frames - 1);
}

function reducer(state: NavState, action: NavAction): NavState {
	switch (action.type) {
		case "SET_DICOM_PAIRS": {
			const dicomPairs = action.payload;
			const patientIds = Object.keys(dicomPairs);
			const selectedPatient = patientIds.includes(state.selectedPatient ?? "")
				? state.selectedPatient
				: patientIds[0];

			const selectedLaterality = firstAvailableLat(dicomPairs, selectedPatient);

			return {
				...state,
				dicomPairs,
				selectedPatient,
				selectedLaterality,
				selectedPair: 0,
				selectedSlice: 0,
				viewMode: "slice",
				showSlices: false,
				showPredictions: false,
			};
		}

		case "SET_PATIENT": {
			const selectedPatient = action.payload;
			const selectedLaterality = firstAvailableLat(state.dicomPairs, selectedPatient);

			const lastSlice = getLastSlice(state.dicomPairs, selectedPatient, selectedLaterality, 0);
			const selectedSlice = clamp(state.selectedSlice, 0, lastSlice);

			return {
				...state,
				selectedPatient,
				selectedLaterality,
				selectedPair: 0,
				selectedSlice,
				showPredictions: false,
			};
		}

		case "SET_LATERALITY": {
			const lat = action.payload;

			const lastSlice = getLastSlice(state.dicomPairs, state.selectedPatient, lat, 0);
			const selectedSlice = clamp(state.selectedSlice, 0, lastSlice);

			return {
				...state,
				selectedLaterality: lat,
				selectedPair: 0,
				selectedSlice,
				showPredictions: false,
			};
		}

		case "SET_PAIR": {
			const len = state.selectedPatient
				? state.dicomPairs[state.selectedPatient][state.selectedLaterality].length
				: 0;
			const selectedPair = clamp(action.payload, 0, Math.max(0, len - 1));

			const lastSlice = getLastSlice(
				state.dicomPairs,
				state.selectedPatient,
				state.selectedLaterality,
				selectedPair,
			);
			const selectedSlice = clamp(state.selectedSlice, 0, lastSlice);

			return { ...state, selectedPair, selectedSlice };
		}

		case "SET_SLICE":
			const lastSlice = getLastSlice(
				state.dicomPairs,
				state.selectedPatient,
				state.selectedLaterality,
				state.selectedPair,
			);
			const selectedSlice = clamp(action.payload, 0, lastSlice);

			return { ...state, selectedSlice };

		case "SET_VIEWMODE":
			return { ...state, viewMode: action.payload };

		case "SET_SHOW_SLICES":
			return { ...state, showSlices: action.payload };

		case "SET_SHOW_PREDICTIONS":
			return { ...state, showPredictions: action.payload };

		case "RESET_WITHIN_PATIENT":
			return {
				...state,
				selectedPair: 0,
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
