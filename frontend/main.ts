import { ge, html, renderToastsContainer } from "./core/utils";
import { renderDescModal } from "./dialogs/description";
import { renderHeatmapModal } from "./dialogs/heatmap";
import { renderMapModal } from "./dialogs/map";
import { initAlerts } from "./features/alerts";
import { initHeader } from "./features/header";
import { initProducts } from "./features/products";
import { initSearch } from "./features/search";
import { initTrend } from "./features/trend";

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
];

// 3. Global Static Modals & Utilities
renderMapModal(root);
renderHeatmapModal(root);
renderDescModal(root);
renderToastsContainer(root);

// 4. Handle cleanup on window unload
window.addEventListener("unload", () => {
	cleanups.forEach((fn) => {
		if (typeof fn === "function") fn();
	});
});
