import type { DealSort, PropertyFilters } from "@/types/index.js";
import { readJsonBody } from "@/utils/json-body.js";
import { parseQueryBool, parseQueryNum } from "@/utils/query.js";
import { ResponseHelper } from "@/utils/response.js";
import * as dealsService from "./deals.service.js";
import { prisma } from "@/utils/prisma.js";
import {
	checkAndDeleteEndedListing,
	checkAndDeleteEndedListings,
} from "./listing-status.service.js";

export async function deleteDeal(req: Request): Promise<Response> {
	try {
		const body = await readJsonBody<{ url?: string; id?: string | number }>(req);
		if (!body.ok) {
			return ResponseHelper.error(
				body.status === 413 ? "Payload too large" : "Invalid JSON",
				body.status,
			);
		}
		const url = body.data?.url?.trim();
		const rawId = body.data?.id;
		const idNum =
			rawId !== undefined && rawId !== null && !Number.isNaN(Number(rawId))
				? Number(rawId)
				: undefined;

		if (!url && idNum === undefined) {
			return ResponseHelper.error('A valid "url" or numeric "id" is required', 400);
		}

		const where = url ? { source_url: url } : { id: idNum };
		const result = await prisma.property.deleteMany({
			where,
		});

		if (result.count === 0) {
			return ResponseHelper.error("Property not found", 404);
		}

		return ResponseHelper.publicJson({ ok: true, deleted: result.count }, 0, 0);
	} catch (err) {
		console.error("[DealsController] deleteDeal:", err);
		return ResponseHelper.error("Failed to delete deal", 500);
	}
}

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
		return ResponseHelper.publicJson({ data }, 60, 30);
	} catch (err) {
		console.error("[DealsController] getLocations:", err);
		return ResponseHelper.error("Failed to fetch locations");
	}
}

export async function getTrend(req: Request): Promise<Response> {
	const location = new URL(req.url).searchParams.get("location");
	if (!location) {
		return ResponseHelper.error('Query parameter "location" is required', 400);
	}
	const cached = trendCache.get(location);
	if (cached && Date.now() - cached.cachedAt < TREND_TTL_MS) {
		return ResponseHelper.publicJson(
			{ location, data: cached.data },
			1800,
			300,
		);
	}
	try {
		const data = await dealsService.getPriceTrend(location);
		if (trendCache.size >= TREND_CACHE_MAX) {
			const oldest = trendCache.keys().next().value;
			if (oldest !== undefined) trendCache.delete(oldest);
		}
		trendCache.set(location, { data, cachedAt: Date.now() });
		return ResponseHelper.publicJson({ location, data }, 1800, 300);
	} catch (err) {
		console.error("[DealsController] getTrend:", err);
		return ResponseHelper.error("Failed to fetch trend data");
	}
}

export async function getHeatmap(): Promise<Response> {
	try {
		const data = await dealsService.getHeatmapData();
		return ResponseHelper.publicJson({ data }, 900, 300);
	} catch (err) {
		console.error("[DealsController] getHeatmap:", err);
		return ResponseHelper.error("Failed to fetch heatmap data");
	}
}

export async function getDealsByUrls(req: Request): Promise<Response> {
	const parsed = await readJsonBody<{ urls?: unknown }>(req);
	if (!parsed.ok) {
		return ResponseHelper.error(
			parsed.status === 413 ? "JSON body too large" : "Invalid JSON body",
			parsed.status,
		);
	}
	const urls = parsed.data?.urls;
	if (!Array.isArray(urls) || urls.length === 0) {
		return ResponseHelper.error('"urls" must be a non-empty array', 400);
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
		return ResponseHelper.publicJson({ data: [] });
	}
	try {
		const data = await dealsService.getPropertiesByUrls(safeUrls);
		return ResponseHelper.publicJson({ data });
	} catch (err) {
		console.error("[DealsController] getDealsByUrls:", err);
		return ResponseHelper.error("Failed to fetch properties");
	}
}

type JsonReviewItem = Record<string, unknown> & { item_id?: unknown };

export async function getDealsByJsonItems(req: Request): Promise<Response> {
	const parsed = await readJsonBody<{ items?: unknown }>(req);
	if (!parsed.ok) {
		return ResponseHelper.error(
			parsed.status === 413 ? "JSON body too large" : "Invalid JSON body",
			parsed.status,
		);
	}

	const items = parsed.data?.items;
	if (!Array.isArray(items) || items.length === 0) {
		return ResponseHelper.error('"items" must be a non-empty array', 400);
	}

	const safeItems = items
		.filter((item): item is JsonReviewItem => {
			if (!item || typeof item !== "object") return false;
			const rawId = (item as JsonReviewItem).item_id;
			return typeof rawId === "string" || typeof rawId === "number";
		})
		.map((item) => ({ ...item, item_id: String(item.item_id).trim() }))
		.filter((item) => /^\d+$/.test(item.item_id))
		.slice(0, 200);

	if (safeItems.length === 0) {
		return ResponseHelper.error(
			'Each item must include a numeric "item_id"',
			400,
		);
	}

	const itemIds = Array.from(new Set(safeItems.map((item) => item.item_id)));

	try {
		const urls = itemIds.map((id) => `https://bina.az/items/${id}`);
		const properties = await dealsService.getPropertiesByUrls(urls);
		const byItemId = new Map(
			properties.map((property) => [
				property.source_url.match(/\/items\/(\d+)/)?.[1] ?? "",
				property,
			]),
		);
		const data = safeItems.map((item) => ({
			item,
			property: byItemId.get(item.item_id) ?? null,
		}));

		return ResponseHelper.publicJson({
			count: data.length,
			matched: data.filter((entry) => entry.property).length,
			missing: safeItems
				.filter((item) => !byItemId.has(item.item_id))
				.map((item) => item.item_id),
			data,
		});
	} catch (err) {
		console.error("[DealsController] getDealsByJsonItems:", err);
		return ResponseHelper.error("Failed to fetch JSON review properties");
	}
}

export async function checkEndedListing(req: Request): Promise<Response> {
	const parsed = await readJsonBody<{ url?: unknown }>(req);
	if (!parsed.ok) {
		return ResponseHelper.error(
			parsed.status === 413 ? "JSON body too large" : "Invalid JSON body",
			parsed.status,
		);
	}

	const url = parsed.data?.url;
	if (typeof url !== "string" || url.trim().length === 0) {
		return ResponseHelper.error('"url" must be a non-empty string', 400);
	}

	try {
		const data = await checkAndDeleteEndedListing(url.trim());
		return ResponseHelper.publicJson(data, 0, 0);
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes("Only bina.az")) {
			return ResponseHelper.error(message, 400);
		}
		console.error("[DealsController] checkEndedListing:", err);
		return ResponseHelper.error("Failed to check listing status");
	}
}

export async function validateUndervaluedDeals(
	req: Request,
): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return ResponseHelper.error(
			'"threshold" must be a number between 0 and 100',
			400,
		);
	}

	const sort = parseDealSort(q);
	if (sort.error) return sort.error;

	let filterArgs: PropertyFilters;
	try {
		filterArgs = parsePropertyFilters(q);
	} catch (err) {
		return ResponseHelper.error((err as Error).message, 400);
	}

	try {
		const locations = loc.isAll ? "__all__" : loc.list;
		const tier = q.get("tier") ?? undefined;
		const urlTiers = await dealsService.getUndervaluedUrlTiers(
			locations,
			thresholdPct,
			filterArgs,
		);
		const urls = urlTiers
			.filter((property) => !tier || property.tier === tier)
			.map((property) => property.source_url);
		const validation = await checkAndDeleteEndedListings(urls);
		const { total, data } = await dealsService.getUndervalued(
			locations,
			thresholdPct,
			filterArgs,
			{ limit: 1000, offset: 0, sort: sort.value },
		);

		return ResponseHelper.publicJson({
			location: loc.raw,
			threshold_pct: thresholdPct,
			limit: 1000,
			offset: 0,
			count: data.length,
			total,
			validation,
			data,
		});
	} catch (err) {
		console.error("[DealsController] validateUndervaluedDeals:", err);
		return ResponseHelper.error("Failed to validate listings");
	}
}

export async function getMapPins(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return ResponseHelper.error(
			'"threshold" must be a number between 0 and 100',
			400,
		);
	}

	let filters: PropertyFilters;
	try {
		filters = parsePropertyFilters(q);
	} catch (err) {
		return ResponseHelper.error((err as Error).message, 400);
	}

	try {
		const data = await dealsService.getMapPins({
			locations: loc.isAll ? "__all__" : loc.list,
			thresholdPercent: thresholdPct,
			filters,
		});
		return ResponseHelper.publicJson({ count: data.length, data });
	} catch (err) {
		console.error("[DealsController] getMapPins:", err);
		return ResponseHelper.error("Failed to fetch map pins");
	}
}

export async function getPriceDrops(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const minDropsRaw = q.get("minDrops");
	const minDropCount = minDropsRaw !== null ? Number(minDropsRaw) : 1;
	if (!Number.isInteger(minDropCount) || minDropCount < 1) {
		return ResponseHelper.error('"minDrops" must be a positive integer', 400);
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
		return ResponseHelper.publicJson({
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
		return ResponseHelper.error("Failed to fetch price drop listings");
	}
}

export async function getUndervaluedDeals(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;

	const loc = parseLocationParams(q);
	if (loc.error) return loc.error;

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return ResponseHelper.error(
			'"threshold" must be a number between 0 and 100',
			400,
		);
	}

	const pg = parsePaginationParams(q);
	if (pg.error) return pg.error;
	const sort = parseDealSort(q);
	if (sort.error) return sort.error;

	let filterArgs: PropertyFilters;
	try {
		filterArgs = parsePropertyFilters(q);
	} catch (err) {
		return ResponseHelper.error((err as Error).message, 400);
	}

	const pageArgs = { limit: pg.limit, offset: pg.offset, sort: sort.value };

	try {
		const { total, data } = await dealsService.getUndervalued(
			loc.isAll ? "__all__" : loc.list,
			thresholdPct,
			filterArgs,
			pageArgs,
		);
		return ResponseHelper.publicJson({
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
		return ResponseHelper.error("Failed to fetch undervalued listings");
	}
}

// --- Query Parsing Helpers ---

function parseLocationParams(q: URLSearchParams) {
	const param = q.get("location");
	if (!param) {
		return {
			error: ResponseHelper.error(
				'Query parameter "location" is required',
				400,
			),
		};
	}

	const isAll = param === "__all__";
	const list = isAll ? [] : param.split(",").filter(Boolean);

	if (!isAll && list.length === 0) {
		return {
			error: ResponseHelper.error(
				'Query parameter "location" cannot be empty',
				400,
			),
		};
	}

	return { isAll, list, raw: param };
}

function parsePropertyFilters(q: URLSearchParams): PropertyFilters {
	const minPrice = parseQueryNum(q.get("minPrice"));
	const maxPrice = parseQueryNum(q.get("maxPrice"));
	const minPriceSqm = parseQueryNum(q.get("minPriceSqm"));
	const maxPriceSqm = parseQueryNum(q.get("maxPriceSqm"));
	const minArea = parseQueryNum(q.get("minArea"));
	const maxArea = parseQueryNum(q.get("maxArea"));
	const minRooms = parseQueryNum(q.get("minRooms"));
	const maxRooms = parseQueryNum(q.get("maxRooms"));
	const minFloor = parseQueryNum(q.get("minFloor"));
	const maxFloor = parseQueryNum(q.get("maxFloor"));
	const minTotalFloors = parseQueryNum(q.get("minTotalFloors"));
	const maxTotalFloors = parseQueryNum(q.get("maxTotalFloors"));

	if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
		throw new Error('"minPrice" cannot be greater than "maxPrice"');
	}
	if (
		minPriceSqm !== undefined &&
		maxPriceSqm !== undefined &&
		minPriceSqm > maxPriceSqm
	) {
		throw new Error('"minPriceSqm" cannot be greater than "maxPriceSqm"');
	}
	if (minArea !== undefined && maxArea !== undefined && minArea > maxArea) {
		throw new Error('"minArea" cannot be greater than "maxArea"');
	}
	if (minRooms !== undefined && maxRooms !== undefined && minRooms > maxRooms) {
		throw new Error('"minRooms" cannot be greater than "maxRooms"');
	}
	if (minFloor !== undefined && maxFloor !== undefined && minFloor > maxFloor) {
		throw new Error('"minFloor" cannot be greater than "maxFloor"');
	}
	if (
		minTotalFloors !== undefined &&
		maxTotalFloors !== undefined &&
		minTotalFloors > maxTotalFloors
	) {
		throw new Error('"minTotalFloors" cannot be greater than "maxTotalFloors"');
	}

	return {
		minPrice,
		maxPrice,
		minPriceSqm,
		maxPriceSqm,
		minArea,
		maxArea,
		minRooms,
		maxRooms,
		minFloor,
		maxFloor,
		minTotalFloors,
		maxTotalFloors,
		hasDocument: parseQueryBool(q.get("hasDocument")),
		hasMortgage: parseQueryBool(q.get("hasMortgage")),
		hasRepair: parseQueryBool(q.get("hasRepair")),
		isUrgent: parseQueryBool(q.get("isUrgent")),
		notLastFloor: parseQueryBool(q.get("notLastFloor")),
		hasActiveMortgage: parseQueryBool(q.get("hasActiveMortgage")),
		category: q.get("category") ?? undefined,
		listingType: q.get("listingType") === "rent" ? "rent" : "sale",
		descriptionSearch: q.get("descriptionSearch") ?? undefined,
	};
}

const DEAL_SORTS = new Set<DealSort>([
	"disc",
	"drops",
	"new",
	"price-asc",
	"price-desc",
	"area",
	"ppsm",
]);

function parseDealSort(q: URLSearchParams) {
	const raw = q.get("sort") ?? "disc";
	if (!DEAL_SORTS.has(raw as DealSort)) {
		return {
			error: ResponseHelper.error('"sort" must be a valid deal sort', 400),
		};
	}
	return { value: raw as DealSort };
}

function parsePaginationParams(q: URLSearchParams, defaultLimit = 200) {
	const limitRaw = q.get("limit");
	const limit = limitRaw !== null ? Number(limitRaw) : defaultLimit;
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return {
			error: ResponseHelper.error(
				'"limit" must be an integer between 1 and 1000',
				400,
			),
		};
	}

	const offsetRaw = q.get("offset");
	const offset = offsetRaw !== null ? Number(offsetRaw) : 0;
	if (!Number.isInteger(offset) || offset < 0) {
		return {
			error: ResponseHelper.error(
				'"offset" must be a non-negative integer',
				400,
			),
		};
	}

	return { limit, offset };
}
