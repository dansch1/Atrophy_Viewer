import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

type StatisticsTab = {
	value: string;
	label: string;
	content: ReactNode;
};

type StatisticsTabsProps = {
	tabs: StatisticsTab[];
	defaultValue?: string;
};

const StatisticsTabs: React.FC<StatisticsTabsProps> = ({ tabs, defaultValue = tabs[0]?.value }) => {
	return (
		<div className="h-full min-h-0 flex flex-col p-2">
			<Tabs defaultValue={defaultValue} className="flex-1 min-h-0 flex flex-col">
				<TabsList className="w-full">
					{tabs.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value} className="flex-1">
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>

				{tabs.map((tab) => (
					<TabsContent key={tab.value} value={tab.value} className="flex-1 min-h-0 overflow-y-auto">
						{tab.content}
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
};

export default StatisticsTabs;
