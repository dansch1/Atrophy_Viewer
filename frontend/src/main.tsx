import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ViewerStateProvider } from "./context/ViewerStateProvider.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ViewerStateProvider>
			<App />
		</ViewerStateProvider>
	</StrictMode>
);
