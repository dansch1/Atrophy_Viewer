import type { Prediction, PredictionResult } from "@/api/prediction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useViewer } from "@/context/ViewerStateProvider";
import type { PixelSpacing, SlicePosition, VolumeData } from "@/lib/dicom";
import { area } from "@/lib/postprocess";
import { distance } from "@/lib/vec2";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

type ExamPredictionData = {
	examIndex: number;
	date: number;
	volume?: VolumeData;
	prediction?: PredictionResult;
};

const SliceProgression: React.FC = () => {
	const {
		currentExams,
		selectedExamIndex,
		setSelectedExamIndex,
		selectedVolume,
		selectedSlice,
		setSelectedSlice,
		selectedModel,
		selectedModelClasses,
		hiddenClasses,
		processedPredictions,
		selectedModelColors,
	} = useViewer();

	const examData = useMemo<ExamPredictionData[]>(() => {
		if (!selectedModel) {
			return [];
		}

		const modelPredictions = processedPredictions.get(selectedModel);

		return currentExams.flatMap((exam, examIndex) => {
			if (!exam.examDate) {
				return [];
			}

			const volume = examIndex === selectedExamIndex && selectedVolume ? selectedVolume : exam.volumes[0];

			return [
				{
					examIndex,
					date: exam.examDate.getTime(),
					volume,
					prediction: volume ? modelPredictions?.get(volume.id) : undefined,
				},
			];
		});
	}, [currentExams, selectedExamIndex, selectedVolume, selectedModel, processedPredictions]);

	const meanAreaData = useMemo(() => {
		if (!selectedModelClasses) {
			return null;
		}

		return examData.map(({ examIndex, date, volume, prediction }) => {
			const row: Record<string, number> = { date, examIndex };
			if (!volume || !prediction || prediction.scope !== "slice") {
				return row;
			}

			for (let cls = 0; cls < selectedModelClasses.length; cls++) {
				row[selectedModelClasses[cls]] = meanAreaForClass(prediction, cls, volume.pixelSpacing);
			}

			return row;
		});
	}, [examData, selectedModelClasses]);

	const matchedSliceData = useMemo(() => {
		if (!selectedModelClasses || !selectedVolume) {
			return null;
		}

		const ref = selectedVolume.slicePositions[selectedSlice];
		if (!ref) {
			return null;
		}

		return examData.map(({ examIndex, date, volume, prediction }) => {
			const row: Record<string, number> = { date, examIndex };
			if (!volume || !prediction || prediction.scope !== "slice") {
				return row;
			}

			const match = examIndex === selectedExamIndex ? selectedSlice : matchSlice(ref, volume.slicePositions);
			if (match === undefined) {
				return row;
			}

			row.sliceIndex = match;
			for (let cls = 0; cls < selectedModelClasses.length; cls++) {
				row[selectedModelClasses[cls]] = areaForClass(prediction.items[match], cls, volume.pixelSpacing);
			}

			return row;
		});
	}, [examData, selectedExamIndex, selectedVolume, selectedSlice, selectedModelClasses]);

	function meanAreaForClass(volumePrediction: PredictionResult, cls: number, pixelSpacing: PixelSpacing): number {
		let sum = 0;
		let count = 0;
		for (const prediction of volumePrediction.items) {
			if (prediction?.kind !== "object_detection") {
				continue;
			}

			sum += areaForClass(prediction, cls, pixelSpacing);
			count++;
		}

		return count > 0 ? sum / count : 0;
	}

	function areaForClass(prediction: Prediction | null, cls: number, pixelSpacing: PixelSpacing): number {
		if (prediction?.kind !== "object_detection") {
			return 0;
		}

		let sum = 0;
		for (let i = 0; i < prediction.boxes.length; i++) {
			if (prediction.classes[i] === cls) {
				sum += area(prediction.boxes[i]);
			}
		}

		return sum * pixelSpacing.row * pixelSpacing.col;
	}

	function matchSlice(reference: SlicePosition, target: SlicePosition[]): number | undefined {
		if (target.length === 0) {
			return undefined;
		}

		let closestIndex = 0;
		let closestDistance = sliceDistance(reference, target[0]);
		for (let i = 1; i < target.length; i++) {
			const currentDistance = sliceDistance(reference, target[i]);

			if (currentDistance < closestDistance) {
				closestDistance = currentDistance;
				closestIndex = i;
			}
		}

		return closestIndex;
	}

	function sliceDistance(a: SlicePosition, b: SlicePosition): number {
		const direct = distance(a.p0, b.p0) + distance(a.p1, b.p1);
		const flipped = distance(a.p0, b.p1) + distance(a.p1, b.p0);
		return Math.min(direct, flipped) / 2;
	}

	if (!meanAreaData || !matchedSliceData || !selectedModelClasses) {
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

	const handleMeanAreaClick = (state: any) => {
		const row = state?.activePayload?.[0]?.payload;
		if (!row) {
			return;
		}

		setSelectedExamIndex(row.examIndex);
	};

	const handleMatchedSliceClick = (state: any) => {
		const row = state?.activePayload?.[0]?.payload;
		if (!row || row.sliceIndex === undefined) {
			return;
		}

		setSelectedExamIndex(row.examIndex);
		setSelectedSlice(row.sliceIndex);
	};

	const renderChart = (title: string, chartData: Record<string, number>[], onClick: (state: any) => void) => (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>

			<CardContent>
				<div className="h-[300px] bg-secondary">
					<ChartContainer className="w-full h-full" config={chartConfig}>
						<LineChart data={chartData} onClick={onClick}>
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
									<ChartTooltipContent labelFormatter={(ts) => new Date(Number(ts)).toDateString()} />
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

	return (
		<div className="space-y-2">
			{renderChart("Mean lesion area per class (in mm²)", meanAreaData, handleMeanAreaClick)}
			{renderChart("Lesion area at selected B-scan position (in mm²)", matchedSliceData, handleMatchedSliceClick)}
		</div>
	);
};

export default SliceProgression;
