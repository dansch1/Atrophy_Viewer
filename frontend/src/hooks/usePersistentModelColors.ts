import { ModelColors } from "@/lib/modelColors";
import { usePersistentState } from "./usePersistentState";

export function usePersistentModelColors(key: string) {
	return usePersistentState<Record<string, ModelColors>>(
		key,
		{},
		{
			serialize: (state) =>
				JSON.stringify(
					Object.fromEntries(Object.entries(state).map(([modelName, map]) => [modelName, map.toJSON()])),
				),
			deserialize: (stored) => {
				const parsed = JSON.parse(stored) as Record<string, { labels: string[]; colors: string[] }>;
				const result: Record<string, ModelColors> = {};

				for (const [modelName, obj] of Object.entries(parsed)) {
					result[modelName] = ModelColors.fromJSON(obj);
				}

				return result;
			},
		},
	);
}
