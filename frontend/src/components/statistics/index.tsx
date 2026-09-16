import { useViewer } from "@/context/ViewerStateProvider";
import SliceStatistics from "./slice/SliceStatistics";

const Statistics: React.FC = () => {
	const { processedCurrentResult } = useViewer();

	if (!processedCurrentResult) {
		return (
			<div className="h-full flex items-center justify-center p-2">
				<p className="text-sm text-muted-foreground">No predictions available yet.</p>
			</div>
		);
	}

	switch (processedCurrentResult.scope) {
		case "slice":
			return <SliceStatistics />;
		default:
			return (
				<div className="h-full flex items-center justify-center p-2">
					<p className="text-sm text-muted-foreground">
						Statistics are not available for this prediction scope yet.
					</p>
				</div>
			);
	}
};

export default Statistics;
