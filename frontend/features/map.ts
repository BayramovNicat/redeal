import { circle, divIcon, featureGroup, map, marker, tileLayer } from "leaflet";
import type { HeatmapPoint } from "../core/types";
import { fmt, ge, toast } from "../core/utils";

// ── Property map ─────────────────────────────────────────────────────────────
let lmap: ReturnType<typeof map> | null = null;
let lmark: ReturnType<typeof marker> | null = null;

function initMap(): void {
  if (lmap) return;
  lmap = map("map-ct", { zoomControl: true, attributionControl: false });
  tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(lmap);
  const icon = divIcon({
    className: "",
    html: `<div class="w-3 h-3 rounded-full bg-(--green) border-2 border-(--bg) animate-[mpulse_2s_ease-out_infinite]"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  lmark = marker([0, 0], { icon }).addTo(lmap);
}

export function openMap(lat: number, lng: number): void {
  (ge("map-modal") as HTMLDialogElement).showModal();
  requestAnimationFrame(() => {
    initMap();
    if (lmap && lmark) {
      lmap.invalidateSize();
      lmark.setLatLng([lat, lng]);
      lmap.setView([lat, lng], 15, { animate: false });
    }
  });
}

export function openDesc(text: string): void {
  ge("desc-body").textContent = text;
  (ge("desc-modal") as HTMLDialogElement).showModal();
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
  onLocClick: (name: string) => void,
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
    const color = priceColor(d.avg_price_per_sqm, minP, maxP);
    const radius = 200 + (d.count / maxCount) * 400;
    const mycircle = circle([d.lat, d.lng], {
      radius,
      color,
      fillColor: color,
      fillOpacity: 0.55,
      weight: 1.5,
      opacity: 0.8,
    }).addTo(hmap);
    mycircle.bindTooltip(
      /*html*/ `<div class="min-w-32.5 px-3.25 py-2.5">
			<div class="mb-1 text-xs font-semibold text-(--text)">${d.location_name}</div>
			<div class="text-[17px] font-bold leading-none text-(--text)">₼ ${fmt(d.avg_price_per_sqm, 0)}<span class="text-[11px] font-normal text-(--muted)">/m²</span></div>
			<div class="mt-0.75 text-[11px] text-(--muted)">${d.count.toLocaleString()} listings</div>
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
      onLocClick(d.location_name);
    });
    hmLayers.push(mycircle);
  }

  const saved = localStorage.getItem("hmap-view");
  if (hmLayers.length && !saved) {
    const group = featureGroup(hmLayers);
    hmap.fitBounds(group.getBounds().pad(0.12));
  }
}

export function openHeatmap(onLocClick: (name: string) => void): void {
  (ge("heatmap-modal") as HTMLDialogElement).showModal();
  requestAnimationFrame(() => {
    if (!hmap) {
      hmap = map("heatmap-ct", {
        zoomControl: true,
        attributionControl: false,
      });
      tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(hmap);

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
          renderHeatmap(d.data, onLocClick);
        }
      })
      .catch((e: Error) => toast(e.message, true));
  });
}
