import type { Property } from "./types";

function loadBookmarkData(): Map<string, Property> {
	try {
		const raw = localStorage.getItem("re-bm-data");
		if (!raw) return new Map();
		const obj = JSON.parse(raw) as Record<string, Property>;
		return new Map(Object.entries(obj));
	} catch {
		return new Map();
	}
}

export const state = {
	allResults: [] as Property[],
	savedOnlyResults: [] as Property[],
	currentTotal: 0,
	currentOffset: 0,
	currentView: "grid",
	showingSaved: false,
	scrollObserver: null as IntersectionObserver | null,
	renderedSet: new Set<string>(),
	bookmarks: new Set<string>(
		JSON.parse(localStorage.getItem("re-bm") || "[]") as string[],
	),
	bookmarkData: loadBookmarkData(),
	hidden: new Set<string>(
		JSON.parse(localStorage.getItem("re-hidden") || "[]") as string[],
	),
	PAGE: 50,
};
