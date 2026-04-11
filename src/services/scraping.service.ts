/**
 * ScrapingService orchestrates the scraping pipeline.
 * It runs all registered scrapers and upserts results into the database,
 * computing price_per_sqm before persistence.
 */

import { Prisma } from "@prisma/client";
import type {
	IScraper,
	ScrapedListing,
	ScraperOptions,
} from "../scrapers/base.scraper.js";
import { executeRaw, prisma } from "../utils/prisma.js";

export interface ScrapeResult {
	platform: string;
	persisted: number;
	skipped: number;
	errors: string[];
}

export class ScrapingService {
	private scrapers: IScraper[];

	constructor(scrapers: IScraper[] = []) {
		this.scrapers = scrapers;
	}

	/** Adds a scraper implementation at runtime */
	registerScraper(scraper: IScraper): void {
		this.scrapers.push(scraper);
	}

	/**
	 * Triggers all registered scrapers concurrently and persists results.
	 * Returns a per-platform summary of what was upserted vs skipped.
	 */
	async runAll(options?: ScraperOptions): Promise<ScrapeResult[]> {
		const results = await Promise.all(
			this.scrapers.map(async (scraper) => {
				const result: ScrapeResult = {
					platform: scraper.platform,
					persisted: 0,
					skipped: 0,
					errors: [],
				};

				try {
					const listings = await scraper.scrape(options);
					options?.onProgress?.({
						type: "persisting",
						platform: scraper.platform,
						count: listings.length,
					});
					const { persisted, skipped, errors } =
						await this.persistListings(listings);
					result.persisted = persisted;
					result.skipped = skipped;
					result.errors = errors;
					console.log(
						`[ScrapingService] ${scraper.platform}: persisted=${persisted} skipped=${skipped}`,
					);
					options?.onProgress?.({
						type: "done",
						platform: scraper.platform,
						persisted,
						skipped,
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(
						`[ScrapingService] ${scraper.platform} failed: ${message}`,
					);
					result.errors.push(message);
					options?.onProgress?.({
						type: "error",
						platform: scraper.platform,
						message,
					});
				}

				return result;
			}),
		);

		const total_persisted = results.reduce((sum, r) => sum + r.persisted, 0);
		options?.onProgress?.({ type: "complete", total_persisted });
		return results;
	}

	private async persistListings(
		listings: ScrapedListing[],
	): Promise<{ persisted: number; skipped: number; errors: string[] }> {
		let persisted = 0;
		let skipped = 0;
		const errors: string[] = [];

		if (listings.length === 0) return { persisted, skipped, errors };

		// Pre-compute price_per_sqm and normalise nullables for all rows up front.
		const rows = listings.map((l) => ({
			source_url: l.source_url,
			price: l.price,
			area_sqm: l.area_sqm,
			price_per_sqm:
				l.area_sqm > 0 ? parseFloat((l.price / l.area_sqm).toFixed(2)) : 0,
			district: l.district,
			location_name: l.location_name ?? null,
			latitude: l.latitude ?? null,
			longitude: l.longitude ?? null,
			rooms: l.rooms ?? null,
			floor: l.floor ?? null,
			total_floors: l.total_floors ?? null,
			category: l.category ?? null,
			has_document: l.has_document ?? null,
			has_mortgage: l.has_mortgage ?? null,
			has_repair: l.has_repair ?? null,
			description: l.description ?? null,
			is_urgent: l.is_urgent,
			posted_date: l.posted_date ?? null,
		}));

		// 20 params per row → max safe chunk well below PG's 65 535-param limit.
		const CHUNK_SIZE = 500;

		for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
			const chunk = rows.slice(i, i + CHUNK_SIZE);
			try {
				const now = new Date();
				const valueFragments = chunk.map(
					(r) => Prisma.sql`(
            ${r.source_url}, ${r.price}, ${r.area_sqm}, ${r.price_per_sqm},
            ${r.district}, ${r.location_name}, ${r.latitude}, ${r.longitude},
            ${r.rooms}, ${r.floor}, ${r.total_floors}, ${r.category},
            ${r.has_document}, ${r.has_mortgage}, ${r.has_repair},
            ${r.description}, ${r.is_urgent}, ${r.posted_date},
            ${now}, ${now}
          )`,
				);

				const affected = await executeRaw`
          INSERT INTO "Property" (
            source_url, price, area_sqm, price_per_sqm,
            district, location_name, latitude, longitude,
            rooms, floor, total_floors, category,
            has_document, has_mortgage, has_repair,
            description, is_urgent, posted_date,
            created_at, updated_at
          )
          VALUES ${Prisma.join(valueFragments)}
          ON CONFLICT (source_url) DO UPDATE SET
            price         = EXCLUDED.price,
            area_sqm      = EXCLUDED.area_sqm,
            price_per_sqm = EXCLUDED.price_per_sqm,
            district      = EXCLUDED.district,
            location_name = EXCLUDED.location_name,
            latitude      = EXCLUDED.latitude,
            longitude     = EXCLUDED.longitude,
            rooms         = EXCLUDED.rooms,
            floor         = EXCLUDED.floor,
            total_floors  = EXCLUDED.total_floors,
            category      = EXCLUDED.category,
            has_document  = EXCLUDED.has_document,
            has_mortgage  = EXCLUDED.has_mortgage,
            has_repair    = EXCLUDED.has_repair,
            description   = EXCLUDED.description,
            is_urgent     = EXCLUDED.is_urgent,
            posted_date   = EXCLUDED.posted_date,
            updated_at    = now()
        `;

				persisted += affected;
			} catch (err) {
				// Chunk failed — fall back to row-by-row to isolate the bad listing.
				console.warn(
					`[ScrapingService] Batch upsert failed at offset ${i}, falling back to row-by-row:`,
					err,
				);
				for (const r of chunk) {
					try {
						await prisma.property.upsert({
							where: { source_url: r.source_url },
							update: {
								price: r.price,
								area_sqm: r.area_sqm,
								price_per_sqm: r.price_per_sqm,
								district: r.district,
								location_name: r.location_name,
								latitude: r.latitude,
								longitude: r.longitude,
								rooms: r.rooms,
								floor: r.floor,
								total_floors: r.total_floors,
								category: r.category,
								has_document: r.has_document,
								has_mortgage: r.has_mortgage,
								has_repair: r.has_repair,
								description: r.description,
								is_urgent: r.is_urgent,
								posted_date: r.posted_date,
							},
							create: {
								source_url: r.source_url,
								price: r.price,
								area_sqm: r.area_sqm,
								price_per_sqm: r.price_per_sqm,
								district: r.district,
								location_name: r.location_name,
								latitude: r.latitude,
								longitude: r.longitude,
								rooms: r.rooms,
								floor: r.floor,
								total_floors: r.total_floors,
								category: r.category,
								has_document: r.has_document,
								has_mortgage: r.has_mortgage,
								has_repair: r.has_repair,
								description: r.description,
								is_urgent: r.is_urgent,
								posted_date: r.posted_date,
							},
						});
						persisted++;
					} catch (e) {
						skipped++;
						errors.push(
							`${r.source_url}: ${e instanceof Error ? e.message : String(e)}`,
						);
					}
				}
			}
		}

		return { persisted, skipped, errors };
	}
}
