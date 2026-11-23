import type { Circle, FeatureGroup, Map as LMap } from "leaflet";
import { bus, EVENTS } from "@/core/events";
import type { HeatmapPoint } from "@/core/types";
import { initLeaflet, MapDialog } from "@/ui/map-base";
import { fetchHeatmapData } from "./api";
import { setupCircleEvents, setupMapDragSelection } from "./events";
import { getPriceColor } from "./logic";

const MIN_CIRCLE_RADIUS = 140;
const MAX_CIRCLE_RADIUS = 500;
const CIRCLE_RADIUS_SCALE = 11;

function getCircleRadius(count: number): number {
	return Math.min(
		MAX_CIRCLE_RADIUS,
		MIN_CIRCLE_RADIUS + Math.sqrt(count) * CIRCLE_RADIUS_SCALE,
	);
}

export function initHeatmap(root: HTMLElement): () => void {
	let isFirstOpen = true;
	let lmap: LMap | null = null;
	let overlay: FeatureGroup | null = null;
	let currentOnAction: ((name: string, isToggle: boolean) => void) | null =
		null;
	let cleanupDragSelection: (() => void) | null = null;
	let cachedData: HeatmapPoint[] = [];
	let latestActiveLocations: string[] = [];

	const containerId = "heatmap-map-container";
	const modal = MapDialog({
		id: "heatmap-modal",
		containerId,
	});

	root.appendChild(modal);

	const updateCircleStyles = () => {
		if (!overlay) return;
		overlay.eachLayer((layer) => {
			if ("setStyle" in layer) {
				const circle = layer as Circle & { _heatmapData?: HeatmapPoint };
				const d = circle._heatmapData;
				if (!d) return;
				const isActive = latestActiveLocations.includes(d.location_name);
				circle.setStyle({
					color: isActive ? "white" : "transparent",
					weight: isActive ? 2 : 1,
					opacity: isActive ? 1 : 0.3,
					fillOpacity: 0.65,
				});
			}
		});
	};

	const onOpen = async (
		activeLocations: string[],
		onAction: (name: string, isToggle: boolean) => void,
		onSelectMany?: (names: string[]) => void,
	) => {
		latestActiveLocations = activeLocations;
		currentOnAction = onAction;
		modal.showModal();

		if (!lmap) {
			const { featureGroup } = await import("leaflet");
			overlay = featureGroup();
			const ct = modal.querySelector(`#${containerId}`) as HTMLElement;
			lmap = await initLeaflet(ct);
			overlay.addTo(lmap);
		}

		if (isFirstOpen) {
			cachedData = await fetchHeatmapData();
			if (cachedData.length > 0 && lmap && overlay) {
				isFirstOpen = false;
				cleanupDragSelection = await renderPoints(
					lmap,
					cachedData,
					overlay,
					() => latestActiveLocations,
					(name, isToggle) => {
						if (currentOnAction) currentOnAction(name, isToggle);
						if (!isToggle) modal.close();
						else {
							const idx = latestActiveLocations.indexOf(name);
							if (idx > -1) latestActiveLocations.splice(idx, 1);
							else latestActiveLocations.push(name);
							updateCircleStyles();
						}
					},
					(names) => {
						onSelectMany?.(names);
						latestActiveLocations = names;
						updateCircleStyles();
					},
				);
			}
		} else {
			updateCircleStyles();
		}

		lmap.invalidateSize();
	};

	const offOpen = bus.on(EVENTS.HEATMAP_OPEN, (payload) => {
		void onOpen(
			payload.activeLocations,
			payload.onAction,
			payload.onSelectMany,
		);
	});

	return () => {
		offOpen();
		modal.remove();
		if (cleanupDragSelection) cleanupDragSelection();
		if (overlay) overlay.remove();
		if (lmap) lmap.remove();
	};
}

/**
 * Global helper to open the heatmap modal.
 */
export function openHeatmap(
	activeLocations: string[],
	onAction: (name: string, isToggle: boolean) => void,
): void {
	bus.emit(EVENTS.HEATMAP_OPEN, { activeLocations, onAction });
}

async function renderPoints(
	lmap: LMap,
	data: HeatmapPoint[],
	group: FeatureGroup,
	getActiveLocations: () => string[],
	onSelect: (name: string, isToggle: boolean) => void,
	onSelectMany: (names: string[]) => void,
): Promise<() => void> {
	const { circle } = await import("leaflet");
	const ppsms = data.map((d) => d.avg_price_per_sqm);
	const min = Math.min(...ppsms);
	const max = Math.max(...ppsms);

	for (const d of data) {
		const isActive = getActiveLocations().includes(d.location_name);
		const color = getPriceColor(d.avg_price_per_sqm, min, max);
		const c = circle([d.lat, d.lng], {
			radius: getCircleRadius(d.count),
			fillColor: color,
			fillOpacity: 0.65,
			stroke: true,
			color: isActive ? "white" : "transparent",
			weight: isActive ? 2 : 1,
			opacity: isActive ? 1 : 0.3,
		}) as Circle & { _heatmapData?: HeatmapPoint };

		c._heatmapData = d;

		setupCircleEvents(c, d, getActiveLocations, onSelect);

		c.addTo(group);
	}

	const cleanupDragSelection = await setupMapDragSelection(
		lmap,
		group,
		getActiveLocations,
		onSelectMany,
	);

	if (data.length > 0) {
		lmap.setView([40.396698, 49.8664491], 12);
	}

	return cleanupDragSelection;
}
