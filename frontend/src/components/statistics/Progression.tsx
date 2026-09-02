import type { VolumePrediction } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import type { PixelSpacing } from "@/lib/dicom";
import { area } from "@/lib/postprocess";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

const Progression: React.FC = () => {
	const {
		currentPairs,
		setSelectedPair,
		selectedModel,
		selectedModelInfo,
		selectedModelClasses,
		hiddenClasses,
		processedPredictions,
		selectedModelColors,
	} = useViewer();

	const data = useMemo(() => {
		if (!selectedModel || !selectedModelInfo?.capabilities.boxes || !selectedModelClasses) {
			return null;
		}

		return currentPairs
			.map((pair) => {
				const volume = pair.volume;
				const key = volume.sopInstanceUID;
				const volumePrediction = processedPredictions.get(selectedModel)?.get(key);
				const dateMs = volume.acquisitionDate.getTime();
				const row: Record<string, number> = { date: dateMs };

				if (!volumePrediction) {
					return row;
				}

				for (let cls = 0; cls < selectedModelClasses.length; cls++) {
					row[selectedModelClasses[cls]] = sumAreaForClass(volumePrediction, cls, volume.pixelSpacing);
				}

				return row;
			})
			.sort((a, b) => a.date - b.date);
	}, [currentPairs, selectedModel, selectedModelInfo, selectedModelClasses, processedPredictions]);

	function sumAreaForClass(volumePrediction: VolumePrediction, cls: number, pixelSpacing: PixelSpacing): number {
		let sum = 0;
		for (const slicePrediction of volumePrediction) {
			if (slicePrediction?.kind !== "detection") {
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

		setSelectedPair(state.activeTooltipIndex as number);
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Total lesion area per class (in µm²)</CardTitle>
			</CardHeader>

			{data && (
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
											labelFormatter={(_, payload) => {
												const ts = payload?.[0]?.payload?.date;
												return typeof ts === "number" ? new Date(ts).toDateString() : "";
											}}
										/>
									}
								/>

								{selectedModelClasses?.map((className, cls) => (
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
			)}
		</Card>
	);
};

export default Progression;
