import { map, tileLayer } from "leaflet";
import { html } from "../core/utils";
import { Dialog } from "./dialog";

export const MAP_MODAL_MAXWIDTH = "860px";

/**
 * Initializes a Leaflet map with standard dark-mode settings.
 */
export function initLeaflet(containerId: string): ReturnType<typeof map> {
	const lmap = map(containerId, {
		zoomControl: true,
		attributionControl: false,
	});

	tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
		subdomains: "abcd",
		maxZoom: 19,
	}).addTo(lmap);

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
		content: html`<div id="${containerId}" class="w-full h-120 relative"></div>`,
	});
}
