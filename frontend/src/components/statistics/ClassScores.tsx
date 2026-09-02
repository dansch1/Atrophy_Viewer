import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

const ClassScores: React.FC = () => {
	const { processedVolumePrediction, selectedModelClasses, hiddenClasses, selectedModelColors, setSelectedSlice } =
		useViewer();

	const data = useMemo(() => {
		if (!processedVolumePrediction || !selectedModelClasses) {
			return null;
		}

		return processedVolumePrediction.map((prediction, sliceIndex) => {
			const row: Record<string, number> = { slice: sliceIndex + 1 };

			if (prediction?.kind !== "class") {
				return row;
			}

			for (let cls = 0; cls < selectedModelClasses.length; cls++) {
				row[selectedModelClasses[cls]] = prediction.scores[cls] ?? 0;
			}

			return row;
		});
	}, [processedVolumePrediction, selectedModelClasses]);

	if (!data || !selectedModelClasses) {
		return null;
	}

	const chartConfig = Object.fromEntries(
		selectedModelClasses.map((className, cls) => [
			className,
			{
				label: className,
				color: selectedModelColors.getColorByIndex(cls),
			},
		]),
	);

	const handleChartClick = (state: any) => {
		if (state == null || state.activeTooltipIndex == null) {
			return;
		}

		setSelectedSlice(state.activeTooltipIndex as number);
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Class scores per B-scan</CardTitle>
			</CardHeader>

			<CardContent>
				<div className="h-[300px] bg-secondary">
					<ChartContainer className="w-full h-full" config={chartConfig}>
						<LineChart data={data} onClick={handleChartClick}>
							<XAxis dataKey="slice" allowDecimals={false} />
							<YAxis domain={[0, 1]} />
							<ChartTooltip content={<ChartTooltipContent />} />

							{selectedModelClasses.map((className, cls) => (
								<Line
									key={className}
									dataKey={className}
									type="monotone"
									stroke={`var(--color-${className})`}
									strokeWidth={2}
									dot={false}
									isAnimationActive={false}
									hide={hiddenClasses.has(cls)}
								/>
							))}
						</LineChart>
					</ChartContainer>
				</div>
			</CardContent>
		</Card>
	);
};

export default ClassScores;
