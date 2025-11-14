export const DEFAULT_LABEL_COLOR: string = "#000000";

export class ModelColors {
	private labels: string[];
	private colors: string[];

	constructor(labels: string[], colors?: string[]) {
		this.labels = labels;

		if (colors && colors.length === labels.length) {
			this.colors = colors;
		} else {
			this.colors = labels.map(() => this.getRandomColor());
		}
	}

	private getRandomColor(): string {
		return `#${Math.floor(Math.random() * 16777215)
			.toString(16)
			.padStart(6, "0")}`;
	}

	getColorByIndex(index: number): string {
		return this.colors[index] ?? DEFAULT_LABEL_COLOR;
	}

	getColorByLabel(label: string): string {
		const index = this.labels.indexOf(label);

		if (index === -1) {
			return DEFAULT_LABEL_COLOR;
		}

		return this.colors[index];
	}

	setColorByIndex(index: number, color: string = this.getRandomColor()): void {
		if (index >= 0 && index < this.colors.length) {
			this.colors[index] = color;
		}
	}

	setColorByLabel(label: string, color: string = this.getRandomColor()): void {
		const index = this.labels.indexOf(label);

		if (index !== -1) {
			this.colors[index] = color;
		}
	}

	toJSON() {
		return {
			labels: this.labels,
			colors: this.colors,
		};
	}

	static fromJSON(obj: { labels: string[]; colors: string[] }): ModelColors {
		return new ModelColors(obj.labels, obj.colors);
	}
}
