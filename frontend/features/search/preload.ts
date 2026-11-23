const DEFAULT_DEALS_URL =
	"/api/deals/undervalued?location=__all__&threshold=10&limit=50&offset=0&sort=disc&listingType=sale";
const LOCATIONS_URL = "/api/deals/locations";

type PreloadedTrendEntry = {
	location: string;
	data: import("@/core/types").TrendPoint[] | null;
	promise: Promise<import("@/core/types").TrendPoint[] | null>;
};

let preloadedDeals: { url: string; promise: Promise<Response> } | null = null;
let preloadedLocations: Promise<Response> | null = null;
let preloadedTrend: PreloadedTrendEntry | null = null;

/**
 * Starts initial `/api/deals/locations`, `/api/deals/trend` (if single location in URL),
 * and default `/api/deals/undervalued` fetches in parallel with `/api/auth/me`.
 */
export function preloadInitialSearch(): Promise<void> {
	if (!preloadedLocations) {
		preloadedLocations = fetch(LOCATIONS_URL);
	}

	const params = new URLSearchParams(window.location.search);
	const loc = params.get("location");
	if (loc && loc !== "__all__" && !loc.includes(",") && !preloadedTrend) {
		const entry: PreloadedTrendEntry = {
			location: loc,
			data: null,
			promise: fetch(`/api/deals/trend?location=${encodeURIComponent(loc)}`)
				.then((r) => r.json() as Promise<{ data?: import("@/core/types").TrendPoint[] }>)
				.then((d) => {
					const pts = d.data && d.data.length >= 2 ? d.data : null;
					entry.data = pts;
					return pts;
				})
				.catch(() => null),
		};
		preloadedTrend = entry;
	}

	if (
		!preloadedDeals &&
		!window.location.search &&
		!localStorage.getItem("re-filters") &&
		!localStorage.getItem("re-sort")
	) {
		preloadedDeals = {
			url: DEFAULT_DEALS_URL,
			promise: fetch(DEFAULT_DEALS_URL),
		};
	}

	return preloadedTrend ? preloadedTrend.promise.then(() => undefined) : Promise.resolve();
}

/** Returns preloaded trend data if already resolved for this location. */
export function getPreloadedTrendData(
	location: string,
): import("@/core/types").TrendPoint[] | null | undefined {
	if (!preloadedTrend || preloadedTrend.location !== location) return undefined;
	return preloadedTrend.data;
}

/** Returns and clears the preloaded deals response promise if the URL matches. */
export function consumePreloadedDealsFetch(
	url: string,
): Promise<Response> | null {
	if (!preloadedDeals) return null;
	const match = preloadedDeals.url === url ? preloadedDeals.promise : null;
	preloadedDeals = null;
	return match;
}

/** Returns and clears the preloaded locations response promise. */
export function consumePreloadedLocationsFetch(): Promise<Response> | null {
	const p = preloadedLocations;
	preloadedLocations = null;
	return p;
}
