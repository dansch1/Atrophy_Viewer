import { useViewer } from "@/context/ViewerStateProvider";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export const LegendBox = () => {
	const { selectedModelLabels, hiddenLabels, setHiddenLabels, showPredictions, selectedModelColors } = useViewer();

	if (!selectedModelLabels || !showPredictions) {
		return null;
	}

	const toggleLabel = (label: number) => {
		setHiddenLabels((prev) => {
			const next = new Set(prev);
			next.has(label) ? next.delete(label) : next.add(label);
			return next;
		});
	};

	return (
		<div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 bg-background border rounded shadow">
			<div className="font-semibold mb-1">Legend</div>
			{selectedModelLabels.map((label, cls) => {
				return (
					<Button
						key={cls}
						variant="outline"
						size="sm"
						onClick={() => toggleLabel(cls)}
						className={cn(
							"flex items-center justify-start gap-2 transition",
							hiddenLabels.has(cls) && "opacity-40"
						)}
					>
						<div
							className="w-4 h-4 rounded border"
							style={{ backgroundColor: selectedModelColors.getColorByLabel(label) }}
						/>
						<span className="text-muted-foreground">{label}</span>
					</Button>
				);
			})}
		</div>
	);
};
