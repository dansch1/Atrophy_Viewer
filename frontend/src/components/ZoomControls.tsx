import { Button } from "@/components/ui/button";
import { Crosshair, Minus, Plus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useControls, useTransformEffect } from "react-zoom-pan-pinch";

export const ZoomControls = () => {
	const { zoomIn, zoomOut, resetTransform, centerView } = useControls();
	const [scale, setScale] = useState(1);

	useTransformEffect(({ state }) => {
		setScale(state.scale);
	});

	return (
		<div className="absolute top-4 right-4 z-10 flex flex-col items-center gap-2 p-2 backdrop-blur-md border rounded shadow">
			<Button size="icon" variant="outline" onClick={() => zoomIn()}>
				<Plus className="w-4 h-4" />
			</Button>
			<Button size="icon" variant="outline" onClick={() => zoomOut()}>
				<Minus className="w-4 h-4" />
			</Button>
			<Button size="icon" variant="outline" onClick={() => resetTransform()}>
				<RefreshCcw className="w-4 h-4" />
			</Button>
			<Button size="icon" variant="outline" onClick={() => centerView()}>
				<Crosshair className="w-4 h-4" />
			</Button>
			<div className="text-sm text-center">Zoom: {scale.toFixed(2)}x</div>
		</div>
	);
};
