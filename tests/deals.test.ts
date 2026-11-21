import { describe, expect, test } from "bun:test";
import {
	getMapPins,
	getPriceDropDeals,
	getUndervalued,
	getUndervaluedUrlTiers,
	invalidateDealsCaches,
} from "../src/modules/deals/deals.service.js";
import {
	classifyDeal,
	DEAL_TIERS,
	MAX_DEAL_DISCOUNT_PERCENT,
} from "../src/utils/deals.js";
import { prisma } from "../src/utils/prisma.js";

describe("deal utils", () => {
	test("MAX_DEAL_DISCOUNT_PERCENT is 90", () => {
		expect(MAX_DEAL_DISCOUNT_PERCENT).toBe(90);
	});

	test("classifyDeal maps discount thresholds to tiers", () => {
		expect(classifyDeal(90)).toBe(DEAL_TIERS.HIGH_VALUE);
		expect(classifyDeal(20)).toBe(DEAL_TIERS.HIGH_VALUE);
		expect(classifyDeal(19.99)).toBe(DEAL_TIERS.GOOD);
		expect(classifyDeal(10)).toBe(DEAL_TIERS.GOOD);
		expect(classifyDeal(0)).toBe(DEAL_TIERS.FAIR);
		expect(classifyDeal(-0.01)).toBe(DEAL_TIERS.OVERPRICED);
	});
});

describe("max discount filtering (>90% hidden)", () => {
	test("hides >90% deals from undervalued, url tiers, map pins, and price drops while keeping <=90%", async () => {
		try {
			await prisma.$queryRaw`SELECT 1`;
		} catch {
			console.warn("Skipping DB deal filter test: database unavailable");
			return;
		}

		const loc = `__test_max_disc_${Date.now()}`;
		const baseUrl = `https://test.redeal.local/${loc}`;
		const urls = {
			avg1: `${baseUrl}/avg-1`,
			avg2: `${baseUrl}/avg-2`,
			avg3: `${baseUrl}/avg-3`,
			validDeal: `${baseUrl}/valid-25`,
			exact90: `${baseUrl}/exact-90`,
			over90: `${baseUrl}/over-90`,
			extreme97: `${baseUrl}/extreme-97`,
		};

		try {
			// Three middle-floor listings set an exact location average of 2000 AZN/m².
			// First-floor test listings are excluded from the average calculation so the
			// baseline stays fixed at 2000 AZN/m².
			await prisma.property.createMany({
				data: [
					{
						source_url: urls.avg1,
						price: 200000,
						area_sqm: 100,
						price_per_sqm: 2000,
						district: loc,
						location_name: loc,
						latitude: 40.37,
						longitude: 49.83,
						floor: 5,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
					},
					{
						source_url: urls.avg2,
						price: 200000,
						area_sqm: 100,
						price_per_sqm: 2000,
						district: loc,
						location_name: loc,
						latitude: 40.371,
						longitude: 49.831,
						floor: 6,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
					},
					{
						source_url: urls.avg3,
						price: 200000,
						area_sqm: 100,
						price_per_sqm: 2000,
						district: loc,
						location_name: loc,
						latitude: 40.372,
						longitude: 49.832,
						floor: 7,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
					},
					{
						source_url: urls.validDeal,
						price: 150000,
						area_sqm: 100,
						price_per_sqm: 1500, // 25% discount
						district: loc,
						location_name: loc,
						latitude: 40.373,
						longitude: 49.833,
						floor: 1,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
						price_drop_count: 1,
					},
					{
						source_url: urls.exact90,
						price: 20000,
						area_sqm: 100,
						price_per_sqm: 200, // exact 90.00% discount
						district: loc,
						location_name: loc,
						latitude: 40.374,
						longitude: 49.834,
						floor: 1,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
						price_drop_count: 1,
					},
					{
						source_url: urls.over90,
						price: 19900,
						area_sqm: 100,
						price_per_sqm: 199, // 90.05% discount (>90%, should be hidden)
						district: loc,
						location_name: loc,
						latitude: 40.375,
						longitude: 49.835,
						floor: 1,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
						price_drop_count: 1,
					},
					{
						source_url: urls.extreme97,
						price: 5000,
						area_sqm: 100,
						price_per_sqm: 50, // 97.50% discount (>90%, should be hidden)
						district: loc,
						location_name: loc,
						latitude: 40.376,
						longitude: 49.836,
						floor: 1,
						total_floors: 12,
						category: "new",
						listing_type: "sale",
						price_drop_count: 2,
					},
				],
			});

			invalidateDealsCaches();

			const undervalued = await getUndervalued([loc], 10, {
				category: "new",
				listingType: "sale",
			});
			expect(undervalued.total).toBe(2);
			expect(undervalued.data.map((d) => d.source_url)).toEqual([
				urls.exact90,
				urls.validDeal,
			]);

			// Also hidden when threshold is 0 (show all)
			const allUndervalued = await getUndervalued([loc], 0, {
				category: "new",
				listingType: "sale",
			});
			expect(allUndervalued.total).toBe(5);
			const allUrls = allUndervalued.data.map((d) => d.source_url);
			expect(allUrls).toContain(urls.exact90);
			expect(allUrls).toContain(urls.validDeal);
			expect(allUrls).not.toContain(urls.over90);
			expect(allUrls).not.toContain(urls.extreme97);

			// Url tiers (used by admin validation) match the same filter
			const urlTiers = await getUndervaluedUrlTiers([loc], 10, {
				category: "new",
				listingType: "sale",
			});
			expect(urlTiers.map((r) => r.source_url)).toEqual([
				urls.exact90,
				urls.validDeal,
			]);

			// Map pins exclude >90%
			const pins = await getMapPins({
				locations: [loc],
				thresholdPercent: 10,
				filters: { category: "new", listingType: "sale" },
			});
			expect(pins.map((p) => p.source_url)).toEqual([
				urls.exact90,
				urls.validDeal,
			]);

			// Price drop deals exclude >90%
			const drops = await getPriceDropDeals([loc], { minDropCount: 1 });
			expect(drops.total).toBe(2);
			const dropUrls = drops.data.map((d) => d.source_url).sort();
			expect(dropUrls).toEqual([urls.exact90, urls.validDeal].sort());
		} finally {
			await prisma.property.deleteMany({
				where: { location_name: loc },
			});
			invalidateDealsCaches();
		}
	});
});
