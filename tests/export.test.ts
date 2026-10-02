import { describe, expect, test } from "bun:test";
import type { Property } from "../frontend/core/types";

if (typeof globalThis.localStorage === "undefined") {
	const storage = new Map<string, string>();
	globalThis.localStorage = {
		getItem: (k: string) => storage.get(k) ?? null,
		setItem: (k: string, v: string) => {
			storage.set(k, v);
		},
		removeItem: (k: string) => {
			storage.delete(k);
		},
		clear: () => storage.clear(),
		key: (_i: number) => null,
		length: 0,
	};
}

if (typeof globalThis.document === "undefined") {
	globalThis.document = {
		createElement: () => ({}),
	} as unknown as Document;
}

const { formatExportText } = await import(
	"../frontend/features/products/logic"
);

describe("formatExportText", () => {
	const sampleProperty: Property = {
		source_url: "https://bina.az/items/123456",
		price: 150000,
		area_sqm: 75,
		price_per_sqm: 2000,
		location_avg_price_per_sqm: 2400,
		discount_percent: 16.7,
		tier: "High Value Deal",
		location_name: "Elmlər Akademiyası",
		district: "Yasamal",
		latitude: 40.3756,
		longitude: 49.8123,
		rooms: 3,
		floor: 5,
		total_floors: 16,
		is_urgent: true,
		has_document: true,
		has_repair: true,
		has_mortgage: true,
		description: "Kupçalı, əla təmirli mənzil",
	};

	test("includes latitude and longitude position as coordinates", () => {
		const text = formatExportText([sampleProperty]);
		expect(text).toContain("Coordinates: 40.3756, 49.8123");
	});

	test("omits coordinates when latitude or longitude is missing", () => {
		const withoutCoords: Property = {
			...sampleProperty,
			latitude: undefined,
			longitude: undefined,
		};
		const text = formatExportText([withoutCoords]);
		expect(text).not.toContain("Coordinates:");
	});

	test("does not include discount percentage, discount tier, or market average in export", () => {
		const text = formatExportText([sampleProperty]);
		expect(text).not.toContain("Discount:");
		expect(text).not.toContain("16.7%");
		expect(text).not.toContain("High Value Deal");
		expect(text).not.toContain("Market avg");
	});
});
