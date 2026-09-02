import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/context/ViewerStateProvider";
import ClassScores from "./ClassScores";
import Lesion3DView from "./Lesion3DView";
import Progression from "./Progression";

const Statistics: React.FC = () => {
	const { selectedModelInfo } = useViewer();

	if (!selectedModelInfo) {
		return null;
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
						<ClassScores />
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
						<Progression />
					</TabsContent>
					<TabsContent value="3d" className="flex-1">
						<Lesion3DView />
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

export default Statistics;
