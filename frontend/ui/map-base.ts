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

	// Google Maps standard roadmap raster tiles (no API key required)
	LtileLayer(
		"https://mt{s}.google.com/vt/lyrs=m&hl=az&gl=AZ&x={x}&y={y}&z={z}",
		{
			subdomains: ["0", "1", "2", "3"],
			maxZoom: 22,
			attribution: "&copy; Google Maps",
		},
	).addTo(lmap);

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

/**
 * MapLibre GL style specification using Google standard roadmap raster tiles.
 */
export const googleRoadmapStyle = {
	version: 8 as const,
	sources: {
		"google-roadmap": {
			type: "raster" as const,
			tiles: [
				"https://mt0.google.com/vt/lyrs=m&hl=az&gl=AZ&x={x}&y={y}&z={z}",
				"https://mt1.google.com/vt/lyrs=m&hl=az&gl=AZ&x={x}&y={y}&z={z}",
				"https://mt2.google.com/vt/lyrs=m&hl=az&gl=AZ&x={x}&y={y}&z={z}",
				"https://mt3.google.com/vt/lyrs=m&hl=az&gl=AZ&x={x}&y={y}&z={z}",
			],
			tileSize: 256,
			attribution: "&copy; Google Maps",
		},
	},
	layers: [
		{
			id: "google-roadmap-layer",
			type: "raster" as const,
			source: "google-roadmap",
			minzoom: 0,
			maxzoom: 22,
		},
	],
};

