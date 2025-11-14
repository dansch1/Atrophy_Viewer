import { useEffect, useState } from "react";

export function usePersistentState<T>(
	key: string,
	defaultValue: T,
	options?: {
		serialize?: (value: T) => string;
		deserialize?: (stored: string) => T;
	}
): [T, React.Dispatch<React.SetStateAction<T>>] {
	const { serialize = JSON.stringify, deserialize = JSON.parse } = options ?? {};

	const [state, setState] = useState<T>(() => {
		if (typeof window === "undefined") {
			return defaultValue;
		}

		try {
			const stored = localStorage.getItem(key);
			return stored !== null ? deserialize(stored) : defaultValue;
		} catch (err: any) {
			console.warn(`Failed to load localStorage key "${key}"`, err);
			return defaultValue;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(key, serialize(state));
		} catch (err: any) {
			console.warn(`Failed to save localStorage key "${key}"`, err);
		}
	}, [key, state, serialize]);

	return [state, setState];
}
