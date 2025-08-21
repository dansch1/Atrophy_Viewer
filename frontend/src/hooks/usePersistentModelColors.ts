import { LabelColors } from "@/lib/labelColors";
import { usePersistentState } from "./usePersistentState";

export type ModelColors = Record<string, LabelColors>;

export function usePersistentModelColors(key: string) {
	return usePersistentState<ModelColors>(
		key,
		{},
		{
			serialize: (state) =>
				JSON.stringify(
					Object.fromEntries(Object.entries(state).map(([modelName, map]) => [modelName, map.toJSON()]))
				),
			deserialize: (stored) => {
				const parsed = JSON.parse(stored) as Record<string, { labels: string[]; colors: string[] }>;
				const result: ModelColors = {};

				for (const modelName in parsed) {
					result[modelName] = LabelColors.fromJSON(parsed[modelName]);
				}

				return result;
			},
		}
	);
}
