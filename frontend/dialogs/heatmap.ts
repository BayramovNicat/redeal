import {
	circle,
	DomEvent,
	featureGroup,
	type LeafletMouseEvent,
	type map,
} from "leaflet";
import { t } from "../core/i18n";
import type { HeatmapPoint } from "../core/types";
import { fmt, ge, toast } from "../core/utils";
import { initLeaflet, MapDialog } from "../ui/map-base";

export function renderHeatmapModal(root: HTMLElement): void {
	root.appendChild(
		MapDialog({ id: "heatmap-modal", containerId: "heatmap-ct" }),
	);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
let hmap: ReturnType<typeof map> | null = null;
const hmLayers: ReturnType<typeof circle>[] = [];

function priceColor(val: number, min: number, max: number): string {
	const t = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
	if (t < 0.5) {
		const u = t * 2;
		const r = Math.round(34 + (245 - 34) * u);
		const g = Math.round(197 + (158 - 197) * u);
		const b = Math.round(94 + (11 - 94) * u);
		return `rgb(${r},${g},${b})`;
	}
	const u = (t - 0.5) * 2;
	const r = Math.round(245 + (239 - 245) * u);
	const g = Math.round(158 + (68 - 158) * u);
	const b = Math.round(11 + (68 - 11) * u);
	return `rgb(${r},${g},${b})`;
}

export function renderHeatmap(
	data: HeatmapPoint[],
	activeLocations: string[],
	onAction: (name: string, isToggle: boolean) => void,
): void {
	if (!hmap) return;
	hmap.invalidateSize();
	for (const l of hmLayers) hmap.removeLayer(l);
	hmLayers.length = 0;

	const prices = data.map((d) => d.avg_price_per_sqm);
	const minP = Math.min(...prices);
	const maxP = Math.max(...prices);
	const maxCount = Math.max(...data.map((d) => d.count));

	for (const d of data) {
		const isActive = activeLocations.includes(d.location_name);
		const color = priceColor(d.avg_price_per_sqm, minP, maxP);
		const radius = 200 + (d.count / maxCount) * 400;
		const mycircle = circle([d.lat, d.lng], {
			radius,
			color: isActive ? "white" : color,
			fillColor: color,
			fillOpacity: 0.55,
			weight: isActive ? 4 : 1.5,
			opacity: isActive ? 1 : 0.8,
			dashArray: isActive ? "" : undefined,
		}).addTo(hmap);
		mycircle.bindTooltip(
			/*html*/ `<div class="min-w-32.5 px-3.25 py-2.5">
			<div class="mb-1 text-xs font-semibold text-(--text)">${d.location_name}</div>
			<div class="text-[17px] font-bold leading-none text-(--text)">₼ ${fmt(d.avg_price_per_sqm, 0)}<span class="text-[11px] font-normal text-(--muted)">/m²</span></div>
			<div class="mt-0.75 text-[11px] text-(--muted)">${d.count.toLocaleString()} ${t(d.count !== 1 ? "listings" : "listing")}</div>
		</div>`,
			{
				sticky: true,
				opacity: 1,
				className:
					"!bg-(--surface-3) !border-(--border-h) !rounded-(--r-sm) !shadow-[0_8px_24px_rgba(0,0,0,0.5)] !p-0 [&::before]:!hidden",
			},
		);
		mycircle.on("click", () => {
			(ge("heatmap-modal") as HTMLDialogElement).close();
			onAction(d.location_name, false);
		});
		mycircle.on("contextmenu", (e) => {
			const ev = e as LeafletMouseEvent;
			DomEvent.preventDefault(ev.originalEvent);
			DomEvent.stopPropagation(ev.originalEvent);

			const idx = activeLocations.indexOf(d.location_name);
			if (idx > -1) activeLocations.splice(idx, 1);
			else activeLocations.push(d.location_name);

			const isActive = activeLocations.includes(d.location_name);
			mycircle.setStyle({
				color: isActive ? "white" : color,
				weight: isActive ? 4 : 1.5,
				opacity: isActive ? 1 : 0.8,
			});

			onAction(d.location_name, true);
		});
		hmLayers.push(mycircle);
	}

	const saved = localStorage.getItem("hmap-view");
	if (hmLayers.length && !saved) {
		const group = featureGroup(hmLayers);
		hmap.fitBounds(group.getBounds().pad(0.12));
	}
}

export function openHeatmap(
	activeLocations: string[],
	onAction: (name: string, isToggle: boolean) => void,
): void {
	(ge("heatmap-modal") as HTMLDialogElement).showModal();
	requestAnimationFrame(() => {
		if (!hmap) {
			hmap = initLeaflet("heatmap-ct");

			const saved = JSON.parse(localStorage.getItem("hmap-view") || "null") as {
				center: L.LatLngExpression;
				zoom: number;
			} | null;
			if (saved) {
				hmap.setView(saved.center, saved.zoom);
			} else {
				hmap.setView([40.38, 49.87], 11);
			}

			hmap.on("moveend", () => {
				if (!hmap) return;
				localStorage.setItem(
					"hmap-view",
					JSON.stringify({
						center: hmap.getCenter(),
						zoom: hmap.getZoom(),
					}),
				);
			});
		} else {
			hmap.invalidateSize();
		}

		fetch("/api/heatmap")
			.then((r) => r.json())
			.then((d: { error?: string; data?: HeatmapPoint[] }) => {
				if (d.error) {
					toast(d.error, true);
					return;
				}
				if (d.data) {
					renderHeatmap(d.data, activeLocations, onAction);
				}
			})
			.catch((e: Error) => toast(e.message, true));
	});
}
