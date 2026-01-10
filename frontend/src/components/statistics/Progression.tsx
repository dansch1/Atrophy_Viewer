import type { VolumePredictions } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import type { PixelSpacing } from "@/lib/dicom";
import { area } from "@/lib/postprocess";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";

const Progression: React.FC = () => {
	const {
		currentPairs,
		setSelectedPair,
		selectedModel,
		selectedModelLabels,
		hiddenLabels,
		setHiddenLabels,
		processedPredictions,
		selectedModelColors,
	} = useViewer();

	const data = useMemo(() => {
		if (!selectedModel || !selectedModelLabels) {
			return [];
		}

		return currentPairs
			.map((pair) => {
				const volume = pair.volume;
				const key = volume.sopInstanceUID;
				const volumePredictions = processedPredictions.get(selectedModel)?.get(key);
				const dateMs = volume.acquisitionDate.getTime();
				const row: Record<string, number> = { date: dateMs };

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
		pixelSpacing: PixelSpacing
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

	const renderLegend = () => {
		if (!selectedModelLabels) {
			return null;
		}

		return (
			<div className="flex flex-wrap justify-center w-full gap-2 mt-2 text-xs">
				{selectedModelLabels.map((label, cls) => {
					return (
						<Button
							key={cls}
							variant="outline"
							size="sm"
							onClick={() => toggleLabel(cls)}
							className={cn("gap-1 px-2 py-1 text-xs", hiddenLabels.has(cls) && "opacity-40")}
						>
							<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: `var(--color-${label})` }} />
							<span>{label}</span>
						</Button>
					);
				})}
			</div>
		);
	};

	const toggleLabel = (label: number) => {
		setHiddenLabels((prev) => {
			const next = new Set(prev);
			next.has(label) ? next.delete(label) : next.add(label);
			return next;
		});
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Total lesion area per class (in µm²)</CardTitle>
			</CardHeader>

			{data.length > 0 && (
				<CardContent>
					<ChartContainer config={chartConfig} className="w-full h-[300px] bg-secondary">
						<LineChart data={data} onClick={handleChartClick}>
							<XAxis
								dataKey="date"
								type="number"
								domain={["auto", "auto"]}
								tickFormatter={(ts) => new Date(ts).toDateString()}
							/>
							<YAxis />
							<ChartTooltip content={<ChartTooltipContent />} />

							<Legend
								verticalAlign="top"
								align="center"
								wrapperStyle={{ width: "100%" }}
								content={renderLegend}
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
				</CardContent>
			)}
		</Card>
	);
};

export default Progression;
