import type { VolumeAnnotations } from "@/api/annotation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import { useEffect, useMemo, useState } from "react";
import { Legend, Line, LineChart, XAxis, YAxis } from "recharts";

const Progression: React.FC = () => {
	const { currentPairs, setSelectedPair, selectedModel, selectedModelLabels, annotations, selectedModelColors } =
		useViewer();

	const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

	useEffect(() => {
		setHiddenSeries(new Set());
	}, [selectedModelLabels]);

	const data = useMemo(() => {
		if (!selectedModel || !selectedModelLabels) {
			return [];
		}

		return currentPairs
			.map((pair) => {
				const volume = pair.volume;
				const key = volume.sopInstanceUID;
				const volumeAnnotations = annotations.get(selectedModel)?.get(key);
				const dateMs = volume.acquisitionDate.getTime();
				const row: Record<string, number> = { date: dateMs };

				for (let i = 0; i < selectedModelLabels?.length; i++) {
					row[selectedModelLabels[i]] = sumWidthForClass(volumeAnnotations, i);
				}

				return row;
			})
			.sort((a, b) => a.date - b.date);
	}, [currentPairs, selectedModel, selectedModelLabels, annotations]);

	function sumWidthForClass(volumeAnnotations: VolumeAnnotations | undefined, cls: number): number {
		if (!volumeAnnotations) {
			return 0;
		}

		let sum = 0;

		for (const slice of volumeAnnotations) {
			for (const sliceAnnotations of slice) {
				if (sliceAnnotations.cls === cls) {
					sum += Math.max(0, sliceAnnotations.x1 - sliceAnnotations.x0);
				}
			}
		}

		return sum;
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
				{selectedModelLabels.map((label) => {
					const isHidden = hiddenSeries.has(label);

					return (
						<button
							key={label}
							type="button"
							onClick={() => toggleSeries(label)}
							className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition ${
								isHidden ? "opacity-40" : ""
							}`}
						>
							<span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `var(--color-${label})` }} />
							<span>{label}</span>
						</button>
					);
				})}
			</div>
		);
	};

	const toggleSeries = (key: string) => {
		setHiddenSeries((prev) => {
			const next = new Set(prev);

			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}

			return next;
		});
	};

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Total lesion width per class</CardTitle>
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

							{selectedModelLabels?.map((label) => (
								<Line
									key={label}
									dataKey={label}
									type="monotone"
									stroke={`var(--color-${label})`}
									strokeWidth={2}
									dot={{ r: 3 }}
									isAnimationActive={false}
									hide={hiddenSeries.has(label)}
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
