import type { PropertyFilters } from "@/types/index.js";
import { parseQueryBool, parseQueryNum } from "@/utils/query.js";
import * as res from "@/utils/response.js";
import * as dealsService from "./deals.service.js";

type TrendCacheEntry = {
	data: Awaited<ReturnType<typeof dealsService.getPriceTrend>>;
	cachedAt: number;
};
const trendCache = new Map<string, TrendCacheEntry>();
const TREND_TTL_MS = 30 * 60_000;
const TREND_CACHE_MAX = 300;

export async function getLocations(): Promise<Response> {
	try {
		const data = await dealsService.getLocations();
		return res.json({ data }, 60, 30);
	} catch (err) {
		console.error("[DealsController] getLocations:", err);
		return res.error("Failed to fetch locations");
	}
}

export async function getTrend(req: Request): Promise<Response> {
	const location = new URL(req.url).searchParams.get("location");
	if (!location) {
		return res.error('Query parameter "location" is required', 400);
	}
	const cached = trendCache.get(location);
	if (cached && Date.now() - cached.cachedAt < TREND_TTL_MS) {
		return res.json({ location, data: cached.data }, 1800, 300);
	}
	try {
		const data = await dealsService.getPriceTrend(location);
		if (trendCache.size >= TREND_CACHE_MAX) {
			const oldest = trendCache.keys().next().value;
			if (oldest !== undefined) trendCache.delete(oldest);
		}
		trendCache.set(location, { data, cachedAt: Date.now() });
		return res.json({ location, data }, 1800, 300);
	} catch (err) {
		console.error("[DealsController] getTrend:", err);
		return res.error("Failed to fetch trend data");
	}
}

export async function getHeatmap(): Promise<Response> {
	try {
		const data = await dealsService.getHeatmapData();
		return res.json({ data }, 900, 300);
	} catch (err) {
		console.error("[DealsController] getHeatmap:", err);
		return res.error("Failed to fetch heatmap data");
	}
}

export async function getDealsByUrls(req: Request): Promise<Response> {
	let body: { urls?: unknown } = {};
	try {
		body = (await req.json()) as { urls?: unknown };
	} catch {
		return res.error("Invalid JSON body", 400);
	}
	const urls = body?.urls;
	if (!Array.isArray(urls) || urls.length === 0) {
		return res.error('"urls" must be a non-empty array', 400);
	}
	const safeUrls = Array.from(
		new Set(
			urls
				.filter(
					(u): u is string => typeof u === "string" && u.trim().length > 0,
				)
				.map((u) => u.trim()),
		),
	).slice(0, 500);
	if (safeUrls.length === 0) {
		return res.json({ data: [] });
	}
	try {
		const data = await dealsService.getPropertiesByUrls(safeUrls);
		return res.json({ data });
	} catch (err) {
		console.error("[DealsController] getDealsByUrls:", err);
		return res.error("Failed to fetch properties");
	}
}

export async function getMapPins(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return res.error('"threshold" must be a number between 0 and 100', 400);
	}

	const filters = parsePropertyFilters(q);

	try {
		const data = await dealsService.getMapPins({
			locations: loc.isAll ? "__all__" : loc.list,
			thresholdPercent: thresholdPct,
			filters,
		});
		return res.json({ count: data.length, data });
	} catch (err) {
		console.error("[DealsController] getMapPins:", err);
		return res.error("Failed to fetch map pins");
	}
}

export async function getPriceDrops(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const minDropsRaw = q.get("minDrops");
	const minDropCount = minDropsRaw !== null ? Number(minDropsRaw) : 1;
	if (!Number.isInteger(minDropCount) || minDropCount < 1) {
		return res.error('"minDrops" must be a positive integer', 400);
	}

	const pg = parsePaginationParams(q);
	if (pg.error) return pg.error;

	try {
		const { total, data } = await dealsService.getPriceDropDeals(
			loc.isAll ? "__all__" : loc.list,
			{
				minDropCount,
				limit: pg.limit,
				offset: pg.offset,
			},
		);
		return res.json({
			location: loc.raw,
			minDropCount,
			limit: pg.limit,
			offset: pg.offset,
			count: data.length,
			total,
			data,
		});
	} catch (err) {
		console.error("[DealsController] getPriceDrops:", err);
		return res.error("Failed to fetch price drop listings");
	}
}

export async function getUndervaluedDeals(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return res.error('"threshold" must be a number between 0 and 100', 400);
	}

	const pg = parsePaginationParams(q);
	if (pg.error) return pg.error;

	const filterArgs = parsePropertyFilters(q);
	const pageArgs = { limit: pg.limit, offset: pg.offset };

	try {
		const { total, data } = loc.isAll
			? await dealsService.getUndervaluedAll(thresholdPct, filterArgs, pageArgs)
			: await dealsService.getUndervaluedByLocation(
					loc.list,
					thresholdPct,
					filterArgs,
					pageArgs,
				);
		return res.json({
			location: loc.raw,
			threshold_pct: thresholdPct,
			limit: pg.limit,
			offset: pg.offset,
			count: data.length,
			total,
			data,
		});
	} catch (err) {
		console.error("[DealsController] getUndervaluedDeals:", err);
		return res.error("Failed to fetch undervalued listings");
	}
}

// --- Query Parsing Helpers ---

function parseLocationParams(q: URLSearchParams) {
	const param = q.get("location");
	if (!param) {
		return { error: res.error('Query parameter "location" is required', 400) };
	}

	const isAll = param === "__all__";
	const list = isAll ? [] : param.split(",").filter(Boolean);

	if (!isAll && list.length === 0) {
		return {
			error: res.error('Query parameter "location" cannot be empty', 400),
		};
	}

	return { isAll, list, raw: param };
}

function parsePropertyFilters(q: URLSearchParams): PropertyFilters {
	return {
		minPrice: parseQueryNum(q.get("minPrice")),
		maxPrice: parseQueryNum(q.get("maxPrice")),
		minPriceSqm: parseQueryNum(q.get("minPriceSqm")),
		maxPriceSqm: parseQueryNum(q.get("maxPriceSqm")),
		minArea: parseQueryNum(q.get("minArea")),
		maxArea: parseQueryNum(q.get("maxArea")),
		minRooms: parseQueryNum(q.get("minRooms")),
		maxRooms: parseQueryNum(q.get("maxRooms")),
		minFloor: parseQueryNum(q.get("minFloor")),
		maxFloor: parseQueryNum(q.get("maxFloor")),
		minTotalFloors: parseQueryNum(q.get("minTotalFloors")),
		maxTotalFloors: parseQueryNum(q.get("maxTotalFloors")),
		hasDocument: parseQueryBool(q.get("hasDocument")),
		hasMortgage: parseQueryBool(q.get("hasMortgage")),
		hasRepair: parseQueryBool(q.get("hasRepair")),
		isUrgent: parseQueryBool(q.get("isUrgent")),
		notLastFloor: parseQueryBool(q.get("notLastFloor")),
		hasActiveMortgage: parseQueryBool(q.get("hasActiveMortgage")),
		category: q.get("category") ?? undefined,
	};
}

function parsePaginationParams(q: URLSearchParams, defaultLimit = 200) {
	const limitRaw = q.get("limit");
	const limit = limitRaw !== null ? Number(limitRaw) : defaultLimit;
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return {
			error: res.error('"limit" must be an integer between 1 and 1000', 400),
		};
	}

	const offsetRaw = q.get("offset");
	const offset = offsetRaw !== null ? Number(offsetRaw) : 0;
	if (!Number.isInteger(offset) || offset < 0) {
		return {
			error: res.error('"offset" must be a non-negative integer', 400),
		};
	}

	return { limit, offset };
}
