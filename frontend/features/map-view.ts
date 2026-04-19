import {
	type CircleMarker,
	circleMarker,
	featureGroup,
	type map as LeafletMap,
	tooltip as leafletTooltip,
} from "leaflet";
import { bus, EVENTS } from "../core/events";
import { state } from "../core/state";
import type { MapPin, Property } from "../core/types";
import { fmt, fmtFloor, toast } from "../core/utils";
import { openPropertyDetail } from "../dialogs/property-detail";
import { initLeaflet } from "../ui/map-base";
import { ts } from "../ui/tier";

let lmap: ReturnType<typeof LeafletMap> | null = null;
const pinLayers: CircleMarker[] = [];
let mapContainer: HTMLElement | null = null;
let isFetching = false;
let fitDone = false;

const sharedTooltip = leafletTooltip({
	sticky: false,
	direction: "top",
	opacity: 1,
	className:
		"!bg-(--surface-3) !border-(--border-h) !rounded-(--r-sm) !shadow-[0_8px_24px_rgba(0,0,0,0.5)] !p-0 [&::before]:!hidden",
});

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

			const discSign = pin.discount_percent >= 0 ? "-" : "+";
			const discAbs = Math.abs(Math.round(pin.discount_percent));
			const floorStr = fmtFloor(pin.floor, pin.total_floors);
			const meta = [
				pin.area_sqm ? `${fmt(pin.area_sqm, 0)} m²` : null,
				pin.rooms ? `${pin.rooms}br` : null,
				floorStr ? `fl ${floorStr}` : null,
			]
				.filter(Boolean)
				.join(" · ");
			const thumbHtml = pin.image_url
				? `<img src="${pin.image_url}" style="width:52px;height:52px;object-fit:cover;flex-shrink:0;border-radius:5px">`
				: "";
			const tipContent = `<div style="padding:10px 12px;min-width:180px;max-width:240px">
          <div style="display:flex;align-items:flex-start;gap:8px">
            ${thumbHtml}
            <div style="min-width:0;flex:1">
              <div style="margin-bottom:4px">
                <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.2">₼ ${fmt(pin.price)}</div>
              </div>
              <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px">
                <span>₼${fmt(pin.price_per_sqm, 0)}/m²</span>
                <span style="color:${tStyle.c};font-weight:700">${discSign}${discAbs}%</span>
              </div>
              ${meta ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${meta}</div>` : ""}
            </div>
          </div>
        </div>`;

			cm.on("mouseover", () => {
				cm.setRadius(10);
				if (lmap) {
					sharedTooltip.setContent(tipContent);
					sharedTooltip.setLatLng([pin.lat, pin.lng]);
					sharedTooltip.addTo(lmap);
				}
			});
			cm.on("mouseout", () => {
				cm.setRadius(7);
				sharedTooltip.remove();
			});

			cm.on("click", async () => {
				sharedTooltip.remove();
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
		sharedTooltip.remove();
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
