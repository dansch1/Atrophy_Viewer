import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useGlobalLoader } from "@/context/GlobalLoaderProvider";
import { X } from "lucide-react";

export function GlobalLoader() {
	const { isLoading, message, canCancel, cancelCurrent } = useGlobalLoader();

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
					<ItemTitle className="line-clamp-1">{message ?? "Loading..."}</ItemTitle>
				</ItemContent>
				{canCancel && (
					<Button variant="ghost" size="icon" onClick={cancelCurrent}>
						<X className="w-4 h-4" />
					</Button>
				)}
			</Item>
		</div>
	);
}
