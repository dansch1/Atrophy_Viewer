import { usePersistentState } from "@/hooks/usePersistentState";
import { useEffect } from "react";

export function useDarkMode() {
	const [isDark, setIsDark] = usePersistentState<boolean>(
		"theme",
		(() => {
			if (typeof window === "undefined") {
				return false;
			}

			const stored = localStorage.getItem("theme");

			if (stored === "dark") {
				return true;
			}

			if (stored === "light") {
				return false;
			}

			return window.matchMedia("(prefers-color-scheme: dark)").matches;
		})()
	);

	useEffect(() => {
		const root = document.documentElement;

		if (isDark) {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
	}, [isDark]);

	return { isDark, setIsDark };
}
