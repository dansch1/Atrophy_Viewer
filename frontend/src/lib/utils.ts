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
