import { bus, EVENTS } from "@/core/events";
import { initI18n } from "@/core/i18n";
import { html, renderToastsContainer, trustScriptURL } from "@/core/utils";
import { fetchAuthUser } from "@/features/auth/api";
import { initHeader } from "@/features/header";
import { initProducts } from "@/features/products/index";
import { initSearch } from "@/features/search";
import {
	getPreloadedTrendData,
	preloadInitialSearch,
} from "@/features/search/preload";
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
	await initI18n();
	const loginArea = html`<main></main>`;
	root.appendChild(loginArea);
	const { initLogin } = await import("@/features/login");
	cleanups.push(initLogin(loginArea));
} else {
	const preloadPromise = preloadInitialSearch();
	await Promise.all([initI18n(), fetchAuthUser(), preloadPromise]);

	const headerArea = html`<header></header>`;
	const searchArea = html`<section></section>`;
	const trendArea = html`<section></section>`;
	const productsArea = html`<main id="products-area"></main>`;

	const initialLoc = new URLSearchParams(window.location.search).get(
		"location",
	);
	const hasPreloadedTrend =
		!!initialLoc &&
		initialLoc !== "__all__" &&
		!initialLoc.includes(",") &&
		!!getPreloadedTrendData(initialLoc);

	if (hasPreloadedTrend) {
		const { initTrend } = await import("@/features/trend/index");
		cleanups.push(initTrend(trendArea));
	} else {
		bus.once(EVENTS.LOCATION_CHANGED, async (loc) => {
			if (!loc || loc === "__all__") return;
			const { initTrend } = await import("@/features/trend/index");
			cleanups.push(initTrend(trendArea));
			bus.emit(EVENTS.LOCATION_CHANGED, loc);
		});
	}

	root.appendChild(html`
		<div class="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24">
			${headerArea}
			${searchArea}
			${trendArea}
			${productsArea}
		</div>
	`);

	cleanups.push(
		initProducts(productsArea),
		initSearch(searchArea),
		initHeader(headerArea),
		initTooltip(root),
	);
}

// Heavy features are loaded on demand.

bus.once(EVENTS.ALERTS_OPEN, async () => {
	const { initAlerts } = await import("@/features/alerts/index");
	cleanups.push(initAlerts(root));
	bus.emit(EVENTS.ALERTS_OPEN);
});

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
declare const __DEV_RELOAD_PORT__: number;
if (__DEV__ && __DEV_RELOAD_PORT__) {
	const host = window.location.hostname || "localhost";
	const devWs = new WebSocket(`ws://${host}:${__DEV_RELOAD_PORT__}`);
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
