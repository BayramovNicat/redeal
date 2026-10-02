import type { Page } from "@playwright/test";

export const deal = {
	source_url: "https://example.com/deal-1",
	price: 120000,
	area_sqm: 80,
	price_per_sqm: 1500,
	location_avg_price_per_sqm: 2000,
	discount_percent: 25,
	tier: "High Value Deal",
	district: "Yasamal",
	location_name: "Yasamal",
	rooms: 3,
	floor: 4,
	total_floors: 12,
	is_urgent: true,
	has_document: true,
	has_repair: true,
	has_mortgage: false,
	has_active_mortgage: false,
	price_drop_count: 1,
	posted_date: new Date().toISOString(),
	description: "Bright test apartment",
	image_urls: [
		"https://example.com/image-1.jpg",
		"https://example.com/image-2.jpg",
	],
	latitude: 40.377,
	longitude: 49.837,
	price_history: [
		{ price: "140000", recorded_at: "2026-01-01T00:00:00.000Z" },
		{ price: "120000", recorded_at: "2026-02-01T00:00:00.000Z" },
	],
};

export const cheaperDeal = {
	...deal,
	source_url: "https://example.com/deal-2",
	price: 90000,
	price_per_sqm: 1200,
	discount_percent: 15,
	tier: "Good Deal",
	description: "Lower priced test apartment",
	image_urls: [],
};

export const heatmapData = [
	{
		location_name: "Yasamal",
		avg_price_per_sqm: 2000,
		count: 10,
		lat: 40.377,
		lng: 49.837,
		recent_avg: 2100,
		prior_avg: 2000,
		trend: "up",
	},
	{
		location_name: "Nərimanov",
		avg_price_per_sqm: 2500,
		count: 8,
		lat: 40.409,
		lng: 49.867,
		recent_avg: 2450,
		prior_avg: 2500,
		trend: "down",
	},
];

export const trendData = [
	{ week: "2026-04-06T00:00:00.000Z", avg_ppsm: 1800 },
	{ week: "2026-04-13T00:00:00.000Z", avg_ppsm: 1900 },
	{ week: "2026-04-20T00:00:00.000Z", avg_ppsm: 2000 },
];

export const activeAlert = {
	id: "alert-1",
	chat_id: "123456789",
	token: "token-1",
	label: "Yasamal alert",
	filters: { location: "Yasamal", threshold: 10, minPrice: 100000 },
	is_active: true,
	created_at: "2026-05-09T10:00:00.000Z",
};

type MockApiOptions = {
	searchUrls?: string[];
	undervalued?: unknown;
	heatmap?: unknown;
	heatmapStatus?: number;
	alertsStatus?: number;
	alertsError?: string;
	alerts?: unknown[];
	deletedAlerts?: string[];
	locationsStatus?: number;
	locations?: string[];
	trend?: unknown;
	trendStatus?: number;
	mapPins?: unknown;
	byUrls?: unknown;
	byUrlsStatus?: number;
};

export async function mockApi(page: Page, options: MockApiOptions = {}) {
	await page.route("https://*.basemaps.cartocdn.com/**", async (route) => {
		await route.fulfill({ status: 204, body: "" });
	});
	await page.route("https://mt*.google.com/**", async (route) => {
		await route.fulfill({ status: 204, body: "" });
	});
	await page.route("**/api/deals/locations", async (route) => {
		if (options.locationsStatus && options.locationsStatus >= 400) {
			await route.fulfill({
				status: options.locationsStatus,
				json: { error: "failed" },
			});
			return;
		}
		await route.fulfill({
			json: { data: options.locations ?? ["Yasamal", "Nərimanov"] },
		});
	});
	await page.route("**/api/deals/undervalued**", async (route) => {
		options.searchUrls?.push(route.request().url());
		await route.fulfill({
			json: options.undervalued ?? {
				location: "__all__",
				threshold_pct: 10,
				limit: 200,
				offset: 0,
				count: 1,
				total: 1,
				data: [deal],
			},
		});
	});
	await page.route("**/api/deals/by-urls", async (route) => {
		if (options.byUrlsStatus && options.byUrlsStatus >= 400) {
			await route.fulfill({
				status: options.byUrlsStatus,
				json: { error: "failed" },
			});
			return;
		}
		await route.fulfill({ json: options.byUrls ?? { data: [deal] } });
	});
	await page.route("**/api/deals/trend**", async (route) => {
		if (options.trendStatus && options.trendStatus >= 400) {
			await route.fulfill({
				status: options.trendStatus,
				json: { error: "failed" },
			});
			return;
		}
		await route.fulfill({
			json: options.trend ?? { location: "Yasamal", data: trendData },
		});
	});
	await page.route("**/api/deals/map-pins**", async (route) => {
		await route.fulfill({
			json: options.mapPins ?? {
				count: 1,
				data: [
					{
						source_url: deal.source_url,
						lat: deal.latitude,
						lng: deal.longitude,
						price: deal.price,
						price_per_sqm: deal.price_per_sqm,
						area_sqm: deal.area_sqm,
						floor: deal.floor,
						total_floors: deal.total_floors,
						rooms: deal.rooms,
						location_name: deal.location_name,
						image_url: deal.image_urls[0],
						discount_percent: deal.discount_percent,
						tier: deal.tier,
					},
				],
			},
		});
	});
	await page.route("**/api/heatmap", async (route) => {
		await route.fulfill({
			status: options.heatmapStatus ?? 200,
			json: options.heatmap ?? { data: heatmapData },
		});
	});
	await page.route("**/api/alerts**", async (route) => {
		if (route.request().method() === "GET") {
			await route.fulfill({ json: { ok: true, alerts: options.alerts ?? [] } });
			return;
		}
		if (route.request().method() === "DELETE") {
			options.deletedAlerts?.push(route.request().url().split("/").pop() ?? "");
			await route.fulfill({ json: { ok: true } });
			return;
		}
		if (options.alertsStatus && options.alertsStatus >= 400) {
			await route.fulfill({
				status: options.alertsStatus,
				json: { error: options.alertsError ?? "Alert failed" },
			});
			return;
		}
		await route.fulfill({
			json: { ok: true, id: "alert-1", token: "token-1" },
		});
	});
	await page.route("**/api/scrape/runs**", async (route) => {
		await route.fulfill({ json: { ok: true, runs: [] } });
	});
	await page.route("**/api/scrape/session", async (route) => {
		await route.fulfill({ json: { ok: true, authenticated: false } });
	});
	await page.route("**/health", async (route) => {
		await route.fulfill({
			json: {
				status: "ok",
				timestamp: new Date().toISOString(),
				properties: 1,
			},
		});
	});
}
