import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
	let t: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), delay);
	};
}

export function rafThrottle<T extends (...args: any[]) => void>(fn: T) {
	let rafId: number | null = null;
	let lastArgs: Parameters<T> | null = null;

	const throttled = (...args: Parameters<T>) => {
		lastArgs = args;

		if (rafId != null) {
			return;
		}

		rafId = requestAnimationFrame(() => {
			rafId = null;

			if (lastArgs) {
				fn(...lastArgs);
				lastArgs = null;
			}
		});
	};

	throttled.cancel = () => {
		if (rafId != null) {
			cancelAnimationFrame(rafId);
		}

		rafId = null;
		lastArgs = null;
	};

	return throttled as T & { cancel: () => void };
}

export function clamp(value: number, min: number, max: number): number {
	if (min > max) {
		[min, max] = [max, min];
	}
	if (Number.isNaN(value)) {
		return value;
	}

	return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
	return clamp(value, 0, 1);
}

export function withAlpha(color: string, alpha: number) {
	const a = Math.max(0, Math.min(1, alpha));

	// #rgb or #rrggbb
	if (color.startsWith("#")) {
		const hex = color.slice(1);
		const value =
			hex.length === 3
				? hex
						.split("")
						.map((c) => c + c)
						.join("")
				: hex;

		const r = parseInt(value.slice(0, 2), 16);
		const g = parseInt(value.slice(2, 4), 16);
		const b = parseInt(value.slice(4, 6), 16);

		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	return color;
}
