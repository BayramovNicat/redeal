import { afterEach, describe, expect, test } from "bun:test";
import {
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
});
