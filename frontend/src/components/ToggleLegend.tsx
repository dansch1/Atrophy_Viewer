import { Button } from "@/components/ui/button";
import { useViewer } from "@/context/ViewerStateProvider";
import { cn } from "@/lib/utils";
import React from "react";

export const ToggleLegend: React.FC<{
	variant?: "inline" | "overlay";
	className?: string;
	title?: string;
}> = ({ variant = "inline", className, title = "Legend" }) => {
	const { selectedModelClasses, hiddenClasses, setHiddenClasses, selectedModelColors } = useViewer();

	if (!selectedModelClasses) {
		return null;
	}

	const toggleClass = (cls: number) => {
		setHiddenClasses((prev) => {
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

	const swatchClass = variant === "overlay" ? "w-4 h-4 rounded border" : "w-3 h-3 rounded-sm";

	return (
		<div className={cn(containerClass, className)}>
			{variant === "overlay" && <div className="font-semibold mb-1">{title}</div>}

			{selectedModelClasses.map((className, cls) => (
				<Button
					key={cls}
					variant="outline"
					size="sm"
					onClick={() => toggleClass(cls)}
					className={cn(buttonClass, hiddenClasses.has(cls) && "opacity-40")}
				>
					<span
						className={swatchClass}
						style={{ backgroundColor: selectedModelColors.getColorByClass(className) }}
					/>
					<span className={variant === "overlay" ? "text-muted-foreground" : ""}>{className}</span>
				</Button>
			))}
		</div>
	);
};

export default ToggleLegend;
