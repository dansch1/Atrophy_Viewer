import type { ClassPrediction } from "@/api/prediction";
import { useViewer } from "@/context/ViewerStateProvider";
import { passesClassThreshold } from "@/lib/postprocess";
import React from "react";

const ClassImageOverlay: React.FC<{ prediction: ClassPrediction }> = ({ prediction }) => {
	const { selectedModelClasses, hiddenClasses, showScores, selectedPostprocConfig, selectedModelColors } =
		useViewer();

	if (!selectedModelClasses) {
		return null;
	}

	return (
		<div className="absolute bottom-3 left-3 p-3 rounded-md border bg-background/80">
			<div className="text-sm font-medium">Classification</div>

			{selectedModelClasses.map((className, cls) => {
				if (hiddenClasses.has(cls)) {
					return null;
				}

				const color = selectedModelColors.getColorByIndex(cls);
				const score = prediction.scores[cls] ?? 0;
				const positive = passesClassThreshold(score, cls, selectedPostprocConfig);

				return (
					<div key={className} className="flex items-center justify-between gap-4 text-sm">
						<div className="flex items-center gap-2">
							<span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
							<span>{className}</span>
						</div>

						<div className="flex items-center gap-2">
							{showScores && <span className="text-muted-foreground">{score.toFixed(2)}</span>}
							<span className={positive ? "font-medium" : "text-muted-foreground"}>
								{positive ? "Positive" : "Negative"}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default ClassImageOverlay;
