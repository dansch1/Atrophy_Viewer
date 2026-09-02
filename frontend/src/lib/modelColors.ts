export const DEFAULT_CLASS_COLOR: string = "#000000";

export class ModelColors {
	private classes: string[];
	private colors: string[];

	constructor(classes: string[], colors?: string[]) {
		this.classes = classes;

		if (colors && colors.length === classes.length) {
			this.colors = colors;
		} else {
			this.colors = classes.map(() => this.getRandomColor());
		}
	}

	private getRandomColor(): string {
		return `#${Math.floor(Math.random() * 16777215)
			.toString(16)
			.padStart(6, "0")}`;
	}

	getColorByIndex(index: number): string {
		return this.colors[index] ?? DEFAULT_CLASS_COLOR;
	}

	getColorByClass(className: string): string {
		const index = this.classes.indexOf(className);

		if (index === -1) {
			return DEFAULT_CLASS_COLOR;
		}

		return this.colors[index];
	}

	setColorByIndex(index: number, color: string = this.getRandomColor()): void {
		if (index >= 0 && index < this.colors.length) {
			this.colors[index] = color;
		}
	}

	setColorByClass(className: string, color: string = this.getRandomColor()): void {
		const index = this.classes.indexOf(className);

		if (index !== -1) {
			this.colors[index] = color;
		}
	}

	toJSON() {
		return {
			classes: this.classes,
			colors: this.colors,
		};
	}

	static fromJSON(obj: { classes: string[]; colors: string[] }): ModelColors {
		return new ModelColors(obj.classes, obj.colors);
	}
}
