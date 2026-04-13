import { divIcon, type map, marker } from "leaflet";
import { ge } from "../core/utils";
import { initLeaflet, MapDialog } from "../ui/map-base";

export function renderMapModal(root: HTMLElement): void {
	root.appendChild(MapDialog({ id: "map-modal", containerId: "map-ct" }));
}

// ── Property map ─────────────────────────────────────────────────────────────
let lmap: ReturnType<typeof map> | null = null;
let lmark: ReturnType<typeof marker> | null = null;

function initMap(): void {
	if (lmap) return;
	lmap = initLeaflet("map-ct");
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
