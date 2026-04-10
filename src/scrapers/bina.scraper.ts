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

import { BaseScraper, type ScrapedListing, type ScraperOptions } from './base.scraper.js';
import { slugToDistrict } from '../utils/district-normalizer.js';

const GRAPHQL_URL = 'https://bina.az/graphql';
const ITEM_BASE_URL = 'https://bina.az/items';

/** Filter params for "apartments for sale in Baku" */
const DEFAULT_FILTER = { categoryId: '1', cityId: '1', leased: false };

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

const ACCEPT_LANGUAGES = [
  'az-AZ,az;q=0.9,en;q=0.8',
  'az-AZ,az;q=0.9,en-US;q=0.8,en;q=0.7',
  'az,en-US;q=0.9,en;q=0.8',
];

function randomHeaders(): Record<string, string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)]!;
  return {
    'Content-Type': 'application/json',
    'User-Agent': ua,
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://bina.az',
    'Referer': 'https://bina.az/baki/alqi-satqi/menziller',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': ua.includes('Windows') ? '"Windows"' : ua.includes('Linux') ? '"Linux"' : '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  };
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
  price: { value: number; currency: string };
  area: { value: number };
  location: { name: string; slug: string; id: string; latitude: number | null; longitude: number | null };
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
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export class BinaScraper extends BaseScraper {
  readonly platform = 'bina.az';

  async scrape(options: ScraperOptions = {}): Promise<ScrapedListing[]> {
    const { maxPages: defaultMax = 20, startPage = 1, endPage, delayMs = 800 } = options;
    const finalMaxPages = endPage ?? defaultMax;
    const all: ScrapedListing[] = [];

    let cursor: string | null = null;
    let page = 0;
    let hasNext = true;

    console.log(`[${this.platform}] Starting GraphQL scrape (startPage=${startPage}, limit=${finalMaxPages})...`);
    options.onProgress?.({ type: 'start', platform: this.platform, maxPages: finalMaxPages, startPage, endPage });

    // Advance the cursor cheaply to startPage without fetching edge data.
    while (page < startPage - 1 && hasNext) {
      page++;
      console.log(`[${this.platform}] Advancing cursor to startPage (${page}/${startPage - 1})...`);
      const pageInfo = await this.fetchCursor(cursor);
      hasNext = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
      await this.delay(150);
    }

    while (hasNext && page < finalMaxPages) {
      page++;

      const { edges, pageInfo } = await this.fetchPage(cursor);

      if (edges.length === 0) break;

      // Fetch full item details in one batched GraphQL request
      const ids = edges.map((e) => e.node.id);
      const details = await this.batchFetchDetails(ids);

      for (const { node } of edges) {
        const price = node.price.value;
        const area = node.area.value;
        if (price <= 0 || area <= 0) continue;

        const detail = details[node.id];
        const urgencyText = `${detail?.title ?? ''} ${detail?.description ?? ''}`;

        const normalizedDistrict = slugToDistrict(node.location.slug);
        // Fall back to the exact location name from the API when district can't be resolved
        const district =
          normalizedDistrict === 'Unknown' ? node.location.name : normalizedDistrict;

        all.push({
          source_url: `${ITEM_BASE_URL}/${node.id}`,
          price,
          area_sqm: area,
          district,
          location_name: node.location.name,
          latitude: node.location.latitude ?? undefined,
          longitude: node.location.longitude ?? undefined,
          rooms: node.rooms ?? undefined,
          floor: node.floor ?? undefined,
          total_floors: node.floors ?? undefined,
          category: detail?.category?.name,
          has_document: node.hasBillOfSale ?? undefined,
          has_mortgage: node.hasMortgage ?? undefined,
          has_repair: node.hasRepair ?? undefined,
          description: detail?.description,
          is_urgent: this.isUrgent(urgencyText),
          posted_date: detail?.updatedAt ? new Date(detail.updatedAt) : undefined,
        });
      }

      console.log(
        `[${this.platform}] Page ${page}: ${edges.length} listings fetched` +
          ` (total so far: ${all.length})`,
      );
      options.onProgress?.({
        type: 'page',
        platform: this.platform,
        page,
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

    console.log(`[${this.platform}] Done — ${all.length} listings scraped.`);
    return all;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Advances the cursor by one page without fetching edge data.
   * Used to skip pages cheaply when startPage > 1.
   */
  private async fetchCursor(after: string | null): Promise<PageInfo> {
    const afterArg = after ? `, after: "${after}"` : '';
    const query = /* graphql */ `
      {
        itemsConnection(
          filter: {
            categoryId: "${DEFAULT_FILTER.categoryId}"
            cityId: "${DEFAULT_FILTER.cityId}"
            leased: ${DEFAULT_FILTER.leased}
          }
          ${afterArg}
        ) {
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const json = await this.gql<{ itemsConnection: { pageInfo: PageInfo } }>(query);
    return json.itemsConnection.pageInfo;
  }

  /**
   * Fetches one page of listings from itemsConnection.
   * Uses cursor-based pagination (Relay spec); pass null for the first page.
   */
  private async fetchPage(
    after: string | null,
  ): Promise<{ edges: Array<{ node: ESItemNode }>; pageInfo: PageInfo }> {
    const afterArg = after ? `, after: "${after}"` : '';

    const query = /* graphql */ `
      {
        itemsConnection(
          filter: {
            categoryId: "${DEFAULT_FILTER.categoryId}"
            cityId: "${DEFAULT_FILTER.cityId}"
            leased: ${DEFAULT_FILTER.leased}
          }
          ${afterArg}
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
              price { value currency }
              area  { value }
              location { name slug id latitude longitude }
            }
          }
        }
      }
    `;

    const json = await this.gql<ItemsConnectionData>(query);
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
  private async batchFetchDetails(ids: string[]): Promise<Record<string, ItemDetail>> {
    const fields = ids
      .map((id) => `i${id}: item(id: "${id}") { title description updatedAt category { name } }`)
      .join('\n');

    const query = `{ ${fields} }`;

    const raw = await this.gqlRaw<Record<string, ItemDetail>>(query);

    // Collect whatever came back; ignore errors for individual items
    const result: Record<string, ItemDetail> = {};
    for (const id of ids) {
      const detail = raw[`i${id}`];
      if (detail) result[id] = detail;
    }
    return result;
  }

  /**
   * Executes a GraphQL query and returns data, throwing on hard errors.
   */
  private async gql<T>(query: string): Promise<T> {
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: randomHeaders(),
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) {
      throw new Error(`[${this.platform}] HTTP ${resp.status} ${resp.statusText}`);
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
  private async gqlRaw<T extends Record<string, unknown>>(query: string): Promise<T> {
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: randomHeaders(),
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) {
      throw new Error(`[${this.platform}] HTTP ${resp.status} ${resp.statusText}`);
    }

    const json = (await resp.json()) as GQLResponse<T>;

    if (json.errors?.length) {
      const fatals = json.errors.filter((e) => !e.path); // errors without a path are fatal
      if (fatals.length > 0) {
        throw new Error(`[${this.platform}] Fatal GraphQL error: ${fatals[0]?.message}`);
      }
      console.warn(
        `[${this.platform}] ${json.errors.length} partial error(s) in batch (items may have been removed)`,
      );
    }

    return (json.data ?? {}) as T;
  }
}
