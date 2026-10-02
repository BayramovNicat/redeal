import { bus, EVENTS } from "@/core/events";
import { html, renderToastsContainer, trustScriptURL } from "@/core/utils";
import { initAlerts } from "@/features/alerts/index";
import { initHeader } from "@/features/header";
import { initProducts } from "@/features/products/index";
import { initSearch } from "@/features/search";
import { initTrend } from "@/features/trend/index";
import { Icons } from "@/ui/icons";
import { initTooltip } from "@/ui/tooltip";

/**
 * Main application entry point.
 * Initializes the layout and all feature modules.
 */

// Side-effect to keep Icons in main chunk
window.__ICONS = Icons;

const root = document.getElementById("app") as HTMLElement;
if (!root) throw new Error("Root element #app not found");

const cleanups: (() => void)[] = [];

if (window.location.pathname === "/login") {
	const loginArea = html`<main></main>`;
	root.appendChild(loginArea);
	const { initLogin } = await import("@/features/login");
	cleanups.push(initLogin(loginArea));
} else {
	const headerArea = html`<header></header>`;
	const searchArea = html`<section></section>`;
	const trendArea = html`<section></section>`;
	const productsArea = html`<main id="products-area"></main>`;

	root.appendChild(html`
		<div class="w-full px-5 pt-0 pb-20">
			${headerArea}
			${searchArea}
			${trendArea}
			${productsArea}
		</div>
	`);

	cleanups.push(
		initProducts(productsArea),
		initTrend(trendArea),
		initSearch(searchArea),
		initHeader(headerArea),
		initTooltip(root),
		initAlerts(root),
	);
}

// Heavy features are loaded on demand.

let galleryReady = false;

async function ensureGallery(): Promise<void> {
	if (galleryReady) return;
	galleryReady = true;
	const { initGallery } = await import("@/features/gallery");
	cleanups.push(initGallery(root));
}

// Property Detail & Gallery (Grouped)
bus.once(EVENTS.PROPERTY_OPEN, async (p) => {
	const { initPropertyDetail } = await import(
		"@/features/property-detail/index"
	);
	cleanups.push(initPropertyDetail(root));
	await ensureGallery();
	bus.emit(EVENTS.PROPERTY_OPEN, p);
});

bus.once(EVENTS.GALLERY_OPEN, async (payload) => {
	await ensureGallery();
	bus.emit(EVENTS.GALLERY_OPEN, payload);
});

// Heatmap
bus.once(EVENTS.HEATMAP_OPEN, async (payload) => {
	const { initHeatmap } = await import("@/features/heatmap/index");
	cleanups.push(initHeatmap(root));
	bus.emit(EVENTS.HEATMAP_OPEN, payload);
});

renderToastsContainer(root);

window.addEventListener("pagehide", (e) => {
	if (!e.persisted) {
		cleanups.forEach((fn) => {
			if (typeof fn === "function") fn();
		});
	}
});

declare const __DEV__: boolean;
if (__DEV__) {
	const devWs = new WebSocket("ws://localhost:3001");
	devWs.onmessage = () => location.reload();
}

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
