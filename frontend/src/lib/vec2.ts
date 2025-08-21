export type Pt = { x: number; y: number };

export function unitNormal(a: Pt, b: Pt) {
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const L = Math.hypot(dx, dy) || 1;
	return { nx: dy / L, ny: -dx / L };
}

export function mid(a: Pt, b: Pt): Pt {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function dot(ax: number, ay: number, bx: number, by: number) {
	return ax * bx + ay * by;
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
