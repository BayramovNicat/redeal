import { afterEach, describe, expect, test } from "bun:test";
import { BinaScraper } from "../src/scrapers/bina.scraper.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("BinaScraper", () => {
	test("retries transient GraphQL failures with timeout signals", async () => {
		const calls: RequestInit[] = [];
		globalThis.fetch = (async (_url, init) => {
			calls.push(init ?? {});

			if (calls.length === 1) {
				return new Response("upstream error", { status: 500 });
			}

			return Response.json({
				data: {
					i123: {
						title: "listing",
						description: "description",
						updatedAt: "2026-05-09T00:00:00Z",
						category: null,
						latitude: null,
						longitude: null,
						photos: [{ full: "https://example.test/photo.jpg" }],
					},
				},
			});
		}) as typeof fetch;

		const result = await new BinaScraper().fetchImageUrls(["123"]);

		expect(result).toEqual({ "123": ["https://example.test/photo.jpg"] });
		expect(calls).toHaveLength(2);
		expect(calls.every((call) => call.signal instanceof AbortSignal)).toBe(
			true,
		);
	});

	test("filters property types by listingType and categoryId", async () => {
		const fetchedReferers: string[] = [];
		globalThis.fetch = (async (_url, init) => {
			const body = JSON.parse(init?.body as string);
			const referer = (init?.headers as Record<string, string>)["Referer"];
			if (referer) {
				fetchedReferers.push(referer);
			}

			// Return empty connection edges to stop pagination immediately
			return Response.json({
				data: {
					itemsConnection: {
						pageInfo: { hasNextPage: false, endCursor: "" },
						edges: [],
					},
				},
			});
		}) as typeof fetch;

		const scraper = new BinaScraper();

		// Test rent filtering (should only hit the rental referers: https://bina.az/kiraye)
		await scraper.scrape({ maxPages: 1, listingType: "rent" });
		expect(fetchedReferers).toEqual([
			"https://bina.az/kiraye",
			"https://bina.az/kiraye",
		]);

		// Test categoryId filter (5 should only hit houses/villas)
		fetchedReferers.length = 0;
		await scraper.scrape({ maxPages: 1, categoryId: "5" });
		expect(fetchedReferers).toEqual([
			"https://bina.az/baki/alqi-satqi/heyet-evleri",
			"https://bina.az/kiraye",
		]);

		// Combined cron filters should only hit sale apartments.
		fetchedReferers.length = 0;
		await scraper.scrape({
			maxPages: 1,
			listingType: "sale",
			categoryId: "1",
		});
		expect(fetchedReferers).toEqual([
			"https://bina.az/baki/alqi-satqi/menziller",
		]);
	});
});
