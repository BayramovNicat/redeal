import { state } from "@/core/state";
import { getBooleanFilters, getNumericFilters } from "./constants";
import { syncDiscountThresholdUI } from "./filters";
import type { SearchUI } from "./types";

const FILTER_STORAGE_KEY = "re-filters";

type PersistedFilters = {
	location?: string[];
	threshold?: string;
	numeric?: Record<string, string>;
	boolean?: Record<string, boolean>;
	category?: string;
	listingType?: string;
	hasActiveMortgage?: string;
	descriptionSearch?: string;
};

function setThreshold(ui: SearchUI, threshold: string): void {
	ui.discountRange.value = threshold;
	syncDiscountThresholdUI(ui);
}

function getUrlLocations(value: string): string[] {
	return value.split(",").filter((loc) => loc && /^[a-z0-9\-/_]*$/.test(loc));
}

function hasFilterParams(params: URLSearchParams): boolean {
	if (
		params.has("location") ||
		params.has("threshold") ||
		params.has("category") ||
		params.has("listingType") ||
		params.has("hasActiveMortgage") ||
		params.has("descriptionSearch")
	) {
		return true;
	}

	return [...getNumericFilters(), ...getBooleanFilters()].some((config) =>
		params.has(config.id),
	);
}

export function hasNonDefaultUrlFilters(params: URLSearchParams): boolean {
	const listingType = params.get("listingType");
	if (listingType && listingType !== "sale") return true;

	const sort = params.get("sort");
	if (sort && sort !== "disc") return true;

	if (
		params.get("category") ||
		params.get("hasActiveMortgage") ||
		params.get("descriptionSearch")
	) {
		return true;
	}

	return [...getNumericFilters(), ...getBooleanFilters()].some((config) => {
		const val = params.get(config.id);
		return val !== null && val !== "";
	});
}

export function resetGatedFiltersToDefault(ui: SearchUI): void {
	for (const config of getNumericFilters()) {
		ui.numericInputs[config.id].value = "";
	}
	for (const config of getBooleanFilters()) {
		ui.booleanInputs[config.id].checked = false;
	}
	ui.categorySelect.value = "";
	ui.listingTypeSelect.value = "sale";
	ui.mortgageSelect.value = "";
	ui.descriptionInput.value = "";
}

export function restorePublicFiltersFromUrl(ui: SearchUI): void {
	const urlParams = new URLSearchParams(window.location.search);

	const threshold = urlParams.get("threshold");
	if (threshold !== null && /^\d+$/.test(threshold)) {
		const n = Math.min(50, Math.max(0, Number(threshold)));
		setThreshold(ui, String(n));
	} else {
		setThreshold(ui, "10");
	}

	const location = urlParams.get("location");
	if (location) {
		const sanitized = getUrlLocations(location);
		if (sanitized.length > 0) {
			ui.locationSelect.setValue(sanitized);
			return;
		}
	}
	ui.locationSelect.setValue(["__all__"]);
}

export function syncPublicFiltersToUrl(
	locations: string[],
	threshold: number,
): void {
	const params = new URLSearchParams();
	const isAll =
		locations.length === 0 ||
		(locations.length === 1 && locations[0] === "__all__");
	if (!isAll) {
		params.set("location", locations.join(","));
	}
	if (threshold !== 10) {
		params.set("threshold", String(threshold));
	}
	const search = params.toString();
	const url = search
		? `${window.location.pathname}?${search}`
		: window.location.pathname;
	window.history.replaceState(null, "", url);
}

export function resetFiltersToDefault(ui: SearchUI): void {
	ui.locationSelect.setValue(["__all__"]);
	setThreshold(ui, "10");
	resetGatedFiltersToDefault(ui);
}

function loadFiltersFromStorage(): PersistedFilters | null {
	try {
		const raw = localStorage.getItem(FILTER_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PersistedFilters;
	} catch {
		return null;
	}
}

function restoreFromStorage(ui: SearchUI): void {
	const saved = loadFiltersFromStorage();
	if (!saved) {
		ui.locationSelect.setValue(["__all__"]);
		return;
	}

	ui.locationSelect.setValue(
		saved.location && saved.location.length > 0 ? saved.location : ["__all__"],
	);
	if (saved.threshold !== undefined) setThreshold(ui, saved.threshold);

	for (const config of getNumericFilters()) {
		ui.numericInputs[config.id].value = saved.numeric?.[config.id] ?? "";
	}

	for (const config of getBooleanFilters()) {
		ui.booleanInputs[config.id].checked = saved.boolean?.[config.id] ?? false;
	}

	ui.categorySelect.value = saved.category ?? "";
	ui.listingTypeSelect.value = saved.listingType ?? "sale";
	ui.mortgageSelect.value = saved.hasActiveMortgage ?? "";
	ui.descriptionInput.value = saved.descriptionSearch ?? "";
}

export function saveFiltersToStorage(ui: SearchUI): void {
	try {
		const numeric: Record<string, string> = {};
		for (const config of getNumericFilters()) {
			const value = ui.numericInputs[config.id].value.trim();
			if (value) numeric[config.id] = value;
		}

		const boolean: Record<string, boolean> = {};
		for (const config of getBooleanFilters()) {
			if (ui.booleanInputs[config.id].checked) boolean[config.id] = true;
		}

		const saved: PersistedFilters = {
			location: ui.locationSelect.getValue(),
			threshold: ui.discountRange.value,
			numeric,
			boolean,
			category: ui.categorySelect.value,
			listingType: ui.listingTypeSelect.value,
			hasActiveMortgage: ui.mortgageSelect.value,
			descriptionSearch: ui.descriptionInput.value.trim(),
		};

		localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(saved));
	} catch {
		// Ignore storage failures; URL state still keeps the current search shareable.
	}
}

/**
 * Persists the current filter state to the URL.
 */
export function syncStateToUrl(params: URLSearchParams): void {
	const persistParams = new URLSearchParams(params);
	persistParams.delete("limit");
	persistParams.delete("offset");

	const search = persistParams.toString();
	const url = search
		? `${window.location.pathname}?${search}`
		: window.location.pathname;

	window.history.replaceState(null, "", url);
}

/**
 * Restores the UI state from URL parameters.
 */
export function restoreStateFromUrl(ui: SearchUI): void {
	const urlParams = new URLSearchParams(window.location.search);
	if (!hasFilterParams(urlParams)) {
		restoreFromStorage(ui);
		return;
	}

	const threshold = urlParams.get("threshold");
	if (threshold !== null) {
		setThreshold(ui, threshold);
	}

	for (const config of getNumericFilters()) {
		const val = urlParams.get(config.id);
		if (val && val !== "undefined" && val !== "null") {
			ui.numericInputs[config.id].value = val;
		}
	}

	for (const config of getBooleanFilters()) {
		if (urlParams.get(config.id) === "true") {
			ui.booleanInputs[config.id].checked = true;
		}
	}

	const category = urlParams.get("category");
	if (category) ui.categorySelect.value = category;

	const listingType = urlParams.get("listingType");
	if (listingType) ui.listingTypeSelect.value = listingType;

	const mortgage = urlParams.get("hasActiveMortgage");
	if (mortgage) ui.mortgageSelect.value = mortgage;

	const desc = urlParams.get("descriptionSearch");
	if (desc && desc !== "undefined" && desc !== "null") {
		ui.descriptionInput.value = desc;
	}

	const sort = urlParams.get("sort");
	if (
		sort &&
		state.refs.sortSelect &&
		Array.from(state.refs.sortSelect.options).some((o) => o.value === sort)
	) {
		state.refs.sortSelect.value = sort;
		try {
			localStorage.setItem("re-sort", sort);
		} catch {}
	}

	const location = urlParams.get("location");
	if (location) {
		const sanitized = getUrlLocations(location);
		if (sanitized.length > 0) {
			ui.locationSelect.setValue(sanitized);
		} else {
			ui.locationSelect.setValue(["__all__"]);
		}
	} else {
		ui.locationSelect.setValue(["__all__"]);
	}
}
