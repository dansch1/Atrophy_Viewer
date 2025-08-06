import { useViewer } from "@/context/ViewerStateProvider";
import { Loader2 } from "lucide-react";

export function GlobalLoader() {
	const { loadingModels, loadingAnnotations } = useViewer();
	const isLoading = loadingModels || loadingAnnotations.size > 0;

	if (!isLoading) {
		return null;
	}

	return (
		<div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background/80 border rounded px-3 py-1 shadow">
			<Loader2 className="w-4 h-4 animate-spin text-primary" />
			<span className="text-sm text-foreground">Loading...</span>
		</div>
	);
}
