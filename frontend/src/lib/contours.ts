import type { Contour, Contours } from "@/api/prediction";

export function isValidContour(contour: Contour): boolean {
	return Array.isArray(contour) && contour.length >= 3;
}

export function hasValidContours(contours: Contours | null | undefined): contours is Contours {
	return Array.isArray(contours) && contours.some(isValidContour);
}

export function contourToSvgPath(contour: Contour, close = true): string | null {
	if (contour.length < 3) {
		return null;
	}

	const d = contour.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
	return close ? `${d} Z` : d;
}
