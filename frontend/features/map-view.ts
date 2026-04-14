import {
	type CircleMarker,
	circleMarker,
	featureGroup,
	type map as LeafletMap,
} from "leaflet";
import { bus, EVENTS } from "../core/events";
import { state } from "../core/state";
import type { MapPin, Property } from "../core/types";
import { fmt, toast } from "../core/utils";
import { openPropertyDetail } from "../dialogs/property-detail";
import { initLeaflet } from "../ui/map-base";
import { ts } from "../ui/tier";

let lmap: ReturnType<typeof LeafletMap> | null = null;
const pinLayers: CircleMarker[] = [];
let mapContainer: HTMLElement | null = null;
let isFetching = false;
let fitDone = false;

function clearPins(): void {
	for (const l of pinLayers) l.remove();
	pinLayers.length = 0;
}

async function fetchAndRender(): Promise<void> {
	if (!lmap || isFetching) return;
	const params = new URLSearchParams(window.location.search);
	if (!params.get("location")) return;

	isFetching = true;
	fitDone = false;
	clearPins();

	try {
		const res = await fetch(`/api/deals/map-pins?${params}`);
		const d = (await res.json()) as {
			error?: string;
			count?: number;
			data?: MapPin[];
		};
		if (d.error) {
			toast(d.error, true);
			return;
		}
		if (!d.data?.length || !lmap) return;

		for (const pin of d.data) {
			const tStyle = ts(pin.tier);
			const cm = circleMarker([pin.lat, pin.lng], {
				radius: 7,
				color: tStyle.hex,
				fillColor: tStyle.hex,
				fillOpacity: 0.82,
				weight: 1.5,
				opacity: 1,
			});

			const roomsStr = pin.rooms ? ` · ${pin.rooms}br` : "";
			const locHtml = pin.location_name
				? `<div style="font-size:10px;color:var(--muted);margin-top:1px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pin.location_name}</div>`
				: "";
			cm.bindTooltip(
				`<div style="padding:8px 12px;min-width:130px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">₼ ${fmt(pin.price)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">₼${fmt(pin.price_per_sqm, 0)}/m²${roomsStr}</div>
          ${locHtml}
          <div style="margin-top:5px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:9999px;display:inline-block;color:${tStyle.c};background:${tStyle.bg};border:1px solid ${tStyle.b}">${pin.tier}</div>
        </div>`,
				{
					sticky: false,
					direction: "top",
					opacity: 1,
					className:
						"!bg-(--surface-3) !border-(--border-h) !rounded-(--r-sm) !shadow-[0_8px_24px_rgba(0,0,0,0.5)] !p-0 [&::before]:!hidden",
				},
			);

			cm.on("mouseover", () => cm.setRadius(10));
			cm.on("mouseout", () => cm.setRadius(7));

			cm.on("click", async () => {
				try {
					const r = await fetch("/api/deals/by-urls", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ urls: [pin.source_url] }),
					});
					const json = (await r.json()) as { data?: Property[] };
					if (json.data?.[0]) openPropertyDetail(json.data[0]);
				} catch (e) {
					toast((e as Error).message, true);
				}
			});

			if (lmap) {
				cm.addTo(lmap);
				pinLayers.push(cm);
			}
		}

		if (pinLayers.length > 0 && !fitDone && lmap) {
			fitDone = true;
			const group = featureGroup(pinLayers);
			lmap.fitBounds(group.getBounds().pad(0.12));
		}
	} catch (e) {
		toast((e as Error).message, true);
	} finally {
		isFetching = false;
	}
}

export function initMapView(container: HTMLElement): () => void {
	mapContainer = container;

	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => {
		if (state.currentView === "map") {
			fitDone = false;
			void fetchAndRender();
		}
	});

	return () => {
		offDeals();
		clearPins();
		if (lmap) {
			lmap.remove();
			lmap = null;
		}
		mapContainer = null;
	};
}

export function showMapView(): void {
	if (!mapContainer) return;
	mapContainer.style.display = "";

	if (!lmap) {
		lmap = initLeaflet(mapContainer.id);
		lmap.setView([40.38, 49.87], 12);
	} else {
		lmap.invalidateSize();
	}

	void fetchAndRender();
}

export function hideMapView(): void {
	if (mapContainer) mapContainer.style.display = "none";
}
