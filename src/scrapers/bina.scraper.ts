/**
 * Real bina.az scraper.
 *
 * bina.az is a Next.js SPA backed by a GraphQL API at /graphql.
 * The API is NOT protected by Cloudflare — plain HTTPS fetch with browser-like
 * headers is sufficient. No Playwright or stealth plugin required.
 *
 * Data flow:
 *  1. Paginate itemsConnection (cursor-based) to get bulk listing fields.
 *  2. Batch aliased item(id: ...) queries per page to fetch title + description
 *     (urgency detection lives in those text fields).
 *  3. Derive district from location.slug using slugToDistrict().
 */

import { slugToDistrict } from "@/utils/district-normalizer.js";
import { normalizePropertyCategory } from "@/utils/property-category.js";
import {
	BaseScraper,
	type ScrapedListing,
	type ScraperOptions,
} from "./base.scraper.js";

const GRAPHQL_URL = "https://bina.az/graphql";
const ITEM_BASE_URL = "https://bina.az/items";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/** Filter params for "properties for sale in Baku". */
const CITY_ID_BAKU = "1";
const BINA_PROPERTY_TYPES = [
	{
		categoryId: "1",
		label: "apartments",
		referer: "https://bina.az/baki/alqi-satqi/menziller",
		leased: false,
		listingType: "sale",
	},
	{
		categoryId: "5",
		label: "houses/villas",
		referer: "https://bina.az/baki/alqi-satqi/heyet-evleri",
		leased: false,
		listingType: "sale",
	},
	{
		categoryId: "1",
		label: "rental apartments",
		referer: "https://bina.az/kiraye",
		leased: true,
		listingType: "rent",
	},
	{
		categoryId: "5",
		label: "rental houses/villas",
		referer: "https://bina.az/kiraye",
		leased: true,
		listingType: "rent",
	},
] as const;

type BinaPropertyType = (typeof BINA_PROPERTY_TYPES)[number];

const USER_AGENTS: [string, ...string[]] = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const ACCEPT_LANGUAGES: [string, ...string[]] = [
	"az-AZ,az;q=0.9,en;q=0.8",
	"az-AZ,az;q=0.9,en-US;q=0.8,en;q=0.7",
	"az,en-US;q=0.9,en;q=0.8",
];

function pick<T>(arr: [T, ...T[]]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomHeaders(
	referer = "https://bina.az/baki/alqi-satqi/menziller",
): Record<string, string> {
	const ua = pick(USER_AGENTS);
	const lang = pick(ACCEPT_LANGUAGES);
	return {
		"Content-Type": "application/json",
		"User-Agent": ua,
		Accept: "application/json, text/plain, */*",
		Origin: "https://bina.az",
		Referer: referer,
		"Accept-Language": lang,
		"Accept-Encoding": "gzip, deflate, br",
		"sec-ch-ua": `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": ua.includes("Windows")
			? '"Windows"'
			: ua.includes("Linux")
				? '"Linux"'
				: '"macOS"',
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "same-origin",
	};
}

function shouldRetry(status: number): boolean {
	return status === 429 || status >= 500;
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

// ── GraphQL response shapes ───────────────────────────────────────────────────

interface GQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string; path?: string[] }>;
}

interface ESItemNode {
	id: string;
	rooms: number | null;
	floor: number | null;
	floors: number | null;
	hasMortgage: boolean | null;
	hasRepair: boolean | null;
	hasBillOfSale: boolean | null;
	price: { total: number; currency: string };
	area: { value: number };
	location: {
		name: string;
		slug: string;
		id: string;
		latitude: number | null;
		longitude: number | null;
	};
}

interface PageInfo {
	hasNextPage: boolean;
	endCursor: string;
}

interface ItemsConnectionData {
	itemsConnection: {
		pageInfo: PageInfo;
		edges: Array<{ node: ESItemNode }>;
	};
}

interface ItemDetail {
	title: string;
	description: string;
	updatedAt: string;
	category: { name: string } | null;
	latitude: number | null;
	longitude: number | null;
	photos: Array<{ full: string }> | null;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export class BinaScraper extends BaseScraper {
	readonly platform = "bina.az";

	async scrape(options: ScraperOptions = {}): Promise<ScrapedListing[]> {
		const {
			maxPages: defaultMax = 20,
			startPage = 1,
			endPage,
			delayMs = 800,
			listingType,
			categoryId,
		} = options;
		const finalMaxPages = endPage ?? defaultMax;
		const all: ScrapedListing[] = [];

		const activePropertyTypes = BINA_PROPERTY_TYPES.filter((type) => {
			if (listingType && type.listingType !== listingType) {
				return false;
			}
			if (categoryId && type.categoryId !== categoryId) {
				return false;
			}
			return true;
		});

		const totalPlannedPages =
			(finalMaxPages - startPage + 1) * activePropertyTypes.length;
		let totalFetchedPages = 0;

		console.log(
			`[${this.platform}] Starting GraphQL scrape (${activePropertyTypes.map((type) => type.label).join(", ")}; startPage=${startPage}, limit=${finalMaxPages})...`,
		);
		options.onProgress?.({
			type: "start",
			platform: this.platform,
			maxPages: totalPlannedPages,
			startPage,
			endPage,
		});

		for (const propertyType of activePropertyTypes) {
			let cursor: string | null = null;
			let page = 0;
			let hasNext = true;

			console.log(
				`[${this.platform}] Scraping ${propertyType.label} (categoryId=${propertyType.categoryId})...`,
			);

			// Advance the cursor cheaply to startPage without fetching edge data.
			while (page < startPage - 1 && hasNext) {
				page++;
				console.log(
					`[${this.platform}] Advancing ${propertyType.label} cursor to startPage (${page}/${startPage - 1})...`,
				);
				const pageInfo = await this.fetchCursor(cursor, propertyType);
				hasNext = pageInfo.hasNextPage;
				cursor = pageInfo.endCursor;
				await this.delay(150);
			}

			while (hasNext && page < finalMaxPages) {
				page++;
				totalFetchedPages++;

				const { edges, pageInfo } = await this.fetchPage(cursor, propertyType);

				if (edges.length === 0) break;

				// Fetch full item details in one batched GraphQL request
				const ids = edges.map((e) => e.node.id);
				const details = await this.batchFetchDetails(ids, propertyType.referer);

				for (const { node } of edges) {
					const price = node.price.total;
					const area = node.area.value;
					if (price <= 0 || area <= 0) continue;

					const detail = details[node.id];
					const urgencyText = `${detail?.title ?? ""} ${detail?.description ?? ""}`;
					const mortgageText = detail?.description ?? "";

					const normalizedDistrict = slugToDistrict(node.location.slug);
					// Fall back to the exact location name from the API when district can't be resolved
					const district =
						normalizedDistrict === "Unknown"
							? node.location.name
							: normalizedDistrict;

					all.push({
						source_url: `${ITEM_BASE_URL}/${node.id}`,
						price,
						area_sqm: area,
						district,
						location_name: node.location.slug,
						latitude: detail?.latitude ?? node.location.latitude ?? undefined,
						longitude:
							detail?.longitude ?? node.location.longitude ?? undefined,
						rooms: node.rooms ?? undefined,
						floor: node.floor ?? undefined,
						total_floors: node.floors ?? undefined,
						category: normalizePropertyCategory(detail?.category?.name),
						listing_type: propertyType.listingType,
						has_document: node.hasBillOfSale ?? undefined,
						has_mortgage: node.hasMortgage ?? undefined,
						has_repair: node.hasRepair ?? undefined,
						description: detail?.description,
						image_urls: detail?.photos?.map((p) => p.full) ?? [],
						is_urgent: this.isUrgent(urgencyText),
						has_active_mortgage: this.isActiveMortgage(mortgageText),
						posted_date: detail?.updatedAt
							? new Date(detail.updatedAt)
							: undefined,
					});
				}

				console.log(
					`[${this.platform}] ${propertyType.label} page ${page}: ${edges.length} listings fetched` +
						` (total so far: ${all.length})`,
				);
				options.onProgress?.({
					type: "page",
					platform: this.platform,
					page: totalFetchedPages,
					fetched: edges.length,
					total: all.length,
				});

				hasNext = pageInfo.hasNextPage;
				cursor = pageInfo.endCursor;

				if (hasNext && page < finalMaxPages) {
					// Occasionally pause longer (simulates reading a page)
					const longPause = Math.random() < 0.15;
					const jitter = Math.random() * 600;
					await this.delay(longPause ? delayMs * 3 + jitter : delayMs + jitter);
				}
			}
		}

		console.log(`[${this.platform}] Done — ${all.length} listings scraped.`);
		return all;
	}

	// ── Private helpers ─────────────────────────────────────────────────────────

	/**
	 * Advances the cursor by one page without fetching edge data.
	 * Used to skip pages cheaply when startPage > 1.
	 */
	private async fetchCursor(
		after: string | null,
		propertyType: BinaPropertyType,
	): Promise<PageInfo> {
		const query = /* graphql */ `
      query FetchCursor($after: String) {
        itemsConnection(
          filter: {
            cityId: "${CITY_ID_BAKU}"
            leased: ${propertyType.leased}
            ${propertyType.categoryId ? `categoryId: "${propertyType.categoryId}"` : ""}
          }
          after: $after
        ) {
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
		const json = await this.gql<{ itemsConnection: { pageInfo: PageInfo } }>(
			query,
			{ after },
			propertyType.referer,
		);
		return json.itemsConnection.pageInfo;
	}

	/**
	 * Fetches one page of listings from itemsConnection.
	 * Uses cursor-based pagination (Relay spec); pass null for the first page.
	 */
	private async fetchPage(
		after: string | null,
		propertyType: BinaPropertyType,
	): Promise<{ edges: Array<{ node: ESItemNode }>; pageInfo: PageInfo }> {
		const query = /* graphql */ `
      query FetchPage($after: String) {
        itemsConnection(
          filter: {
            cityId: "${CITY_ID_BAKU}"
            leased: ${propertyType.leased}
            ${propertyType.categoryId ? `categoryId: "${propertyType.categoryId}"` : ""}
          }
          after: $after
        ) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              rooms
              floor
              floors
              hasMortgage
              hasRepair
              hasBillOfSale
              price { total currency }
              area  { value }
              location { name slug id latitude longitude }
            }
          }
        }
      }
	    `;

		const json = await this.gql<ItemsConnectionData>(
			query,
			{ after },
			propertyType.referer,
		);
		return json.itemsConnection;
	}

	/**
	 * Batches up to N item(id:) queries in a single GraphQL request using field aliases.
	 * Returns a map of itemId → { title, description, updatedAt }.
	 *
	 * GraphQL aliases let us send:
	 *   { i123: item(id:"123") { title description } i456: item(id:"456") { ... } }
	 *
	 * Partial errors (e.g. a listing removed between queries) are tolerated.
	 */
	private async batchFetchDetails(
		ids: string[],
		referer?: string,
	): Promise<Record<string, ItemDetail>> {
		const fields = ids
			.map(
				(id) =>
					`i${id}: item(id: "${id}") { title description updatedAt category { name } latitude longitude photos { full } }`,
			)
			.join("\n");

		const query = `{ ${fields} }`;

		const raw = await this.gqlRaw<Record<string, ItemDetail>>(query, referer);

		// Collect whatever came back; ignore errors for individual items
		const result: Record<string, ItemDetail> = {};
		for (const id of ids) {
			const detail = raw[`i${id}`];
			if (detail) result[id] = detail;
		}
		return result;
	}

	/**
	 * Public method used by the backfill script.
	 * Returns a map of itemId → image URL array for the given IDs.
	 */
	async fetchImageUrls(ids: string[]): Promise<Record<string, string[]>> {
		const details = await this.batchFetchDetails(ids);
		const result: Record<string, string[]> = {};
		for (const [id, detail] of Object.entries(details)) {
			if (detail.photos?.length) {
				result[id] = detail.photos.map((p) => p.full);
			}
		}
		return result;
	}

	private async fetchGraphQL(
		body: string,
		referer?: string,
	): Promise<Response> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
			try {
				const resp = await fetch(GRAPHQL_URL, {
					method: "POST",
					headers: randomHeaders(referer),
					body,
					signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				});

				if (
					!resp.ok &&
					shouldRetry(resp.status) &&
					attempt < MAX_FETCH_ATTEMPTS
				) {
					await delay(RETRY_BASE_DELAY_MS * attempt);
					continue;
				}

				return resp;
			} catch (error) {
				lastError = error;
				if (attempt === MAX_FETCH_ATTEMPTS) break;
				await delay(RETRY_BASE_DELAY_MS * attempt);
			}
		}

		throw lastError;
	}

	/**
	 * Executes a GraphQL query and returns data, throwing on hard errors.
	 */
	private async gql<T>(
		query: string,
		variables?: Record<string, unknown>,
		referer?: string,
	): Promise<T> {
		const resp = await this.fetchGraphQL(
			JSON.stringify({ query, variables }),
			referer,
		);

		if (!resp.ok) {
			throw new Error(
				`[${this.platform}] HTTP ${resp.status} ${resp.statusText}`,
			);
		}

		const json = (await resp.json()) as GQLResponse<T>;

		if (json.errors?.length && !json.data) {
			throw new Error(
				`[${this.platform}] GraphQL error: ${json.errors[0]?.message}`,
			);
		}

		return json.data as T;
	}

	/**
	 * Like gql() but returns the raw data object and tolerates partial errors
	 * (used for batch item detail queries where some items may be deleted).
	 */
	private async gqlRaw<T extends Record<string, unknown>>(
		query: string,
		referer?: string,
	): Promise<T> {
		const resp = await this.fetchGraphQL(JSON.stringify({ query }), referer);

		if (!resp.ok) {
			throw new Error(
				`[${this.platform}] HTTP ${resp.status} ${resp.statusText}`,
			);
		}

		const json = (await resp.json()) as GQLResponse<T>;

		if (json.errors?.length) {
			const fatals = json.errors.filter((e) => !e.path); // errors without a path are fatal
			if (fatals.length > 0) {
				throw new Error(
					`[${this.platform}] Fatal GraphQL error: ${fatals[0]?.message}`,
				);
			}
			console.warn(
				`[${this.platform}] ${json.errors.length} partial error(s) in batch (items may have been removed)`,
			);
		}

		return (json.data ?? {}) as T;
	}
}
