import type { map } from "leaflet";
import { html } from "@/core/utils";
import { Dialog } from "./dialog";

export const MAP_MODAL_MAXWIDTH = "860px";

/**
 * Ensures the Leaflet CSS is loaded in the document.
 */
function ensureLeafletStyles(): Promise<void> {
	if (document.getElementById("leaflet-css")) return Promise.resolve();
	return new Promise((resolve) => {
		const link = document.createElement("link");
		link.id = "leaflet-css";
		link.rel = "stylesheet";
		link.href = "/leaflet.css";
		link.onload = () => resolve();
		link.onerror = () => resolve(); // Proceed even on error to avoid hanging

		// Insert before the first stylesheet to ensure our custom styles in styles.css can override Leaflet's defaults
		const firstStylesheet = document.head.querySelector(
			'link[rel="stylesheet"]',
		);
		if (firstStylesheet) {
			document.head.insertBefore(link, firstStylesheet);
		} else {
			document.head.prepend(link);
		}
	});
}

/**
 * Initializes a Leaflet map with standard dark-mode settings.
 */
export async function initLeaflet(
	target: string | HTMLElement,
): Promise<ReturnType<typeof map>> {
	await ensureLeafletStyles();
	const { map: Lmap, tileLayer: LtileLayer } = await import("leaflet");
	const lmap = Lmap(target, {
		zoomControl: true,
		attributionControl: false,
	});

	const cartoKey =
		typeof window !== "undefined"
			? (window as unknown as { CARTO_API_KEY?: string }).CARTO_API_KEY ||
				localStorage.getItem("carto_api_key")
			: null;

	if (cartoKey) {
		LtileLayer(
			`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`,
			{
				subdomains: "abcd",
				maxZoom: 19,
			},
		).addTo(lmap);
	} else {
		// Esri World Dark Gray Canvas basemap (Base + Reference labels) - no API key required
		LtileLayer(
			"https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
			{
				maxNativeZoom: 16,
				maxZoom: 19,
				attribution: "Tiles &copy; Esri",
			},
		).addTo(lmap);

		LtileLayer(
			"https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
			{
				maxNativeZoom: 16,
				maxZoom: 19,
			},
		).addTo(lmap);
	}

	return lmap;
}

/**
 * Creates a Dialog containing a standard map container.
 */
export function MapDialog({
	id,
	containerId,
	className = "",
}: {
	id: string;
	containerId: string;
	className?: string;
}): HTMLDialogElement {
	return Dialog({
		id,
		maxWidth: MAP_MODAL_MAXWIDTH,
		className: `max-h-[calc(100vh-2rem)] ${className}`,
		showClose: true,
		content: html`<div id="${containerId}" class="w-full h-120 relative"></div>`,
	});
}
