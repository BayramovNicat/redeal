import { afterEach, describe, expect, test } from "bun:test";
import {
	buildPropertyUpdateData,
	checkAndDeleteEndedListings,
	getBinaItemId,
	isGraphQLItemEnded,
} from "../src/modules/deals/listing-status.service.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("listing-status service", () => {
	test("getBinaItemId parses standard and www URLs", () => {
		expect(getBinaItemId("https://bina.az/items/5473904")).toBe("5473904");
		expect(getBinaItemId("https://www.bina.az/items/5473904?ref=1")).toBe(
			"5473904",
		);
		expect(getBinaItemId("https://example.com/items/5473904")).toBeNull();
	});

	test("isGraphQLItemEnded catches null, non-PUBLISHED state, manual expiry, and past expiresAt", () => {
		expect(isGraphQLItemEnded(null)).toBe(true);
		expect(
			isGraphQLItemEnded({
				id: "1",
				state: "EXPIRED",
				isExpiredManually: false,
				expiresAt: null,
			}),
		).toBe(true);
		expect(
			isGraphQLItemEnded({
				id: "2",
				state: "PUBLISHED",
				isExpiredManually: true,
				expiresAt: null,
			}),
		).toBe(true);
		expect(
			isGraphQLItemEnded({
				id: "3",
				state: "PUBLISHED",
				isExpiredManually: false,
				expiresAt: "2020-01-01T00:00:00Z",
			}),
		).toBe(true);
		expect(
			isGraphQLItemEnded({
				id: "4",
				state: "PUBLISHED",
				isExpiredManually: false,
				expiresAt: null,
			}),
		).toBe(false);
		expect(
			isGraphQLItemEnded({
				id: "5",
				state: "PUBLISHED",
				isExpiredManually: false,
				expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			}),
		).toBe(false);
	});

	test("checkAndDeleteEndedListings retries transient errors and deletes ended variants without falsely deleting missing keys", async () => {
		let attempts = 0;
		globalThis.fetch = (async () => {
			attempts++;
			if (attempts === 1) {
				return new Response("upstream error", { status: 502 });
			}
			return Response.json({
				data: {
					i101: {
						id: "101",
						state: "PUBLISHED",
						isExpiredManually: false,
						expiresAt: null,
					},
					i102: null,
					i103: {
						id: "103",
						state: "EXPIRED",
						isExpiredManually: true,
						expiresAt: null,
					},
					// i104 intentionally omitted from partial GraphQL data
				},
			});
		}) as unknown as typeof fetch;

		const deletedUrlBatches: string[][] = [];
		const result = await checkAndDeleteEndedListings(
			[
				"https://bina.az/items/101",
				"https://bina.az/items/102",
				"https://www.bina.az/items/102",
				"https://bina.az/items/103",
				"https://bina.az/items/104",
			],
			async (urlBatch) => {
				deletedUrlBatches.push(urlBatch);
				return urlBatch.length;
			},
		);

		expect(attempts).toBe(2);
		expect(result).toEqual({
			checked: 4,
			ended: 3,
			deleted: 3,
			failed: 1,
		});
		expect(deletedUrlBatches.flat().sort()).toEqual([
			"https://bina.az/items/102",
			"https://bina.az/items/103",
			"https://www.bina.az/items/102",
		]);
	});

	test("checkAndDeleteEndedListings treats GraphQL field errors with null data as failed, not ended", async () => {
		globalThis.fetch = (async () =>
			Response.json({
				data: {
					i201: null,
					i202: {
						id: "202",
						state: "PUBLISHED",
						isExpiredManually: false,
						expiresAt: null,
					},
				},
				errors: [{ message: "Upstream timeout", path: ["i201"] }],
			})) as unknown as typeof fetch;

		const deletedUrls: string[] = [];
		const result = await checkAndDeleteEndedListings(
			["https://bina.az/items/201", "https://bina.az/items/202"],
			async (urlBatch) => {
				deletedUrls.push(...urlBatch);
				return urlBatch.length;
			},
		);

		expect(result).toEqual({
			checked: 1,
			ended: 0,
			deleted: 0,
			failed: 1,
		});
		expect(deletedUrls).toEqual([]);
	});

	test("buildPropertyUpdateData returns null when fields match and detects price drops & field edits", () => {
		const baseExisting = {
			id: 1,
			source_url: "https://bina.az/items/999",
			price: 200000,
			area_sqm: 100,
			price_per_sqm: 2000,
			district: "Səbail",
			location_name: "baki/sebail/bayil",
			latitude: 40.34,
			longitude: 49.83,
			rooms: 3,
			floor: 5,
			total_floors: 12,
			category: "new" as const,
			has_document: true,
			has_mortgage: true,
			has_repair: true,
			description: "Nice flat",
			image_urls: ["https://img.example/1.jpg"],
			is_urgent: false,
			has_active_mortgage: false,
			posted_date: new Date("2026-10-01T10:00:00Z"),
			expires_at: new Date("2026-12-01T10:00:00Z"),
		};

		const matchingItem = {
			id: "999",
			state: "PUBLISHED",
			isExpiredManually: false,
			expiresAt: "2026-12-01T10:00:00Z",
			title: "Satılır 3 otaqlı yeni tikili 100 m²",
			description: "Nice flat",
			updatedAt: "2026-10-01T10:00:00Z",
			rooms: 3,
			floor: 5,
			floors: 12,
			hasMortgage: true,
			hasRepair: true,
			hasBillOfSale: true,
			price: { total: 200000, currency: "AZN" },
			area: { value: 100 },
			location: {
				name: "Bayıl",
				slug: "baki/sebail/bayil",
				id: "49",
				latitude: 40.34,
				longitude: 49.83,
			},
			category: { name: "Yeni tikili" },
			latitude: 40.34,
			longitude: 49.83,
			photos: [{ full: "https://img.example/1.jpg" }],
		};

		expect(buildPropertyUpdateData(baseExisting, matchingItem)).toBeNull();

		const changedItem = {
			...matchingItem,
			price: { total: 180000, currency: "AZN" },
			area: { value: 80 },
			description: "Təcili satılır! Hazır ipoteka.",
			rooms: 2,
			photos: [{ full: "https://img.example/2.jpg" }],
		};

		const diff = buildPropertyUpdateData(baseExisting, changedItem);
		expect(diff).not.toBeNull();
		expect(diff?.isPriceDrop).toBe(true);
		expect(diff?.updateData).toEqual({
			price: 180000,
			area_sqm: 80,
			price_per_sqm: 2250,
			price_drop_count: { increment: 1 },
			rooms: 2,
			description: "Təcili satılır! Hazır ipoteka.",
			is_urgent: true,
			has_active_mortgage: true,
			image_urls: ["https://img.example/2.jpg"],
		});
	});
});
