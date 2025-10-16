import { useViewer } from "@/context/ViewerStateProvider";

export const LegendBox = () => {
	const { models, selectedModel, showAnnotations, selectedLabelColors } = useViewer();

	if (!selectedModel || !showAnnotations) {
		return null;
	}

	const model = models.find((m) => m.name === selectedModel);

	if (!model) {
		return null;
	}

	return (
		<div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 backdrop-blur-md border rounded shadow">
			<div className="font-semibold mb-1">Legend</div>
			{model.classes.map((cls) => (
				<div key={cls} className="flex items-center gap-2">
					<div
						className="w-4 h-4 rounded border"
						style={{ backgroundColor: selectedLabelColors.getColorByLabel(cls) }}
					/>
					<span className="text-muted-foreground">{cls}</span>
				</div>
			))}
		</div>
	);
};
