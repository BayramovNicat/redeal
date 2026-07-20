import type { FeatureGroup, Tooltip } from "leaflet";
import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state as globalState } from "@/core/state";
import type { MapPin } from "@/core/types";
import { debounce, fmt, frag, tTier } from "@/core/utils";
import { initLeaflet } from "@/ui/map-base";
import { fetchMapPins } from "./api";
import { createPinMarker } from "./pins";
import type { MapViewState } from "./types";

const state: MapViewState = {
	lmap: null,
	pinGroup: null as unknown as FeatureGroup,
	fitDone: false,
	abortController: null,
	sharedTooltip: null as unknown as Tooltip,
};

let mapContainer: HTMLElement | null = null;

const debouncedFetch = debounce(async () => {
	if (!state.lmap) return;
	const pins = await fetchMapPins(state);
	if (pins === null) return;

	const filteredPins = pins.filter(
		(p) => !globalState.hidden.has(p.source_url),
	);

	state.pinGroup.clearLayers();
	for (const pin of filteredPins) {
		const cm = createPinMarker(pin, state);
		cm.addTo(state.pinGroup);
	}

	if (filteredPins.length > 0 && !state.fitDone && state.lmap) {
		state.fitDone = true;
		const { latLngBounds } = await import("leaflet");
		const b = latLngBounds(filteredPins.map((p) => [p.lat, p.lng]));
		state.lmap.fitBounds(b.pad(0.12));
	}

	updateResultsMeta(filteredPins);
}, 150);

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
		if (state.lmap) {
			state.lmap.remove();
			state.lmap = null;
		}
		mapContainer = null;
	};
}

export async function showMapView(): Promise<void> {
	if (!mapContainer) return;
	mapContainer.style.display = "";

	if (!state.lmap) {
		const { featureGroup, tooltip: leafletTooltip } = await import("leaflet");
		state.pinGroup = featureGroup();
		state.sharedTooltip = leafletTooltip({
			sticky: false,
			direction: "top",
			opacity: 1,
			className:
				"!bg-(--surface-3) !border-(--border-h) !rounded-(--r-sm) !shadow-[0_8px_24px_rgba(0,0,0,0.5)] !p-0 [&::before]:!hidden",
		});

		state.lmap = await initLeaflet(mapContainer);
		state.lmap.setView([40.396698, 49.8664491], 13);
		state.pinGroup.addTo(state.lmap);
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
		.flatMap((tb, i) => {
			const badge = frag`<span style="color:${tb.color}">${tierCounts[tb.tier]} ${tTier(tb.tier, true)}</span>`;
			return i === 0
				? [" ", badge]
				: [" ", frag`<span style="color:var(--border)">·</span>`, " ", badge];
		});

	meta.replaceChildren(
		frag`<strong>${fmt(total, 0)}</strong> ${
			total !== 1 ? t("results") : t("result")
		}${distNodes.length ? frag` <span style="color:var(--border)">·</span>` : ""}${distNodes}`,
	);
}
