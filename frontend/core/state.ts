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
	loading: false,
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
	hasSearched: false,
	isPreviewLimited: false,
	previewLimit: 50,
	refs: {
		cards: null as HTMLElement | null,
		loading: null as HTMLElement | null,
		empty: null as HTMLElement | null,
		welcome: null as HTMLElement | null,
		resultsBar: null as HTMLElement | null,
		loadMore: null as HTMLElement | null,
		savedBtn: null as HTMLElement | null,
		trendPanel: null as HTMLElement | null,
		resultsMeta: null as HTMLElement | null,
		sortSelect: null as HTMLSelectElement | null,
	},
	/** Shared bridge to retrieve current search filters across features. */
	getFilters: () => ({}) as import("./types").AlertFilters,
};
