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
			const referer = (init?.headers as Record<string, string>).Referer;
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

	test("skips batchFetchDetails for unchanged existing listings and fetches new or price-changed ones", async () => {
		const gqlBodies: string[] = [];
		globalThis.fetch = (async (_url, init) => {
			const body = String(init?.body ?? "");
			gqlBodies.push(body);

			if (body.includes("itemsConnection")) {
				return Response.json({
					data: {
						itemsConnection: {
							pageInfo: { hasNextPage: false, endCursor: "" },
							edges: [
								{
									node: {
										id: "1001",
										rooms: 2,
										floor: 4,
										floors: 12,
										hasMortgage: false,
										hasRepair: true,
										hasBillOfSale: true,
										price: { total: 150000, currency: "AZN" },
										area: { value: 75 },
										location: {
											name: "Yasamal",
											slug: "yasamal",
											id: "10",
											latitude: 40.38,
											longitude: 49.81,
										},
									},
								},
								{
									node: {
										id: "1002",
										rooms: 3,
										floor: 6,
										floors: 16,
										hasMortgage: false,
										hasRepair: true,
										hasBillOfSale: true,
										price: { total: 210000, currency: "AZN" },
										area: { value: 110 },
										location: {
											name: "Nerimanov",
											slug: "nerimanov",
											id: "11",
											latitude: 40.4,
											longitude: 49.85,
										},
									},
								},
								{
									node: {
										id: "1003",
										rooms: 1,
										floor: 2,
										floors: 9,
										hasMortgage: false,
										hasRepair: true,
										hasBillOfSale: true,
										price: { total: 95000, currency: "AZN" },
										area: { value: 48 },
										location: {
											name: "Xetai",
											slug: "xetai",
											id: "12",
											latitude: 40.37,
											longitude: 49.9,
										},
									},
								},
							],
						},
					},
				});
			}

			return Response.json({
				data: {
					i1002: {
						title: "Price changed",
						description: "Updated price",
						updatedAt: "2026-11-23T00:00:00Z",
						expiresAt: "2026-12-23T00:00:00Z",
						category: { name: "Yeni tikili" },
						latitude: null,
						longitude: null,
						photos: [{ full: "https://example.test/1002.jpg" }],
					},
					i1003: {
						title: "Brand new",
						description: "New listing",
						updatedAt: "2026-11-23T01:00:00Z",
						expiresAt: null,
						category: { name: "Köhnə tikili" },
						latitude: null,
						longitude: null,
						photos: [{ full: "https://example.test/1003.jpg" }],
					},
				},
			});
		}) as typeof fetch;

		const results = await new BinaScraper().scrape({
			maxPages: 1,
			listingType: "sale",
			categoryId: "1",
			findExistingPrices: async () =>
				new Map([
					["https://bina.az/items/1001", 150000], // unchanged -> skip
					["https://bina.az/items/1002", 220000], // price changed -> fetch
				]),
		});

		expect(gqlBodies).toHaveLength(2);
		const detailQuery = JSON.parse(gqlBodies[1] ?? "{}").query as string;
		expect(detailQuery).not.toContain('item(id: "1001")');
		expect(detailQuery).toContain('item(id: "1002")');
		expect(detailQuery).toContain('item(id: "1003")');
		expect(results.map((r) => r.source_url)).toEqual([
			"https://bina.az/items/1002",
			"https://bina.az/items/1003",
		]);
		expect(results[0]?.expires_at?.toISOString()).toBe(
			"2026-12-23T00:00:00.000Z",
		);
		expect(results[1]?.expires_at).toBeUndefined();
	});

	test("detectActiveMortgage matches hazir ipoteka/kredit and uppercase Azerbaijani İ", async () => {
		const { detectActiveMortgage } = await import(
			"../src/scrapers/base.scraper.js"
		);
		expect(detectActiveMortgage("Mənzil hazır ipoteka ilə satılır")).toBe(true);
		expect(detectActiveMortgage("hazir kredit var")).toBe(true);
		expect(detectActiveMortgage("DÖVLƏT İPOTEKASI")).toBe(true);
		expect(detectActiveMortgage("İLKİN ÖDƏNİŞ 30000")).toBe(true);
		expect(detectActiveMortgage("ÜZƏRİNDƏ BORC VAR")).toBe(true);
		expect(detectActiveMortgage("Təmirli kupçalı mənzil")).toBe(false);
	});
});
