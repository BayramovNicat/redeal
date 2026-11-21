import type { FeatureGroup, Renderer, Tooltip } from "leaflet";
import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state as globalState } from "@/core/state";
import type { MapPin } from "@/core/types";
import { debounce, fmt, frag, html, tTier } from "@/core/utils";
import { initLeaflet } from "@/ui/map-base";
import { fetchMapPins } from "./api";
import { createPinMarker } from "./pins";
import type { MapViewState } from "./types";

const MAP_THEME_KEY = "re-map-theme";
const CANVAS_PIN_THRESHOLD = 150;

const TIER_PRIORITY: Record<string, number> = {
	Overpriced: 0,
	"Market Price": 1,
	"Fair Price": 2,
	"Good Deal": 3,
	"High Value Deal": 4,
};

const state: MapViewState = {
	lmap: null,
	pinGroup: null as unknown as FeatureGroup,
	fitDone: false,
	abortController: null,
	sharedTooltip: null as unknown as Tooltip,
};

let mapContainer: HTMLElement | null = null;
let hudElements: HTMLElement[] = [];
let latestPins: MapPin[] = [];
let canvasRenderer: Renderer | null = null;
let svgRenderer: Renderer | null = null;

async function fitPins(animate = true) {
	if (!state.lmap || latestPins.length === 0) return;
	const { latLngBounds } = await import("leaflet");
	const b = latLngBounds(latestPins.map((p) => [p.lat, p.lng]));
	state.lmap.fitBounds(b.pad(0.12), { animate });
}

const debouncedFetch = debounce(async () => {
	if (!state.lmap) return;
	const pins = await fetchMapPins(state);
	if (pins === null || !state.lmap) return;

	const filteredPins = pins
		.filter((p) => !globalState.hidden.has(p.source_url))
		// Render higher-value deals last so they sit on top in dense clusters
		.sort(
			(a, b) => (TIER_PRIORITY[a.tier] ?? 1) - (TIER_PRIORITY[b.tier] ?? 1),
		);

	latestPins = filteredPins;

	const { featureGroup } = await import("leaflet");
	const useCanvas = filteredPins.length > CANVAS_PIN_THRESHOLD;
	const renderer = useCanvas
		? (canvasRenderer ?? undefined)
		: (svgRenderer ?? undefined);

	// Detach previous group once, build all markers in memory, then attach in a single batch
	if (state.pinGroup) {
		state.pinGroup.remove();
		state.pinGroup.clearLayers();
	}

	const markers = new Array(filteredPins.length);
	for (let i = 0; i < filteredPins.length; i++) {
		markers[i] = createPinMarker(filteredPins[i], state, renderer);
	}

	state.pinGroup = featureGroup(markers);
	state.pinGroup.addTo(state.lmap);

	if (filteredPins.length > 0 && !state.fitDone && state.lmap) {
		state.fitDone = true;
		await fitPins(filteredPins.length <= CANVAS_PIN_THRESHOLD);
	}

	updateResultsMeta(filteredPins);
}, 150);

function mountMapHud(container: HTMLElement): void {
	if (hudElements.length > 0) return;
	container.classList.add("relative");

	let isDark = localStorage.getItem(MAP_THEME_KEY) !== "light";
	const applyTheme = () => {
		container.classList.toggle("map-dark-tiles", isDark);
		container.classList.toggle("map-light-tiles", !isDark);
		themeBtn.textContent = isDark ? "Dark" : "Light";
	};

	const themeBtn = html`<button
		type="button"
		class="h-7 px-2.75 rounded-full text-[11px] font-semibold text-(--text-2) hover:text-(--text) hover:bg-white/8 transition-colors"
		title="Toggle map style"
	>
		Dark
	</button>` as HTMLButtonElement;

	themeBtn.onclick = (e) => {
		e.stopPropagation();
		isDark = !isDark;
		localStorage.setItem(MAP_THEME_KEY, isDark ? "dark" : "light");
		applyTheme();
	};

	const fitBtn = html`<button
		type="button"
		class="h-7 px-2.5 rounded-full text-[11px] font-semibold text-(--text-2) hover:text-(--text) hover:bg-white/8 transition-colors"
		title="Fit all pins"
	>
		⌖ Fit
	</button>` as HTMLButtonElement;

	fitBtn.onclick = (e) => {
		e.stopPropagation();
		void fitPins(true);
	};

	const topRightHud = html`
		<div
			class="absolute top-3 right-3 z-450 inline-flex items-center gap-0.5 p-1 rounded-full glass-panel bg-(--surface-glass-strong) border border-(--border-h) shadow-(--shadow-float)"
		>
			${themeBtn}
			<div class="w-px h-3.5 bg-(--border) mx-0.5"></div>
			${fitBtn}
		</div>
	`;

	const legendItems = [
		{ tier: "High Value Deal", color: "var(--green)" },
		{ tier: "Good Deal", color: "var(--blue)" },
		{ tier: "Fair Price", color: "var(--yellow)" },
		{ tier: "Overpriced", color: "var(--red)" },
	];

	const legendHud = html`
		<div
			class="absolute bottom-3 left-3 z-450 inline-flex items-center gap-3 px-3.25 py-1.75 rounded-full glass-panel bg-(--surface-glass-strong) border border-(--border-h) shadow-(--shadow-float) pointer-events-none select-none max-[520px]:hidden"
		>
			${legendItems.map(
				(item) => html`
					<span
						class="inline-flex items-center gap-1.5 text-[11px] font-medium text-(--text-2)"
					>
						<span
							class="size-2 rounded-full shrink-0"
							style="background:${item.color};box-shadow:0 0 6px ${item.color}"
						></span>
						${tTier(item.tier, true)}
					</span>
				`,
			)}
		</div>
	`;

	applyTheme();
	container.append(topRightHud, legendHud);
	hudElements = [topRightHud, legendHud];
}

export function initMapView(container: HTMLElement): () => void {
	mapContainer = container;

	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => {
		if (globalState.currentView === "map") {
			state.fitDone = false;
			void debouncedFetch();
		}
	});

	return () => {
		offDeals();
		state.abortController?.abort();
		state.pinGroup?.clearLayers();
		state.sharedTooltip?.remove();
		for (const el of hudElements) el.remove();
		hudElements = [];
		latestPins = [];
		canvasRenderer = null;
		svgRenderer = null;
		if (state.lmap) {
			state.lmap.remove();
			state.lmap = null;
		}
		mapContainer = null;
	};
}

async function createSmoothCanvasRenderer(): Promise<Renderer> {
	const L = await import("leaflet");
	type CanvasInternal = {
		options: { padding: number };
		_map: {
			_animatingZoom?: boolean;
			getSize: () => ReturnType<typeof L.point>;
			getZoom: () => number;
			containerPointToLayerPoint: (
				pt: [number, number] | ReturnType<typeof L.point>,
			) => ReturnType<typeof L.point>;
		};
		_bounds?: ReturnType<typeof L.bounds>;
		_zoom?: number;
		_container: HTMLCanvasElement;
		_ctx: CanvasRenderingContext2D;
		_redrawRequest: number | null;
		fire: (type: string) => void;
	};

	const SmoothCanvas = L.Canvas.extend({
		_update(this: CanvasInternal) {
			if (this._map._animatingZoom && this._bounds) return;

			const map = this._map;
			const mapSize = map.getSize();
			const m = L.Browser.retina ? 2 : 1;
			const p = this.options.padding;
			const expectedW = m * Math.round(mapSize.x * (1 + p * 2));
			const expectedH = m * Math.round(mapSize.y * (1 + p * 2));

			// Skip repositioning & redrawing on short pans that stay inside the padded buffer
			if (
				this._bounds &&
				this._zoom === map.getZoom() &&
				Math.abs(this._container.width - expectedW) <= m * 2 &&
				Math.abs(this._container.height - expectedH) <= m * 2
			) {
				const viewMin = map.containerPointToLayerPoint([0, 0]);
				const viewMax = map.containerPointToLayerPoint(mapSize);
				if (this._bounds.contains(viewMin) && this._bounds.contains(viewMax)) {
					return;
				}
			}

			if (this._redrawRequest) {
				L.Util.cancelAnimFrame(this._redrawRequest);
				this._redrawRequest = null;
			}

			(
				L.Renderer.prototype as unknown as {
					_update: (this: CanvasInternal) => void;
				}
			)._update.call(this);

			const b = this._bounds;
			if (!b?.min) return;
			const container = this._container;
			const size = b.getSize();
			const targetW = m * size.x;
			const targetH = m * size.y;

			L.DomUtil.setPosition(container, b.min);

			// Only reallocate the GPU canvas texture when dimensions actually change
			if (container.width !== targetW || container.height !== targetH) {
				container.width = targetW;
				container.height = targetH;
				container.style.width = `${size.x}px`;
				container.style.height = `${size.y}px`;
			}

			this._ctx.setTransform(m, 0, 0, m, 0, 0);
			this._ctx.clearRect(0, 0, size.x, size.y);
			this._ctx.translate(-b.min.x, -b.min.y);

			this.fire("update");
		},
	});

	return new (
		SmoothCanvas as unknown as new (opts: {
			padding: number;
			tolerance: number;
		}) => Renderer
	)({ padding: 0.3, tolerance: 4 });
}

export async function showMapView(): Promise<void> {
	if (!mapContainer) return;
	mapContainer.style.display = "";

	if (!state.lmap) {
		const {
			featureGroup,
			svg,
			tooltip: leafletTooltip,
		} = await import("leaflet");
		canvasRenderer = await createSmoothCanvasRenderer();
		svgRenderer = svg({ padding: 0.25 });
		state.pinGroup = featureGroup();
		state.sharedTooltip = leafletTooltip({
			sticky: false,
			direction: "top",
			offset: [0, -10],
			opacity: 1,
			className:
				"!bg-(--surface-glass-strong) !border-(--border-h) !rounded-(--r) !shadow-[var(--shadow-float)] !p-0 [&::before]:!hidden",
		});

		state.lmap = await initLeaflet(mapContainer);
		state.lmap.on("movestart zoomstart", () => state.sharedTooltip.remove());
		state.lmap.setView([40.396698, 49.8664491], 13);
		state.pinGroup.addTo(state.lmap);
		mountMapHud(mapContainer);
	}

	requestAnimationFrame(() => state.lmap?.invalidateSize());
	void debouncedFetch();
}

export function hideMapView(): void {
	if (mapContainer) mapContainer.style.display = "none";
}

function updateResultsMeta(pins: MapPin[]) {
	const meta = globalState.refs.resultsMeta;
	if (!meta) return;

	if (pins.length === 0) {
		meta.replaceChildren(
			frag`<span style="color:var(--muted)">${t("noResults")}</span>`,
		);
		return;
	}

	const total = pins.length;
	const tierCounts = pins.reduce<Record<string, number>>((acc, p) => {
		acc[p.tier] = (acc[p.tier] ?? 0) + 1;
		return acc;
	}, {});

	const tierBadges = [
		{ tier: "High Value Deal", color: "var(--green)" },
		{ tier: "Good Deal", color: "var(--blue)" },
		{ tier: "Fair Price", color: "var(--yellow)" },
		{ tier: "Overpriced", color: "var(--red)" },
	];

	const distNodes = tierBadges
		.filter((tb) => tierCounts[tb.tier])
		.map(
			(tb) =>
				frag`<span class="inline-flex items-center gap-1.25 text-xs font-medium" style="color:${tb.color}"><span class="size-1.5 rounded-full shrink-0" style="background:${tb.color}"></span><span class="font-mono-num font-semibold">${tierCounts[tb.tier]}</span> ${tTier(tb.tier, true)}</span>`,
		);

	meta.replaceChildren(
		frag`<span class="inline-flex items-baseline gap-1.5"><strong>${fmt(total, 0)}</strong><span>${
			total !== 1 ? t("results") : t("result")
		}</span></span>${distNodes.length ? frag`<span class="w-px h-3.5 bg-(--border) mx-0.5 hidden sm:inline-block"></span><span class="inline-flex items-center gap-2.5 flex-wrap">${distNodes}</span>` : ""}`,
	);
}
