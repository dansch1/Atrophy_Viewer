export const renderImage = (data: ArrayLike<number>, width: number, height: number, canvas: HTMLCanvasElement) => {
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return;
	}

	const imageData = normalizeImageData(data, width, height);
	canvas.width = width;
	canvas.height = height;
	ctx.putImageData(imageData, 0, 0);
};

export function normalizeImageData(data: ArrayLike<number>, width: number, height: number): ImageData {
	let min = Infinity,
		max = -Infinity;

	for (let i = 0; i < data.length; i++) {
		if (data[i] < min) min = data[i];
		if (data[i] > max) max = data[i];
	}

	const imageData = new ImageData(width, height);

	for (let i = 0; i < width * height; i++) {
		const val = Math.round(((data[i] - min) / (max - min)) * 255);
		imageData.data[i * 4 + 0] = val;
		imageData.data[i * 4 + 1] = val;
		imageData.data[i * 4 + 2] = val;
		imageData.data[i * 4 + 3] = 255;
	}

	return imageData;
}
