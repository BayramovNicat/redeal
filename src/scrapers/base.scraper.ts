/**
 * Base scraper interface and abstract class.
 * Every new real estate platform scraper must implement IScraper.
 * Common parsing utilities live in BaseScraper so subclasses don't repeat them.
 */

export interface ScrapedListing {
  source_url: string;
  source_platform: string;
  price: number;
  currency: string;
  area_sqm: number;
  district: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  rooms?: number;
  floor?: number;
  total_floors?: number;
  category?: string;
  has_document?: boolean;
  has_mortgage?: boolean;
  has_repair?: boolean;
  description?: string;
  is_urgent: boolean;
  posted_date?: Date;
}

export type ScrapeProgressEvent =
  | { type: "start"; platform: string; maxPages: number; startPage?: number; endPage?: number }
  | {
      type: "page";
      platform: string;
      page: number;
      fetched: number;
      total: number;
    }
  | { type: "persisting"; platform: string; count: number }
  | { type: "done"; platform: string; persisted: number; skipped: number }
  | { type: "error"; platform: string; message: string }
  | { type: "complete"; total_persisted: number };

export interface ScraperOptions {
  /** Maximum number of listing pages to crawl (default: unlimited) */
  maxPages?: number;
  /** Page to start fetching details from (1-indexed). Pagination skips past earlier pages. */
  startPage?: number;
  /** Page to stop scraping. Can be used instead of maxPages to scrape a page range. */
  endPage?: number;
  /** Milliseconds to wait between HTTP requests to avoid rate-limiting */
  delayMs?: number;
  /** Optional callback for streaming progress events */
  onProgress?: (event: ScrapeProgressEvent) => void;
}

/** Contract every scraper implementation must satisfy */
export interface IScraper {
  /** The platform identifier (e.g. 'bina.az') stored in the DB */
  readonly platform: string;
  scrape(options?: ScraperOptions): Promise<ScrapedListing[]>;
}

/** Abstract base providing shared parsing helpers */
export abstract class BaseScraper implements IScraper {
  abstract readonly platform: string;
  abstract scrape(options?: ScraperOptions): Promise<ScrapedListing[]>;

  /**
   * Returns true if the listing text contains the Azerbaijani word for "urgent".
   * Listings marked "təcili" are typically priced to sell quickly.
   */
  protected isUrgent(text: string): boolean {
    return /t[əe]cili|[əea]lim\s+yand[ıi]|срочно/i.test(text);
  }

  /**
   * Parses a price string into a number.
   * Handles formats like "125 000 AZN", "₼125,000", "95000".
   */
  protected parsePrice(raw: string): number {
    const cleaned = raw.replace(/[^\d.]/g, "");
    return parseFloat(cleaned) || 0;
  }

  /**
   * Parses an area string into a number (square metres).
   * Handles formats like "78 m²", "78.5 kv.m", "110kvm".
   */
  protected parseArea(raw: string): number {
    const cleaned = raw.replace(/[^\d.]/g, "");
    return parseFloat(cleaned) || 0;
  }

  /** Resolves after `ms` milliseconds — use between requests to be polite to servers */
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
