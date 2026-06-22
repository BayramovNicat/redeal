import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { Property } from "@/core/types";
import { fmt, fmtFloor, getLocale, timeAgo, tTier } from "@/core/utils";
import { Tag } from "@/ui/chip";
import { Icons } from "@/ui/icons";
import { initLeaflet } from "@/ui/map-base";
import { StatBox } from "@/ui/stat-box";
import { ts } from "@/ui/tier";
import { PriceHistoryChart } from "./chart";
import type { PropertyDetailUI } from "./types";

/**
 * Updates the UI with data from a specific property.
 */
export function bindPropertyData(ui: PropertyDetailUI, p: Property): void {
	ui.currentProperty = p;
	const tier = ts(p.tier);
	const bookmarked = state.bookmarks.has(p.source_url);

	ui.bmarkBtn.classList.toggle("on", bookmarked);
	ui.bmarkBtn.replaceChildren(Icons.bookmark({ size: 18, fill: bookmarked }));
	ui.gallery.setUrls(p.image_urls ?? []);
	ui.locationEl.textContent = p.location_name ?? p.district ?? "—";
	ui.priceEl.textContent = `₼ ${fmt(p.price)}`;
	ui.tierEl.textContent = tTier(p.tier);
	ui.tierEl.style.cssText = `color:${tier.c};background:${tier.bg};border-color:${tier.b}`;
	ui.tierEl.title =
		p.discount_percent >= 0
			? t("tierTipBelow", {
					n: String(Math.abs(Math.round(p.discount_percent))),
				})
			: t("tierTipAbove", {
					n: String(Math.abs(Math.round(p.discount_percent))),
				});

	const ago = p.posted_date ? timeAgo(p.posted_date) : "";
	ui.postedEl.textContent = ago ? `${t("propPosted")} ${ago}` : "";

	ui.statsEl.replaceChildren();
	const statData = [
		{ label: t("area"), value: fmt(p.area_sqm, 1) },
		{ label: t("ppsm"), value: `₼${fmt(p.price_per_sqm, 0)}` },
		{ label: t("rooms"), value: p.rooms ?? "—" },
		{ label: t("floor"), value: fmtFloor(p.floor, p.total_floors) },
	];
	statData.forEach((s) => {
		ui.statsEl.appendChild(StatBox(s));
	});

	ui.mktAvgEl.textContent = `₼${fmt(p.location_avg_price_per_sqm, 0)}/m²`;
	ui.discPctEl.textContent = `${p.discount_percent >= 0 ? "-" : "+"}${Math.abs(p.discount_percent)}%`;
	ui.discPctEl.style.color = tier.c;

	ui.tagsEl.replaceChildren();
	const features = [
		{
			if: p.is_urgent,
			icon: "⚡",
			label: t("tagUrgent"),
			cls: "text-(--red) border-(--red-b) bg-(--red-dim)",
		},
		{
			if: p.has_document,
			label: t("tagDocument"),
			cls: "text-(--blue) border-(--blue-b) bg-(--blue-dim)",
		},
		{
			if: p.has_repair,
			label: t("tagRepaired"),
			cls: "text-(--green) border-(--green-b) bg-(--green-dim)",
		},
		{
			if: p.has_mortgage,
			label: t("tagMortgage"),
			cls: "text-(--muted) border-(--border)",
		},
		{
			if: p.has_active_mortgage,
			icon: "⚠",
			label: t("tagActiveMortgage"),
			cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
		},
	];
	features
		.filter((f) => f.if)
		.forEach((f) => {
			ui.tagsEl.appendChild(
				Tag({ label: f.label, icon: f.icon, className: f.cls }),
			);
		});

	if (p.latitude && p.longitude) {
		ui.mapSecEl.classList.remove("hidden");
		requestAnimationFrame(() => updateMap(ui, p));
	} else {
		ui.mapSecEl.classList.add("hidden");
	}

	if (p.price_history && p.price_history.length >= 2) {
		ui.historySecEl.classList.remove("hidden");
		ui.historyChartEl.replaceChildren(
			PriceHistoryChart(p.price_history, tier.hex, getLocale()),
		);
	} else {
		ui.historySecEl.classList.add("hidden");
	}

	if (p.description) {
		ui.descSecEl.classList.remove("hidden");
		ui.descBodyEl.textContent = p.description;
	} else {
		ui.descSecEl.classList.add("hidden");
	}

	ui.linkEl.href = p.source_url;
}

/**
 * Initializes the Leaflet map and marker.
 */
export async function initMap(ui: PropertyDetailUI): Promise<void> {
	if (ui.lmap) return;

	// Map requires its container to be in the DOM and visible to size correctly.
	// We temporarily unhide it, let Leaflet init, then restore visibility.
	const wasHidden = ui.mapSecEl.classList.contains("hidden");
	ui.mapSecEl.classList.remove("hidden");
	ui.mapSecEl.style.visibility = "hidden";

	ui.lmap = await initLeaflet(ui.mapCtEl);
	const { divIcon, marker } = await import("leaflet");
	const mapIcon = divIcon({
		className: "",
		html: /*html*/ `<div class="w-3 h-3 rounded-full bg-(--green) border-2 border-(--bg) animate-[mpulse_2s_ease-out_infinite] cursor-pointer"></div>`,
		iconSize: [12, 12],
		iconAnchor: [6, 6],
	});
	if (ui.lmap) {
		ui.lmark = marker([0, 0], { icon: mapIcon }).addTo(ui.lmap);
		ui.lmark.on("click", () => {
			if (ui.currentProperty?.latitude && ui.currentProperty?.longitude) {
				const url = `https://www.google.com/maps/search/?api=1&query=${ui.currentProperty.latitude},${ui.currentProperty.longitude}`;
				window.open(url, "_blank");
			}
		});
	}

	ui.mapSecEl.style.visibility = "";
	if (wasHidden) ui.mapSecEl.classList.add("hidden");

	// If we already have a property, update map immediately
	if (ui.currentProperty) updateMap(ui, ui.currentProperty);
}

/**
 * Updates the map view and marker position.
 */
function updateMap(ui: PropertyDetailUI, p: Property): void {
	if (p.latitude && p.longitude && ui.lmap && ui.lmark) {
		const { latitude: lat, longitude: lng } = p;
		ui.mapSecEl.classList.remove("hidden");
		ui.lmap.invalidateSize();
		ui.lmark.setLatLng([lat, lng]);
		ui.lmap.setView([lat, lng], 15, { animate: false });
	} else if (!p.latitude || !p.longitude) {
		ui.mapSecEl.classList.add("hidden");
	}
}
