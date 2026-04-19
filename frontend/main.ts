import { ge, html, renderToastsContainer, trustScriptURL } from "./core/utils";
import { initGallery } from "./dialogs/gallery";
import { renderHeatmapModal } from "./dialogs/heatmap";
import { initPropertyDetail } from "./dialogs/property-detail";
import { initAlerts } from "./features/alerts";
import { renderDistrictStatsModal } from "./features/district-stats";
import { initHeader } from "./features/header";
import { initProducts } from "./features/products";
import { initSearch } from "./features/search";
import { initTrend } from "./features/trend";
import { initTooltip } from "./ui/tooltip";

/**
 * Main application entry point.
 * Initializes the layout and all feature modules.
 */

// 1. Initial Layout
const root = document.getElementById("app") as HTMLElement;
if (!root) throw new Error("Root element #app not found");

root.appendChild(html`
  <div class="max-w-290 mx-auto px-5 pt-0 pb-20">
    <header id="header-area"></header>
    <section id="search-area"></section>
    <section id="trend-area"></section>
    <main id="products-area"></main>
  </div>
`);

// 2. Feature Initialization
// Each feature returns a cleanup function for its lifecycle management.
const cleanups: (() => void)[] = [
	initProducts(ge("products-area")),
	initTrend(ge("trend-area")),
	initSearch(ge("search-area")),
	initHeader(ge("header-area")),
	initAlerts(root),
	initGallery(root),
	initTooltip(root),
	initPropertyDetail(root),
];

// 3. Global Static Modals & Utilities
renderHeatmapModal(root);
renderDistrictStatsModal(root);
renderToastsContainer(root);

// 4. Handle cleanup on window pagehide
window.addEventListener("pagehide", (e) => {
	if (!e.persisted) {
		cleanups.forEach((fn) => {
			if (typeof fn === "function") fn();
		});
	}
});

// 5. Dev hot-reload
declare const __DEV__: boolean;
if (__DEV__) {
	const devWs = new WebSocket("ws://localhost:3001");
	devWs.onmessage = () => location.reload();
}

// 6. Register Service Worker
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register(trustScriptURL("/sw.js") as string)
			.then((registration) => {
				console.log("SW registered:", registration);
			})
			.catch((error) => {
				console.log("SW registration failed:", error);
			});
	});
}
