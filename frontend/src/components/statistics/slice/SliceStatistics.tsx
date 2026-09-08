import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/context/ViewerStateProvider";
import VolumeLesion3DView from "./Slice3DView";
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

	if (selectedModelInfo.task === "classification") {
		return (
			<div className="h-full flex flex-col p-2">
				<Tabs defaultValue="scores" className="flex-1 flex flex-col">
					<TabsList className="w-full">
						<TabsTrigger value="scores" className="flex-1">
							Class Scores
						</TabsTrigger>
						<TabsTrigger value="overview" className="flex-1">
							Overview
						</TabsTrigger>
					</TabsList>

					<TabsContent value="scores" className="flex-1">
						<SliceClassScores />
					</TabsContent>
					<TabsContent value="overview" className="flex-1"></TabsContent>
				</Tabs>
			</div>
		);
	}

	if (selectedModelInfo.task === "object_detection") {
		return (
			<div className="h-full flex flex-col p-2">
				<Tabs defaultValue="progression" className="flex-1 flex flex-col">
					<TabsList className="w-full">
						<TabsTrigger value="progression" className="flex-1">
							Progression
						</TabsTrigger>
						<TabsTrigger value="3d" className="flex-1">
							3D View
						</TabsTrigger>
					</TabsList>

					<TabsContent value="progression" className="flex-1">
						<SliceProgression />
					</TabsContent>
					<TabsContent value="3d" className="flex-1">
						<VolumeLesion3DView />
					</TabsContent>
				</Tabs>
			</div>
		);
	}

	return (
		<div className="h-full flex items-center justify-center p-2">
			<p className="text-sm text-muted-foreground">Statistics are not yet available for this task.</p>
		</div>
	);
};

export default SliceStatistics;
