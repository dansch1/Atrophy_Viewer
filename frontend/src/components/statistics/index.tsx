import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/context/ViewerStateProvider";
import Progression from "./Progression";

const Statistics: React.FC = () => {
	const { showStats } = useViewer();

	if (!showStats) {
		return null;
	}

	return (
		<div className="h-full flex flex-col p-2">
			<Tabs defaultValue="time" className="flex-1 flex flex-col">
				<TabsList className="w-full">
					<TabsTrigger value="time" className="flex-1">
						Progression
					</TabsTrigger>
					<TabsTrigger value="test" className="flex-1">
						Test
					</TabsTrigger>
				</TabsList>

				<TabsContent value="time" className="flex-1">
					<Progression></Progression>
				</TabsContent>
				<TabsContent value="test" className="flex-1"></TabsContent>
			</Tabs>
		</div>
	);
};

export default Statistics;
