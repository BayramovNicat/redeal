import { beforeAll, describe, expect, test } from "bun:test";
import { formatListing } from "../../src/modules/alerts/alerts.service.js";
import {
	addWhitelistedEmail,
	createSession,
	setAdminRole,
	upsertGoogleUser,
} from "../../src/modules/auth/auth.service.js";
import { prisma } from "../../src/utils/prisma.js";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const isCi = process.env.CI === "true";
let serverAvailable = false;
let seedAvailable = false;
let authCookie = "";

function authFetch(url: string, init?: RequestInit) {
	const headers = new Headers(init?.headers);
	if (authCookie && !headers.has("cookie")) {
		headers.set("cookie", authCookie);
	}
	return fetch(url, { ...init, headers });
}

beforeAll(async () => {
	try {
		const res = await fetch(`${baseUrl}/health`);
		serverAvailable = res.ok;
		if (!serverAvailable) return;

		const testEmail = "test-deals-runner@redeal.local";
		await addWhitelistedEmail(testEmail, "Test Runner");
		const user = await upsertGoogleUser({
			sub: "test-google-sub",
			email: testEmail,
			name: "Test Runner",
		});
		const session = await createSession(user.id);
		authCookie = `redeal_session=${session.signedCookieValue}`;

		const seedRes = await authFetch(`${baseUrl}/api/deals/by-urls`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				urls: ["https://test.redeal.local/yasamal-deal"],
			}),
		});
		const seedBody = (await seedRes.json()) as { data?: unknown[] };
		seedAvailable = seedRes.ok && (seedBody.data?.length ?? 0) > 0;
	} catch {
		serverAvailable = false;
		seedAvailable = false;
	}
});

function skipIfNoServer() {
	if (!serverAvailable) {
		const message = `API test server unavailable at ${baseUrl}. Start the app before running API tests.`;
		if (isCi) throw new Error(message);
		console.warn(`Skipping API test: ${message}`);
		return true;
	}
	return false;
}

function skipIfNoSeed() {
	if (skipIfNoServer()) return true;
	if (!seedAvailable) {
		const message =
			"Seed data unavailable. Run `bun run verify:db` before API tests.";
		if (isCi) throw new Error(message);
		console.warn(`Skipping seeded API test: ${message}`);
		return true;
	}
	return false;
}

async function getJson(path: string, headers: Record<string, string> = {}) {
	const res = await authFetch(`${baseUrl}${path}`, { headers });
	let body: unknown = null;
	try {
		body = await res.json();
	} catch {}
	return { res, body };
}

async function postJson(
	path: string,
	body: unknown,
	headers: Record<string, string> = {},
) {
	const res = await authFetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
	let parsed: unknown = null;
	try {
		parsed = await res.json();
	} catch {}
	return { res, body: parsed };
}

describe("public API", () => {
	test("health returns status and property count", async () => {
		if (skipIfNoServer()) return;
		const { res, body } = await getJson("/health");

		expect(res.status).toBe(200);
		expect(body).toMatchObject({ status: "ok" });
		expect(typeof (body as { timestamp?: unknown }).timestamp).toBe("string");
		expect(typeof (body as { properties?: unknown }).properties).toBe("number");
	});

	test("locations returns an array", async () => {
		if (skipIfNoServer()) return;
		const { res, body } = await getJson("/api/deals/locations");

		expect(res.status).toBe(200);
		expect(Array.isArray((body as { data?: unknown }).data)).toBe(true);
	});

	test("API responses support brotli compression", async () => {
		if (skipIfNoServer()) return;
		const res = await authFetch(`${baseUrl}/api/deals/locations`, {
			headers: { "accept-encoding": "br" },
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("content-encoding")).toBe("br");
		expect(res.headers.get("vary")).toContain("Accept-Encoding");
	});

	test("undervalued deals returns paginated shape", async () => {
		if (skipIfNoServer()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=10&limit=20&offset=0&sort=disc",
		);

		expect(res.status).toBe(200);
		expect(body).toMatchObject({
			location: "__all__",
			threshold_pct: 10,
			limit: 20,
			offset: 0,
		});
		expect(Array.isArray((body as { data?: unknown }).data)).toBe(true);
		expect(typeof (body as { count?: unknown }).count).toBe("number");
		expect(typeof (body as { total?: unknown }).total).toBe("number");
	});

	test("undervalued deals requires location", async () => {
		if (skipIfNoServer()) return;
		const { res } = await getJson("/api/deals/undervalued");

		expect(res.status).toBe(400);
	});

	test("undervalued deals rejects invalid threshold", async () => {
		if (skipIfNoServer()) return;
		const { res } = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=101",
		);

		expect(res.status).toBe(400);
	});

	test("undervalued deals rejects invalid sort", async () => {
		if (skipIfNoServer()) return;
		const { res } = await getJson(
			"/api/deals/undervalued?location=__all__&sort=bad",
		);

		expect(res.status).toBe(400);
	});

	test("map pins returns count and data", async () => {
		if (skipIfNoServer()) return;
		const { res, body } = await getJson(
			"/api/deals/map-pins?location=__all__&threshold=10",
		);

		expect(res.status).toBe(200);
		expect(typeof (body as { count?: unknown }).count).toBe("number");
		expect(Array.isArray((body as { data?: unknown }).data)).toBe(true);
	});

	test("map pins reject missing location and invalid threshold", async () => {
		if (skipIfNoServer()) return;

		const missingLocation = await getJson("/api/deals/map-pins");
		const invalidThreshold = await getJson(
			"/api/deals/map-pins?location=__all__&threshold=abc",
		);
		const highThreshold = await getJson(
			"/api/deals/map-pins?location=__all__&threshold=101",
		);

		expect(missingLocation.res.status).toBe(400);
		expect(invalidThreshold.res.status).toBe(400);
		expect(highThreshold.res.status).toBe(400);
	});

	test("trend requires location", async () => {
		if (skipIfNoServer()) return;
		const { res } = await getJson("/api/deals/trend");

		expect(res.status).toBe(400);
	});

	test("by-urls rejects invalid requests", async () => {
		if (skipIfNoServer()) return;

		const invalidJson = await postJson("/api/deals/by-urls", "{");
		const emptyUrls = await postJson("/api/deals/by-urls", { urls: [] });
		const missingUrls = await postJson("/api/deals/by-urls", {});

		expect(invalidJson.res.status).toBe(400);
		expect(emptyUrls.res.status).toBe(400);
		expect(missingUrls.res.status).toBe(400);
	});

	test("seeded location filter returns only selected location", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=Yasamal&threshold=10&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const data = (body as { data: Array<{ location_name: string }> }).data;
		expect(data.length).toBeGreaterThan(0);
		expect(data.every((deal) => deal.location_name === "Yasamal")).toBe(true);
	});

	test("seeded category and boolean filters narrow results", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&category=new&hasDocument=true&hasRepair=true&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{
					category: string;
					has_document: boolean;
					has_repair: boolean;
				}>;
			}
		).data;
		expect(data.length).toBeGreaterThan(0);
		expect(
			data.every(
				(deal) =>
					deal.category === "new" &&
					deal.has_document === true &&
					deal.has_repair === true,
			),
		).toBe(true);
	});

	test("seeded numeric filters return expected deal", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=Yasamal&threshold=0&minPrice=110000&maxPrice=130000&minRooms=3&maxRooms=3&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{ source_url: string; price: string; rooms: number }>;
			}
		).data;
		expect(data.map((deal) => deal.source_url)).toContain(
			"https://test.redeal.local/yasamal-deal",
		);
		expect(
			data.every(
				(deal) => Number(deal.price) >= 110000 && Number(deal.price) <= 130000,
			),
		).toBe(true);
	});

	test("seeded price per square meter and area filters narrow results", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=Yasamal&threshold=0&minPriceSqm=1450&maxPriceSqm=1550&minArea=75&maxArea=85&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{
					source_url: string;
					price_per_sqm: string;
					area_sqm: string;
				}>;
			}
		).data;
		expect(data.map((deal) => deal.source_url)).toContain(
			"https://test.redeal.local/yasamal-deal",
		);
		expect(
			data.every(
				(deal) =>
					Number(deal.price_per_sqm) >= 1450 &&
					Number(deal.price_per_sqm) <= 1550 &&
					Number(deal.area_sqm) >= 75 &&
					Number(deal.area_sqm) <= 85,
			),
		).toBe(true);
	});

	test("seeded floor filters narrow results", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=N%C9%99rimanov&threshold=0&minFloor=3&maxFloor=3&minTotalFloors=16&maxTotalFloors=16&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{
					source_url: string;
					floor: number;
					total_floors: number;
				}>;
			}
		).data;
		expect(data.map((deal) => deal.source_url)).toContain(
			"https://test.redeal.local/narimanov-deal",
		);
		expect(
			data.every((deal) => deal.floor === 3 && deal.total_floors === 16),
		).toBe(true);
	});

	test("seeded mortgage filters support true and false", async () => {
		if (skipIfNoSeed()) return;
		const mortgageTrue = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&hasMortgage=true&limit=20&offset=0",
		);
		const mortgageFalse = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&hasMortgage=false&limit=20&offset=0",
		);

		expect(mortgageTrue.res.status).toBe(200);
		expect(mortgageFalse.res.status).toBe(200);
		expect(
			(
				mortgageTrue.body as { data: Array<{ has_mortgage: boolean }> }
			).data.every((deal) => deal.has_mortgage === true),
		).toBe(true);
		expect(
			(
				mortgageFalse.body as { data: Array<{ has_mortgage: boolean }> }
			).data.every((deal) => deal.has_mortgage === false),
		).toBe(true);
	});

	test("seeded active mortgage, urgency, and not-last-floor filters narrow results", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&hasActiveMortgage=true&notLastFloor=true&limit=20&offset=0",
		);
		const inactiveMortgage = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&hasActiveMortgage=false&limit=20&offset=0",
		);
		const urgent = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&isUrgent=true&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		expect(inactiveMortgage.res.status).toBe(200);
		expect(urgent.res.status).toBe(200);
		const data = (
			body as {
				data: Array<{
					source_url: string;
					has_active_mortgage: boolean;
					floor: number;
					total_floors: number;
				}>;
			}
		).data;
		expect(data.map((deal) => deal.source_url)).toContain(
			"https://test.redeal.local/narimanov-deal",
		);
		expect(
			data.every(
				(deal) =>
					deal.has_active_mortgage === true && deal.floor < deal.total_floors,
			),
		).toBe(true);
		expect(
			(
				inactiveMortgage.body as {
					data: Array<{ has_active_mortgage: boolean }>;
				}
			).data.every((deal) => deal.has_active_mortgage === false),
		).toBe(true);
		expect(
			(urgent.body as { data: Array<{ is_urgent: boolean }> }).data.every(
				(deal) => deal.is_urgent === true,
			),
		).toBe(true);
	});

	test("seeded description search and multiple locations work", async () => {
		if (skipIfNoSeed()) return;
		const search = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&descriptionSearch=corner&limit=20&offset=0",
		);
		const seaView = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&descriptionSearch=sea%20view&limit=20&offset=0",
		);
		const multi = await getJson(
			"/api/deals/undervalued?location=Yasamal,N%C9%99rimanov&threshold=0&limit=20&offset=0",
		);

		expect(search.res.status).toBe(200);
		expect(seaView.res.status).toBe(200);
		expect(multi.res.status).toBe(200);
		const searchData = (
			search.body as { data: Array<{ description: string | null }> }
		).data;
		expect(searchData.length).toBeGreaterThan(0);
		expect(
			searchData.every((deal) =>
				deal.description?.toLowerCase().includes("corner"),
			),
		).toBe(true);
		expect(
			(seaView.body as { data: Array<{ source_url: string }> }).data.map(
				(deal) => deal.source_url,
			),
		).toContain("https://test.redeal.local/yasamal-null-fields");
		const locations = (
			multi.body as { data: Array<{ location_name: string }> }
		).data.map((deal) => deal.location_name);
		expect(locations).toContain("Yasamal");
		expect(locations).toContain("Nərimanov");
	});

	test("seeded pagination returns distinct pages", async () => {
		if (skipIfNoSeed()) return;
		const first = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&sort=price-asc&limit=1&offset=0",
		);
		const second = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&sort=price-asc&limit=1&offset=1",
		);

		expect(first.res.status).toBe(200);
		expect(second.res.status).toBe(200);
		const firstUrl = (first.body as { data: Array<{ source_url: string }> })
			.data[0]?.source_url;
		const secondUrl = (second.body as { data: Array<{ source_url: string }> })
			.data[0]?.source_url;
		expect(firstUrl).toBeString();
		expect(secondUrl).toBeString();
		expect(firstUrl).not.toBe(secondUrl);
	});

	test("undervalued deals reject invalid pagination and empty location", async () => {
		if (skipIfNoServer()) return;
		for (const query of [
			"limit=0",
			"limit=1001",
			"limit=abc",
			"offset=-1",
			"offset=abc",
		]) {
			const { res } = await getJson(
				`/api/deals/undervalued?location=__all__&${query}`,
			);
			expect(res.status).toBe(400);
		}

		const emptyLocation = await getJson("/api/deals/undervalued?location=");
		expect(emptyLocation.res.status).toBe(400);
	});

	test("seeded sort by price ascending is ordered", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/undervalued?location=__all__&threshold=0&sort=price-asc&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		const prices = (body as { data: Array<{ price: string }> }).data.map(
			(deal) => Number(deal.price),
		);
		expect(prices.length).toBeGreaterThan(1);
		expect(prices).toEqual([...prices].sort((a, b) => a - b));
	});

	test("seeded price drops returns price-history deal", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson(
			"/api/deals/price-drops?location=__all__&minDrops=1&limit=20&offset=0",
		);

		expect(res.status).toBe(200);
		expect(body).toMatchObject({ location: "__all__", minDropCount: 1 });
		const deal = (
			body as { data: Array<{ source_url: string; price_drop_count: number }> }
		).data.find(
			(deal) => deal.source_url === "https://test.redeal.local/yasamal-deal",
		);
		expect(deal).toBeDefined();
		expect(Number(deal?.price_drop_count)).toBeGreaterThanOrEqual(1);
	});

	test("price drops reject invalid minDrops", async () => {
		if (skipIfNoServer()) return;
		for (const minDrops of ["0", "abc"]) {
			const { res } = await getJson(
				`/api/deals/price-drops?location=__all__&minDrops=${minDrops}`,
			);
			expect(res.status).toBe(400);
		}
	});

	test("seeded heatmap returns location metrics", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson("/api/heatmap");

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{
					location_name: string;
					avg_price_per_sqm: number;
					count: number;
					lat: number;
					lng: number;
					trend: string;
				}>;
			}
		).data;
		expect(data.map((row) => row.location_name)).toEqual(
			expect.arrayContaining(["Yasamal", "Nərimanov"]),
		);
		expect(data.find((row) => row.location_name === "Yasamal")).toMatchObject({
			avg_price_per_sqm: 1875,
			count: 4,
		});
		expect(
			data.every(
				(row) =>
					typeof row.location_name === "string" &&
					typeof row.avg_price_per_sqm === "number" &&
					typeof row.count === "number" &&
					typeof row.lat === "number" &&
					typeof row.lng === "number" &&
					typeof row.trend === "string",
			),
		).toBe(true);
	});

	test("seeded trend returns weekly rows", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson("/api/deals/trend?location=Yasamal");

		expect(res.status).toBe(200);
		const data = (
			body as {
				data: Array<{ week: string; avg_ppsm: number; listing_count: number }>;
			}
		).data;
		expect(data.length).toBeGreaterThan(0);
		expect(
			data.every(
				(row) =>
					typeof row.week === "string" &&
					typeof row.avg_ppsm === "number" &&
					typeof row.listing_count === "number",
			),
		).toBe(true);
	});

	test("seeded map pins filter by threshold and location", async () => {
		if (skipIfNoSeed()) return;
		const all = await getJson(
			"/api/deals/map-pins?location=__all__&threshold=0",
		);
		const yasamal = await getJson(
			"/api/deals/map-pins?location=Yasamal&threshold=10",
		);

		expect(all.res.status).toBe(200);
		expect(yasamal.res.status).toBe(200);
		const allData = (all.body as { data: Array<{ lat: number; lng: number }> })
			.data;
		const yasamalData = (
			yasamal.body as {
				data: Array<{ location_name: string; discount_percent: number }>;
			}
		).data;
		expect(allData.length).toBeGreaterThan(0);
		expect(
			allData.every(
				(pin) => typeof pin.lat === "number" && typeof pin.lng === "number",
			),
		).toBe(true);
		expect(
			(all.body as { data: Array<{ source_url: string }> }).data.map(
				(pin) => pin.source_url,
			),
		).not.toContain("https://test.redeal.local/yasamal-null-fields");
		expect(
			yasamalData.every(
				(pin) => pin.location_name === "Yasamal" && pin.discount_percent >= 10,
			),
		).toBe(true);
	});

	test("seeded alerts can be created, listed, and deleted by owner", async () => {
		if (skipIfNoSeed()) return;
		const { res: createRes, body: created } = await postJson("/api/alerts", {
			chat_id: "987654321",
			label: "API test alert",
			filters: { location: "Yasamal", threshold: 10 },
		});
		expect(createRes.status).toBe(200);
		expect(typeof (created as { token: string }).token).toBe("string");

		const list = await getJson("/api/alerts?chat_id=987654321");
		expect(list.res.status).toBe(200);
		expect(
			(list.body as { alerts: Array<{ token: string }> }).alerts.some(
				(alert) => alert.token === (created as { token: string }).token,
			),
		).toBe(true);

		const token = (created as { token: string }).token;

		// foreign chat_id cannot delete another user's alert
		const foreignDelete = await authFetch(
			`${baseUrl}/api/alerts/${token}?chat_id=987654322`,
			{
				method: "DELETE",
			},
		);
		expect(foreignDelete.status).toBe(404);

		// owner can delete their own alert
		const ownerDelete = await authFetch(
			`${baseUrl}/api/alerts/${token}?chat_id=987654321`,
			{
				method: "DELETE",
			},
		);
		expect(ownerDelete.status).toBe(200);
	});

	test("alerts reject invalid requests", async () => {
		if (skipIfNoServer()) return;

		const invalidList = await getJson("/api/alerts?chat_id=abc");
		const invalidJson = await postJson("/api/alerts", "{");
		const invalidChat = await postJson("/api/alerts", {
			chat_id: "abc",
			filters: { location: "Yasamal" },
		});
		const missingFilters = await postJson("/api/alerts", {
			chat_id: "987654321",
		});
		const missingLocation = await postJson("/api/alerts", {
			chat_id: "987654321",
			filters: { threshold: 10 },
		});

		expect(invalidList.res.status).toBe(400);
		expect(invalidJson.res.status).toBe(400);
		expect(invalidChat.res.status).toBe(400);
		expect(missingFilters.res.status).toBe(400);
		expect(missingLocation.res.status).toBe(400);
	});

	test("seeded alert labels truncate and deleted alerts return 404", async () => {
		if (skipIfNoSeed()) return;
		const longLabel = "x".repeat(100);
		const { res: createRes, body: created } = await postJson("/api/alerts", {
			chat_id: "987654322",
			label: longLabel,
			filters: { location: "Yasamal", threshold: 10 },
		});
		expect(createRes.status).toBe(200);
		const token = (created as { token: string }).token;

		const list = await getJson("/api/alerts?chat_id=987654322");
		expect(list.res.status).toBe(200);
		const alert = (
			list.body as { alerts: Array<{ token: string; label: string }> }
		).alerts.find((item) => item.token === token);
		expect(alert?.label).toHaveLength(80);

		const firstDelete = await authFetch(
			`${baseUrl}/api/alerts/${token}?chat_id=987654322`,
			{ method: "DELETE" },
		);
		const secondDelete = await authFetch(
			`${baseUrl}/api/alerts/${token}?chat_id=987654322`,
			{ method: "DELETE" },
		);
		expect(firstDelete.status).toBe(200);
		expect(secondDelete.status).toBe(404);
	});

	test("manual scrape requires admin session", async () => {
		if (skipIfNoServer()) return;
		const { res } = await postJson("/api/scrape/run", {});
		expect([401, 503]).toContain(res.status);
	});

	test("manual scrape rejects legacy admin token header", async () => {
		if (skipIfNoServer()) return;
		const { res } = await postJson(
			"/api/scrape/run",
			{},
			{
				"x-scrape-admin-token": "test-token",
			},
		);
		expect([401, 503]).toContain(res.status);
	});

	test("scrape stream endpoint is removed", async () => {
		if (skipIfNoServer()) return;
		const { res } = await getJson("/api/scrape/stream?maxPages=1");
		expect(res.status).toBe(404);
	});

	test("scrape runs reject invalid limits", async () => {
		if (skipIfNoServer()) return;
		for (const limit of ["0", "101", "abc"]) {
			const { res } = await getJson(`/api/scrape/runs?limit=${limit}`);
			expect(res.status).toBe(400);
		}
	});

	test("seeded scrape runs returns latest run", async () => {
		if (skipIfNoSeed()) return;
		const { res, body } = await getJson("/api/scrape/runs?limit=20");

		expect(res.status).toBe(200);
		const runs = (
			body as {
				runs: Array<{ status: string; trigger: string; total_fetched: number }>;
			}
		).runs;
		expect(runs.length).toBeGreaterThan(0);
		expect(
			runs.some(
				(run) =>
					typeof run.status === "string" &&
					typeof run.trigger === "string" &&
					typeof run.total_fetched === "number",
			),
		).toBe(true);
	});

	test("telegram webhook accepts malformed and unknown updates", async () => {
		if (skipIfNoServer()) return;

		const malformed = await postJson("/api/telegram/webhook", "{");
		const withoutMessage = await postJson("/api/telegram/webhook", {
			update_id: 1,
		});
		const unknownMessage = await postJson("/api/telegram/webhook", {
			message: { chat: { id: 987654321 }, text: "hello" },
		});

		expect(malformed.res.status).toBe(200);
		expect(withoutMessage.res.status).toBe(200);
		expect(unknownMessage.res.status).toBe(200);
		expect(malformed.body).toMatchObject({ ok: true });
		expect(withoutMessage.body).toMatchObject({ ok: true });
		expect(unknownMessage.body).toMatchObject({ ok: true });
	});

	test("telegram webhook rejects wrong secret token", async () => {
		if (skipIfNoServer()) return;

		// Only meaningful when TELEGRAM_WEBHOOK_SECRET is set in the server env.
		// Without it the server accepts all requests, so we skip the assertion.
		if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
			console.warn(
				"Skipping webhook secret test: TELEGRAM_WEBHOOK_SECRET not set",
			);
			return;
		}

		const noSecret = await postJson("/api/telegram/webhook", { update_id: 1 });
		const wrongSecret = await fetch(`${baseUrl}/api/telegram/webhook`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "wrong-secret",
			},
			body: JSON.stringify({ update_id: 1 }),
		});

		expect(noSecret.res.status).toBe(401);
		expect(wrongSecret.status).toBe(401);
	});

	test("alerts delete requires matching chat_id", async () => {
		if (skipIfNoServer()) return;

		// missing chat_id → 400
		const noChatId = await authFetch(
			`${baseUrl}/api/alerts/nonexistent-token`,
			{
				method: "DELETE",
			},
		);
		expect(noChatId.status).toBe(400);

		// non-numeric chat_id → 400
		const badChatId = await authFetch(
			`${baseUrl}/api/alerts/nonexistent-token?chat_id=abc`,
			{
				method: "DELETE",
			},
		);
		expect(badChatId.status).toBe(400);
	});

	test("DELETE /api/deals/item permissions and functionality", async () => {
		if (skipIfNoServer()) return;

		const testItemUrl = "https://test.redeal.local/admin-delete-deal-item";

		// 1. Unauthenticated request returns 401
		const unauthRes = await fetch(`${baseUrl}/api/deals/item`, {
			method: "DELETE",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ url: testItemUrl }),
		});
		expect(unauthRes.status).toBe(401);

		// 2. Regular non-admin user returns 403
		const regularEmail = "reg-user-delete-test@redeal.local";
		await addWhitelistedEmail(regularEmail, "Regular User");
		const regularUser = await upsertGoogleUser({
			sub: "google-sub-regular-delete",
			email: regularEmail,
			name: "Regular User",
		});
		const regularSession = await createSession(regularUser.id);
		const regularCookie = `redeal_session=${regularSession.signedCookieValue}`;

		const regularRes = await fetch(`${baseUrl}/api/deals/item`, {
			method: "DELETE",
			headers: {
				"content-type": "application/json",
				cookie: regularCookie,
			},
			body: JSON.stringify({ url: testItemUrl }),
		});
		expect(regularRes.status).toBe(403);

		// 3. Admin user: create sample property in DB and delete it
		const adminEmail = "admin-delete-test@redeal.local";
		await addWhitelistedEmail(adminEmail, "Admin User");
		const adminUser = await upsertGoogleUser({
			sub: "google-sub-admin-delete",
			email: adminEmail,
			name: "Admin User",
		});
		await setAdminRole(adminEmail, true);
		const adminSession = await createSession(adminUser.id);
		const adminCookie = `redeal_session=${adminSession.signedCookieValue}`;

		// Insert property to delete
		await prisma.property.deleteMany({ where: { source_url: testItemUrl } });
		await prisma.property.create({
			data: {
				source_url: testItemUrl,
				price: 150000,
				area_sqm: 100,
				price_per_sqm: 1500,
				district: "Yasamal",
				location_name: "Yasamal",
				category: "new",
				listing_type: "sale",
			},
		});

		// Admin deletes property
		const adminDeleteRes = await fetch(`${baseUrl}/api/deals/item`, {
			method: "DELETE",
			headers: {
				"content-type": "application/json",
				cookie: adminCookie,
			},
			body: JSON.stringify({ url: testItemUrl }),
		});
		expect(adminDeleteRes.status).toBe(200);
		const body = (await adminDeleteRes.json()) as { ok: boolean; deleted: number };
		expect(body.ok).toBe(true);
		expect(body.deleted).toBe(1);

		// Verify it no longer exists
		const exists = await prisma.property.findUnique({
			where: { source_url: testItemUrl },
		});
		expect(exists).toBeNull();

		// Deleting already deleted item returns 404
		const notFoundRes = await fetch(`${baseUrl}/api/deals/item`, {
			method: "DELETE",
			headers: {
				"content-type": "application/json",
				cookie: adminCookie,
			},
			body: JSON.stringify({ url: testItemUrl }),
		});
		expect(notFoundRes.status).toBe(404);

		// Clean up
		await prisma.whitelistedEmail.deleteMany({
			where: { email: { in: [regularEmail, adminEmail] } },
		});
		await prisma.user.deleteMany({
			where: { email: { in: [regularEmail, adminEmail] } },
		});
	});
});

describe("XSS escaping — formatListing", () => {
	const base = {
		source_url: "https://bina.az/1",
		price: 100000,
		area_sqm: 80,
		price_per_sqm: 1250,
		district: "Nasimi",
		rooms: 3,
		floor: 5,
		total_floors: 10,
		has_document: true,
		has_repair: false,
		is_urgent: false,
		discount_percent: 15,
		location_avg_price_per_sqm: 1470,
	};

	test("escapes < > & in location_name", () => {
		const result = formatListing({
			...base,
			location_name: "<script>alert(1)</script>",
		});
		expect(result).not.toContain("<script>");
		expect(result).toContain("&lt;script&gt;");
	});

	test("escapes & in location_name", () => {
		const result = formatListing({ ...base, location_name: "Baku & Beyond" });
		expect(result).toContain("Baku &amp; Beyond");
		expect(result).not.toMatch(/Baku & Beyond/);
	});

	test("falls back to district and escapes it", () => {
		const result = formatListing({
			...base,
			location_name: null,
			district: "<Evil>",
		});
		expect(result).not.toContain("<Evil>");
		expect(result).toContain("&lt;Evil&gt;");
	});
});
