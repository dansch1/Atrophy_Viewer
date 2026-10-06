import { useViewer } from "@/context/ViewerStateProvider";
import StatisticsTabs from "../StatisticsTabs";
import Slice3DView from "./Slice3DView";
import SliceClassScores from "./SliceClassScores";
import SliceProgression from "./SliceProgression";

const SliceStatistics: React.FC = () => {
	const { currentExams, selectedModelInfo } = useViewer();

	if (!selectedModelInfo) {
		return null;
	}

	if (!currentExams.some((exam) => exam.volumes.length > 0)) {
		return (
			<div className="h-full flex items-center justify-center p-2">
				<p className="text-sm text-muted-foreground">No OCT volumes are available for this patient and eye.</p>
			</div>
		);
	}

	switch (selectedModelInfo.task) {
		case "classification":
			return (
				<StatisticsTabs
					defaultValue="scores"
					tabs={[
						{
							value: "scores",
							label: "Class Scores",
							content: <SliceClassScores />,
						},
					]}
				/>
			);
		case "object_detection":
			return (
				<StatisticsTabs
					defaultValue="progression"
					tabs={[
						{
							value: "progression",
							label: "Progression",
							content: <SliceProgression />,
						},
						{
							value: "3d",
							label: "3D View",
							content: <Slice3DView />,
						},
					]}
				/>
			);
		default:
			return (
				<div className="h-full flex items-center justify-center p-2">
					<p className="text-sm text-muted-foreground">Statistics are not yet available for this task.</p>
				</div>
			);
	}
};

export default SliceStatistics;
