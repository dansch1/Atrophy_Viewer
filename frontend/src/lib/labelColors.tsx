export class LabelColors {
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

	getColorByLabel(label: string): string | undefined {
		const index = this.labels.indexOf(label);

		if (index === -1) {
			return undefined;
		}

		return this.getColorByIndex(index);
	}

	getColorByIndex(index: number): string | undefined {
		return this.colors[index];
	}

	setColorByLabel(label: string, color?: string): void {
		const index = this.labels.indexOf(label);

		if (index !== -1) {
			this.setColorByIndex(index, color);
		}
	}

	setColorByIndex(index: number, color?: string): void {
		if (index >= 0 && index < this.colors.length) {
			this.colors[index] = color ?? this.getRandomColor();
		}
	}

	toJSON() {
		return {
			labels: this.labels,
			colors: this.colors,
		};
	}

	static fromJSON(obj: { labels: string[]; colors: string[] }): LabelColors {
		return new LabelColors(obj.labels, obj.colors);
	}
}
