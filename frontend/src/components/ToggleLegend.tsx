import { Button } from "@/components/ui/button";
import { useViewer } from "@/context/ViewerStateProvider";
import { cn } from "@/lib/utils";
import React from "react";

type ToggleLegendProps = {
	variant?: "inline" | "overlay";
	className?: string;
	title?: string;
};

export const ToggleLegend: React.FC<ToggleLegendProps> = ({ variant = "inline", className, title = "Legend" }) => {
	const { selectedModelLabels, hiddenLabels, setHiddenLabels, selectedModelColors } = useViewer();

	if (!selectedModelLabels) {
		return null;
	}

	const toggleLabel = (cls: number) => {
		setHiddenLabels((prev) => {
			const next = new Set(prev);
			next.has(cls) ? next.delete(cls) : next.add(cls);
			return next;
		});
	};

	const containerClass =
		variant === "overlay"
			? "absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 bg-background border rounded shadow"
			: "flex flex-wrap justify-center w-full gap-2 mt-2 text-xs";

	const buttonClass =
		variant === "overlay" ? "flex items-center justify-start gap-2 transition" : "gap-1 px-2 py-1 text-xs";

	const swatchClass = variant === "overlay" ? "w-4 h-4 rounded border" : "h-3 w-3 rounded-sm";

	return (
		<div className={cn(containerClass, className)}>
			{variant === "overlay" && <div className="font-semibold mb-1">{title}</div>}

			{selectedModelLabels.map((label, cls) => (
				<Button
					key={cls}
					variant="outline"
					size="sm"
					onClick={() => toggleLabel(cls)}
					className={cn(buttonClass, hiddenLabels.has(cls) && "opacity-40")}
				>
					<span
						className={swatchClass}
						style={{ backgroundColor: selectedModelColors.getColorByLabel(label) }}
					/>
					<span className={variant === "overlay" ? "text-muted-foreground" : ""}>{label}</span>
				</Button>
			))}
		</div>
	);
};

export default ToggleLegend;
