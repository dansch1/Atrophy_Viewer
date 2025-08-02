import { useEffect, useState } from "react";

export function useDarkMode() {
	const [isDark, setIsDark] = useState(() => {
		// load from localStorage or system preference
		if (typeof window !== "undefined") {
			return (
				localStorage.getItem("theme") === "dark" ||
				(!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
			);
		}

		return false;
	});

	useEffect(() => {
		const root = document.documentElement;

		if (isDark) {
			root.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			root.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}, [isDark]);

	return { isDark, setIsDark };
}
