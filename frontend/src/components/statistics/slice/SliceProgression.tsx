import type { PredictionResult } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import type { PixelSpacing } from "@/lib/dicom";
import { area } from "@/lib/postprocess";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

const SliceProgression: React.FC = () => {
	const {
		currentExams,
		setSelectedExamIndex,
		selectedModel,
		selectedModelClasses,
		hiddenClasses,
		processedPredictions,
		selectedModelColors,
	} = useViewer();

	const data = useMemo(() => {
		if (!selectedModel || !selectedModelClasses) {
			return null;
		}

		const modelPredictions = processedPredictions.get(selectedModel);

		return currentExams.flatMap((exam, examIndex) => {
			if (!exam.examDate) {
				return [];
			}

			const volume = exam.volumes[0];
			const row: Record<string, number> = { date: exam.examDate.getTime(), examIndex };
			if (!volume) {
				return [row];
			}

			const volumePrediction = modelPredictions?.get(volume.id);
			if (!volumePrediction || volumePrediction.scope !== "slice") {
				return [row];
			}

			for (let cls = 0; cls < selectedModelClasses.length; cls++) {
				row[selectedModelClasses[cls]] = sumAreaForClass(volumePrediction, cls, volume.pixelSpacing);
			}

			return [row];
		});
	}, [currentExams, selectedModel, selectedModelClasses, processedPredictions]);

	function sumAreaForClass(volumePrediction: PredictionResult, cls: number, pixelSpacing: PixelSpacing): number {
		let sum = 0;
		for (const slicePrediction of volumePrediction.items) {
			if (slicePrediction?.kind !== "object_detection") {
				continue;
			}

			for (let i = 0; i < slicePrediction.boxes.length; i++) {
				if (slicePrediction.classes[i] === cls) {
					sum += area(slicePrediction.boxes[i]);
				}
			}
		}

		return sum * pixelSpacing.row * pixelSpacing.col * 1_000_000; // µm²
	}

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

		setSelectedExamIndex(state.activeTooltipIndex as number);
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Total lesion area per class (in µm²)</CardTitle>
			</CardHeader>

			<CardContent>
				<div className="h-[300px] bg-secondary">
					<ChartContainer className="w-full h-full" config={chartConfig}>
						<LineChart data={data} onClick={handleChartClick}>
							<XAxis
								dataKey="date"
								type="number"
								scale="time"
								domain={["auto", "auto"]}
								tickFormatter={(ts) => new Date(ts).toDateString()}
							/>
							<YAxis />
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(timestamp) => new Date(Number(timestamp)).toDateString()}
									/>
								}
							/>

							{selectedModelClasses.map((className, cls) => (
								<Line
									key={cls}
									dataKey={className}
									type="monotone"
									stroke={`var(--color-${className})`}
									strokeWidth={2}
									dot={{ r: 3 }}
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

export default SliceProgression;
