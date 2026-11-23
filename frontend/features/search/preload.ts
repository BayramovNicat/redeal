const DEFAULT_DEALS_URL =
	"/api/deals/undervalued?location=__all__&threshold=10&limit=50&offset=0&sort=disc&listingType=sale";
const LOCATIONS_URL = "/api/deals/locations";

let preloadedDeals: { url: string; promise: Promise<Response> } | null = null;
let preloadedLocations: Promise<Response> | null = null;

/**
 * Starts initial `/api/deals/locations` and default `/api/deals/undervalued`
 * fetches in parallel with `/api/auth/me` before the app mounts.
 */
export function preloadInitialSearch(): void {
	if (!preloadedLocations) {
		preloadedLocations = fetch(LOCATIONS_URL);
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
