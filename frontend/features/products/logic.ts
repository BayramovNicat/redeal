import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { Property } from "@/core/types";
import { fmt, toast } from "@/core/utils";

/**
 * Pure logic for sorting deals.
 */
export function sortDeals(list: Property[], sortBy: string): Property[] {
	const Sorters: Record<string, (a: Property, b: Property) => number> = {
		disc: (a, b) => b.discount_percent - a.discount_percent,
		drops: (a, b) => (b.price_drop_count ?? 0) - (a.price_drop_count ?? 0),
		new: (a, b) =>
			new Date(b.posted_date ?? 0).getTime() -
			new Date(a.posted_date ?? 0).getTime(),
		"price-asc": (a, b) => a.price - b.price,
		"price-desc": (a, b) => b.price - a.price,
		area: (a, b) => b.area_sqm - a.area_sqm,
		ppsm: (a, b) => a.price_per_sqm - b.price_per_sqm,
	};
	const sorter = Sorters[sortBy];
	return sorter ? [...list].sort(sorter) : list;
}

/**
 * Syncs bookmarks and hidden items to localStorage.
 */
export function syncStateToStorage(): void {
	const bmDataObj = Object.fromEntries(state.bookmarkData);
	localStorage.setItem("re-bm-data", JSON.stringify(bmDataObj));
	localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
	localStorage.setItem("re-hidden", JSON.stringify([...state.hidden]));
}

/**
 * Toggles bookmark status for a property.
 */
export function toggleBM(p: Property): void {
	const isBM = state.bookmarks.has(p.source_url);
	if (isBM) {
		state.bookmarks.delete(p.source_url);
		state.bookmarkData.delete(p.source_url);
	} else {
		state.bookmarks.add(p.source_url);
		state.bookmarkData.set(p.source_url, p);
	}
	toast(t(isBM ? "toastRemoved" : "toastSaved"));
	syncStateToStorage();
	bus.emit(EVENTS.DEALS_UPDATED);
}

/**
 * Hides a property from the list.
 */
export function hideItem(url: string): void {
	state.hidden.add(url);
	state.bookmarks.delete(url);
	state.bookmarkData.delete(url);
	syncStateToStorage();
	toast(t("toastHidden"));
	bus.emit(EVENTS.DEALS_UPDATED);
}

/**
 * Permanently deletes a property via API and removes from state.
 */
export async function deleteItem(p: Property): Promise<boolean> {
	if (!window.confirm(t("confirmDelete"))) return false;

	try {
		const { deleteDealApi } = await import("@/features/auth/api");
		await deleteDealApi(p.source_url);

		state.allResults = state.allResults.filter(
			(item) => item.source_url !== p.source_url,
		);
		state.savedOnlyResults = state.savedOnlyResults.filter(
			(item) => item.source_url !== p.source_url,
		);
		state.bookmarks.delete(p.source_url);
		state.bookmarkData.delete(p.source_url);
		state.hidden.delete(p.source_url);
		syncStateToStorage();

		toast(t("toastDeleted"));
		bus.emit(EVENTS.DEALS_UPDATED);
		return true;
	} catch (err) {
		toast((err as Error).message || t("deleteFailed"), true);
		return false;
	}
}

/**
 * Formats a list of properties as plain text for export.
 */
export function formatExportText(list: Property[]): string {
	const lines: string[] = [
		`REDEAL PROPERTY EXPORT — ${list.length} listings`,
		`Exported: ${new Date().toISOString()}`,
		"",
	];

	list.forEach((p, i) => {
		const tags: string[] = [];
		if (p.is_urgent) tags.push("Urgent");
		if (p.has_document) tags.push("Document");
		if (p.has_repair) tags.push("Repaired");
		if (p.has_mortgage) tags.push("Mortgage eligible");
		if (p.has_active_mortgage) tags.push("Active mortgage");
		if (p.price_drop_count && p.price_drop_count > 0)
			tags.push(`Price dropped ${p.price_drop_count}×`);

		const loc = `${p.location_name ?? "Unknown"}${p.district && p.district !== p.location_name ? ` (${p.district})` : ""}`;
		const details = [
			p.rooms !== undefined && `${p.rooms} rooms`,
			p.floor !== undefined &&
				`Floor ${p.floor}${p.total_floors ? `/${p.total_floors}` : ""}`,
		]
			.filter(Boolean)
			.join(" | ");

		lines.push(`--- [${i + 1}] ---`);
		lines.push(`Location: ${loc}`);
		if (p.latitude != null && p.longitude != null) {
			lines.push(`Coordinates: ${p.latitude}, ${p.longitude}`);
		}
		lines.push(
			`Price: ₼${fmt(p.price)} | Area: ${p.area_sqm}m² | ₼/m²: ${fmt(p.price_per_sqm)}`,
		);
		if (details) lines.push(`Details: ${details}`);
		if (tags.length) lines.push(`Tags: ${tags.join(", ")}`);
		if (p.posted_date)
			lines.push(`Posted: ${new Date(p.posted_date).toLocaleDateString()}`);
		if (p.description?.trim())
			lines.push(`Description: ${p.description.trim()}`);
		lines.push(`URL: ${p.source_url}`, "");
	});

	return lines.join("\n");
}

/**
 * Exports currently visible properties to clipboard or file.
 */
export function handleExport(sortBy: string): void {
	const list = sortDeals(
		state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url)),
		sortBy,
	);

	if (!list.length) return;

	const text = formatExportText(list);
	navigator.clipboard
		.writeText(text)
		.then(() => toast(t("exportCopied")))
		.catch(() => {
			const blob = new Blob([text], { type: "text/plain" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `redeal-export-${Date.now()}.txt`;
			a.click();
		});
}
