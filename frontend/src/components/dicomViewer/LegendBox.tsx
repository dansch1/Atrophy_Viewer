import { useViewer } from "@/context/ViewerStateProvider";

export const LegendBox = () => {
	const { selectedModelLabels, showAnnotations, selectedModelColors } = useViewer();

	if (!selectedModelLabels || !showAnnotations) {
		return null;
	}

	return (
		<div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 bg-background border rounded shadow">
			<div className="font-semibold mb-1">Legend</div>
			{selectedModelLabels.map((label) => (
				<div key={label} className="flex items-center gap-2">
					<div
						className="w-4 h-4 rounded border"
						style={{ backgroundColor: selectedModelColors.getColorByLabel(label) }}
					/>
					<span className="text-muted-foreground">{label}</span>
				</div>
			))}
		</div>
	);
};
