import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useViewer } from "@/context/ViewerStateProvider";

export function GlobalLoader() {
	const { loadingModels, loadingAnnotations } = useViewer();

	const anyModelLoading = Array.from(loadingAnnotations.values()).some((s) => s.size > 0);
	const isLoading = loadingModels || anyModelLoading;

	if (!isLoading) {
		return null;
	}

	return (
		<div className="fixed top-2 left-1/2 -translate-x-1/2 z-100 flex-col gap-4 bg-background/80 border rounded shadow">
			<Item variant="muted" size="sm">
				<ItemMedia>
					<Spinner />
				</ItemMedia>
				<ItemContent>
					<ItemTitle className="line-clamp-1">Loading...</ItemTitle>
				</ItemContent>
			</Item>
		</div>
	);
}
