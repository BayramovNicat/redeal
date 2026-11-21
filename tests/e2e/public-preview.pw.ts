import { expect, test } from "@playwright/test";
import { deal, heatmapData, trendData } from "./fixtures";

async function mockGuestApi(
	page: import("@playwright/test").Page,
	opts: { total?: number; searchUrls?: string[] } = {},
) {
	await page.route("**/api/auth/me", async (route) => {
		await route.fulfill({
			json: { ok: true, authenticated: false, user: null },
		});
	});
	await page.route("https://*.basemaps.cartocdn.com/**", async (route) => {
		await route.fulfill({ status: 204, body: "" });
	});
	await page.route("https://mt*.google.com/**", async (route) => {
		await route.fulfill({ status: 204, body: "" });
	});
	await page.route("**/api/deals/locations", async (route) => {
		await route.fulfill({
			json: { data: ["baki/yasamal", "baki/nerimanov"] },
		});
	});
	await page.route("**/api/deals/trend**", async (route) => {
		await route.fulfill({
			json: { location: "baki/yasamal", data: trendData },
		});
	});
	await page.route("**/api/deals/undervalued**", async (route) => {
		opts.searchUrls?.push(route.request().url());
		await route.fulfill({
			json: {
				location: new URL(route.request().url()).searchParams.get("location"),
				threshold_pct: 10,
				limit: 50,
				offset: 0,
				count: 1,
				total: opts.total ?? 120,
				preview: true,
				preview_limit: 50,
				data: [deal],
			},
		});
	});
	await page.route("**/api/heatmap", async (route) => {
		await route.fulfill({
			json: { data: heatmapData },
		});
	});
	await page.route("**/health", async (route) => {
		await route.fulfill({
			json: {
				status: "ok",
				timestamp: new Date().toISOString(),
				properties: 120,
			},
		});
	});
}

test("guest can browse unfiltered preview, inspect details and stats, and sees preview limit card", async ({
	page,
}) => {
	const searchUrls: string[] = [];
	await mockGuestApi(page, { total: 120, searchUrls });

	await page.goto("/");

	// Homepage renders unfiltered feed without redirect to /login
	expect(new URL(page.url()).pathname).toBe("/");
	await expect(page.locator(".product-card")).toHaveCount(1);
	await expect(page.locator("#header-signin-btn")).toBeVisible();
	await expect(page.locator("#guest-preview-banner")).toBeVisible();
	await expect(page.locator("#guest-preview-limit-card")).toBeVisible();

	// Only unfiltered default query was sent
	expect(searchUrls).toHaveLength(1);
	const initialParams = new URL(searchUrls[0]).searchParams;
	expect(initialParams.get("location")).toBe("__all__");
	expect(initialParams.get("threshold")).toBe("10");

	// Guest can open Advanced Filters drawer to inspect available filters
	await page.getByRole("button", { name: /advanced filters/i }).click();
	await expect(page.locator("#minPrice")).toBeVisible();

	// Guest can open District Stats modal
	await page.getByRole("button", { name: /stats/i }).click();
	await expect(page.locator("#district-stats-modal")).toBeVisible();
	await expect(
		page.locator("#district-stats-modal").getByText("Yasamal"),
	).toBeVisible();
	await page.keyboard.press("Escape");

	// Guest can open Property Detail modal
	await page.locator(".product-card").first().click();
	await expect(page.locator("dialog[open]")).toBeVisible();
});

test("guest can filter by location freely, while advanced filters, sort, and alerts prompt login", async ({
	page,
}) => {
	const searchUrls: string[] = [];
	await mockGuestApi(page, { total: 120, searchUrls });

	await page.goto("/");
	await expect(page.locator(".product-card")).toHaveCount(1);

	const loginModal = page.locator("#login-required-modal");

	// 1. Selecting a district & adjusting discount threshold work publicly without login modal
	await page.locator("#loc-trigger").click();
	await page.locator('[role="option"][data-value="baki/yasamal"]').click();
	await expect
		.poll(() =>
			searchUrls.some(
				(u) => new URL(u).searchParams.get("location") === "baki/yasamal",
			),
		)
		.toBe(true);
	await page.locator("#discount-threshold").fill("25");
	await expect
		.poll(() =>
			searchUrls.some((u) => new URL(u).searchParams.get("threshold") === "25"),
		)
		.toBe(true);
	await expect(loginModal).toBeHidden();

	const countBeforeGated = searchUrls.length;

	// 2. Toggling a boolean filter chip opens login modal and keeps chip unchecked
	await page.locator("label:has(#hasRepair)").click();
	await expect(loginModal).toBeVisible();
	await expect(page.locator("#hasRepair")).not.toBeChecked();
	await page.keyboard.press("Escape");

	// 3. Changing sort opens login modal and reverts sort to disc
	await page.locator('select[name="sort-by"]').selectOption("price-asc");
	await expect(loginModal).toBeVisible();
	await expect(page.locator('select[name="sort-by"]')).toHaveValue("disc");
	await page.keyboard.press("Escape");

	// 4. Clicking Alert me opens login modal
	await page.getByRole("button", { name: /alert me/i }).click();
	await expect(loginModal).toBeVisible();
	await page.keyboard.press("Escape");

	// No gated filter search request was ever fired
	expect(searchUrls).toHaveLength(countBeforeGated);
});

test("guest landing on a location+filter URL loads that location preview and prompts login with returnTo", async ({
	page,
}) => {
	const searchUrls: string[] = [];
	await mockGuestApi(page, { total: 120, searchUrls });

	await page.goto("/?location=baki/yasamal&minPrice=50000");

	await expect(page.locator(".product-card")).toHaveCount(1);
	const loginModal = page.locator("#login-required-modal");
	await expect(loginModal).toBeVisible();
	await expect(
		loginModal.locator(
			'a[href="/api/auth/google?returnTo=%2F%3Flocation%3Dbaki%2Fyasamal%26minPrice%3D50000"]',
		),
	).toBeVisible();

	// Background request kept the public location but stripped gated minPrice
	expect(searchUrls).toHaveLength(1);
	expect(new URL(searchUrls[0]).searchParams.get("location")).toBe(
		"baki/yasamal",
	);
	expect(new URL(searchUrls[0]).searchParams.get("minPrice")).toBeNull();
});
