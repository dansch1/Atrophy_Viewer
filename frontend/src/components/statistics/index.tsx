import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Lesion3DView from "./Lesion3DView";
import Progression from "./Progression";

const Statistics: React.FC = () => {
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
};

export default Statistics;
