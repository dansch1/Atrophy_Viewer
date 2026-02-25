import type { VolumePredictions } from "@/api/prediction";
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
		selectedModelLabels,
		hiddenLabels,
		processedPredictions,
		selectedModelColors,
	} = useViewer();

	const data = useMemo(() => {
		if (!selectedModel || !selectedModelLabels) {
			return null;
		}

		return currentPairs
			.map((pair) => {
				const volume = pair.volume;
				const key = volume.sopInstanceUID;
				const volumePredictions = processedPredictions.get(selectedModel)?.get(key);
				const dateMs = volume.acquisitionDate.getTime();
				const row: Record<string, number> = { date: dateMs };

				if (!volumePredictions) {
					return row;
				}

				for (let i = 0; i < selectedModelLabels?.length; i++) {
					row[selectedModelLabels[i]] = sumAreaForClass(volumePredictions, i, volume.pixelSpacing);
				}

				return row;
			})
			.sort((a, b) => a.date - b.date);
	}, [currentPairs, selectedModel, selectedModelLabels, processedPredictions]);

	function sumAreaForClass(
		volumePredictions: VolumePredictions | undefined,
		cls: number,
		pixelSpacing: PixelSpacing,
	): number {
		if (!volumePredictions) {
			return 0;
		}

		let sum = 0;
		for (const slicePredictions of volumePredictions) {
			const { boxes, classes } = slicePredictions;

			for (let i = 0; i < boxes.length; i++) {
				if (classes[i] === cls) {
					sum += area(boxes[i]);
				}
			}
		}

		return sum * pixelSpacing.row * pixelSpacing.col * 1_000_000; // µm²
	}

	const chartConfig = (() => {
		if (!selectedModelLabels) {
			return {};
		}

		const entries = selectedModelLabels.map((label, i) => [
			label,
			{ label, color: selectedModelColors.getColorByIndex(i) },
		]);

		return Object.fromEntries(entries);
	})();

	const handleChartClick = (state: any) => {
		if (state == null || state.activeTooltipIndex == null) {
			return;
		}

		const index = state.activeTooltipIndex as number;
		setSelectedPair(index);
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

								{selectedModelLabels?.map((label, cls) => (
									<Line
										key={cls}
										dataKey={label}
										type="monotone"
										stroke={`var(--color-${label})`}
										strokeWidth={2}
										dot={{ r: 3 }}
										isAnimationActive={false}
										hide={hiddenLabels.has(cls)}
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
