import { Prisma } from "@prisma/client";
import {
	AnalyticsService,
	classifyDeal,
} from "../services/analytics.service.js";
import { queryRaw } from "../utils/prisma.js";

const analytics = new AnalyticsService();

type TrendCacheEntry = {
	data: Awaited<ReturnType<typeof analytics.getPriceTrend>>;
	cachedAt: number;
};
const trendCache = new Map<string, TrendCacheEntry>();
const TREND_TTL_MS = 30 * 60_000; // 30 min — data changes only on scrape cycles

/** GET /api/deals/locations — distinct location names that have at least one listing */
export async function getLocations(_req: Request): Promise<Response> {
	try {
		const rows = await queryRaw<{ location_name: string }[]> /*sql*/`
      SELECT DISTINCT location_name
      FROM "Property"
      WHERE location_name IS NOT NULL
      ORDER BY location_name ASC
    `;
		const data = rows.map((r) => r.location_name);
		return Response.json(
			{ data },
			{
				headers: {
					"Cache-Control": "public, max-age=60, stale-while-revalidate=30",
				},
			},
		);
	} catch (err) {
		console.error("[DealsController] getLocations:", err);
		return Response.json(
			{ error: "Failed to fetch locations" },
			{ status: 500 },
		);
	}
}

/** GET /api/deals/trend?location=X — weekly avg ₼/m² for the sparkline */
export async function getTrend(req: Request): Promise<Response> {
	const location = new URL(req.url).searchParams.get("location");
	if (!location) {
		return Response.json(
			{ error: 'Query parameter "location" is required' },
			{ status: 400 },
		);
	}
	const cached = trendCache.get(location);
	if (cached && Date.now() - cached.cachedAt < TREND_TTL_MS) {
		return Response.json(
			{ location, data: cached.data },
			{
				headers: {
					"Cache-Control": "public, max-age=1800, stale-while-revalidate=300",
				},
			},
		);
	}
	try {
		const data = await analytics.getPriceTrend(location);
		trendCache.set(location, { data, cachedAt: Date.now() });
		return Response.json(
			{ location, data },
			{
				headers: {
					"Cache-Control": "public, max-age=1800, stale-while-revalidate=300",
				},
			},
		);
	} catch (err) {
		console.error("[DealsController] getTrend:", err);
		return Response.json(
			{ error: "Failed to fetch trend data" },
			{ status: 500 },
		);
	}
}

/** GET /api/heatmap — avg price_per_sqm + listing count + trend per location_name */
export async function getHeatmap(_req: Request): Promise<Response> {
	try {
		const rows = await queryRaw<
			{
				location_name: string;
				avg_ppsm: number;
				count: bigint;
				lat: number;
				lng: number;
				recent_avg: number | null;
				prior_avg: number | null;
			}[]
		> /*sql*/`
      SELECT
        location_name,
        ROUND(AVG(price_per_sqm))::int AS avg_ppsm,
        COUNT(*)::bigint AS count,
        AVG(latitude)::float8 AS lat,
        AVG(longitude)::float8 AS lng,
        ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '4 weeks'
                       THEN price_per_sqm END))::int AS recent_avg,
        ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '8 weeks'
                        AND COALESCE(posted_date, created_at) <  NOW() - INTERVAL '4 weeks'
                       THEN price_per_sqm END))::int AS prior_avg
      FROM "Property"
      WHERE location_name IS NOT NULL
        AND price_per_sqm > 0
        AND NOT (floor = 1 AND total_floors IS NOT NULL)
        AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      GROUP BY location_name
      HAVING COUNT(*) >= 3
      ORDER BY avg_ppsm DESC
    `;
		const data = rows.map((r) => {
			const recent = r.recent_avg !== null ? Number(r.recent_avg) : null;
			const prior = r.prior_avg !== null ? Number(r.prior_avg) : null;
			let trend: "up" | "down" | "flat" = "flat";
			if (recent !== null && prior !== null && prior > 0) {
				const change = (recent - prior) / prior;
				if (change > 0.02) trend = "up";
				else if (change < -0.02) trend = "down";
			}
			return {
				location_name: r.location_name,
				avg_price_per_sqm: Number(r.avg_ppsm),
				count: Number(r.count),
				lat: Number(r.lat),
				lng: Number(r.lng),
				recent_avg: recent,
				prior_avg: prior,
				trend,
			};
		});
		return Response.json(
			{ data },
			{
				headers: {
					"Cache-Control": "public, max-age=900, stale-while-revalidate=300",
				},
			},
		);
	} catch (err) {
		console.error("[DealsController] getHeatmap:", err);
		return Response.json(
			{ error: "Failed to fetch heatmap data" },
			{ status: 500 },
		);
	}
}

/** POST /api/deals/by-urls — fetch specific properties by source_url list */
export async function getDealsByUrls(req: Request): Promise<Response> {
	let body: { urls?: unknown } = {};
	try {
		body = (await req.json()) as { urls?: unknown };
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}
	const urls = body?.urls;
	if (!Array.isArray(urls) || urls.length === 0) {
		return Response.json(
			{ error: '"urls" must be a non-empty array' },
			{ status: 400 },
		);
	}
	const safeUrls = urls
		.filter((u): u is string => typeof u === "string")
		.slice(0, 500);
	if (safeUrls.length === 0) {
		return Response.json({ data: [] });
	}
	try {
		const rows = await queryRaw<
			{
				id: number;
				source_url: string;
				price: number;
				area_sqm: number;
				price_per_sqm: number;
				district: string;
				location_name: string | null;
				latitude: number | null;
				longitude: number | null;
				rooms: number | null;
				floor: number | null;
				total_floors: number | null;
				category: string | null;
				has_document: boolean | null;
				has_mortgage: boolean | null;
				has_repair: boolean | null;
				description: string | null;
				is_urgent: boolean;
				has_active_mortgage: boolean;
				posted_date: Date | null;
				created_at: Date;
				updated_at: Date;
				location_avg_price_per_sqm: number;
				discount_percent: number;
			}[]
		> /*sql*/`
      WITH avgs AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE price_per_sqm > 0
          AND NOT (floor = 1 AND total_floors IS NOT NULL)
          AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        GROUP BY location_name
      )
      SELECT
        p.*,
        COALESCE(ROUND(a.avg_ppsm::numeric, 2), 0) AS location_avg_price_per_sqm,
        CASE
          WHEN a.avg_ppsm > 0 THEN ROUND(((a.avg_ppsm - p.price_per_sqm) / a.avg_ppsm * 100)::numeric, 2)
          ELSE 0
        END AS discount_percent
      FROM "Property" p
      LEFT JOIN avgs a ON a.location_name = p.location_name
      WHERE p.source_url = ANY(${safeUrls})
    `;

		return Response.json({
			data: rows.map((r) => ({
				...r,
				tier: classifyDeal(Number(r.discount_percent)),
			})),
		});
	} catch (err) {
		console.error("[DealsController] getDealsByUrls:", err);
		return Response.json(
			{ error: "Failed to fetch properties" },
			{ status: 500 },
		);
	}
}

/** GET /api/deals/map-pins — lightweight pins for map view, same filters as undervalued */
export async function getMapPins(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const q = url.searchParams;

	const locationParam = q.get("location");
	if (!locationParam) {
		return Response.json(
			{ error: 'Query parameter "location" is required' },
			{ status: 400 },
		);
	}

	const isAll = locationParam === "__all__";
	const locations = isAll ? [] : locationParam.split(",").filter(Boolean);
	if (!isAll && locations.length === 0) {
		return Response.json(
			{ error: 'Query parameter "location" cannot be empty' },
			{ status: 400 },
		);
	}

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return Response.json(
			{ error: '"threshold" must be a number between 0 and 100' },
			{ status: 400 },
		);
	}

	function optNum(val: string | null): number | undefined {
		if (val === null || val === "") return undefined;
		const n = Number(val);
		return Number.isNaN(n) ? undefined : n;
	}
	function optBool(val: string | null): boolean | undefined {
		if (val === null || val === "") return undefined;
		return val === "true";
	}

	const factor = (100 - thresholdPct) / 100.0;

	const locCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locations)})`;

	const avgLocCondition = isAll
		? Prisma.sql`location_name IS NOT NULL`
		: Prisma.sql`location_name IN (${Prisma.join(locations)})`;

	const conditions: Prisma.Sql[] = [
		locCondition,
		Prisma.sql`p.latitude IS NOT NULL`,
		Prisma.sql`p.longitude IS NOT NULL`,
		Prisma.sql`p.price_per_sqm > 0`,
		Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
	];

	const minPrice = optNum(q.get("minPrice"));
	const maxPrice = optNum(q.get("maxPrice"));
	const minPriceSqm = optNum(q.get("minPriceSqm"));
	const maxPriceSqm = optNum(q.get("maxPriceSqm"));
	const minArea = optNum(q.get("minArea"));
	const maxArea = optNum(q.get("maxArea"));
	const minRooms = optNum(q.get("minRooms"));
	const maxRooms = optNum(q.get("maxRooms"));
	const minFloor = optNum(q.get("minFloor"));
	const maxFloor = optNum(q.get("maxFloor"));
	const minTotalFloors = optNum(q.get("minTotalFloors"));
	const maxTotalFloors = optNum(q.get("maxTotalFloors"));
	const hasDocument = optBool(q.get("hasDocument"));
	const hasMortgage = optBool(q.get("hasMortgage"));
	const hasRepair = optBool(q.get("hasRepair"));
	const isUrgent = optBool(q.get("isUrgent"));
	const notLastFloor = optBool(q.get("notLastFloor"));
	const hasActiveMortgage = optBool(q.get("hasActiveMortgage"));
	const category = q.get("category") ?? undefined;

	if (minPrice !== undefined)
		conditions.push(Prisma.sql`p.price >= ${minPrice}`);
	if (maxPrice !== undefined)
		conditions.push(Prisma.sql`p.price <= ${maxPrice}`);
	if (minPriceSqm !== undefined)
		conditions.push(Prisma.sql`p.price_per_sqm >= ${minPriceSqm}`);
	if (maxPriceSqm !== undefined)
		conditions.push(Prisma.sql`p.price_per_sqm <= ${maxPriceSqm}`);
	if (minArea !== undefined)
		conditions.push(Prisma.sql`p.area_sqm >= ${minArea}`);
	if (maxArea !== undefined)
		conditions.push(Prisma.sql`p.area_sqm <= ${maxArea}`);
	if (minRooms !== undefined)
		conditions.push(Prisma.sql`p.rooms >= ${minRooms}`);
	if (maxRooms !== undefined)
		conditions.push(Prisma.sql`p.rooms <= ${maxRooms}`);
	if (minFloor !== undefined)
		conditions.push(Prisma.sql`p.floor >= ${minFloor}`);
	if (maxFloor !== undefined)
		conditions.push(Prisma.sql`p.floor <= ${maxFloor}`);
	if (minTotalFloors !== undefined)
		conditions.push(Prisma.sql`p.total_floors >= ${minTotalFloors}`);
	if (maxTotalFloors !== undefined)
		conditions.push(Prisma.sql`p.total_floors <= ${maxTotalFloors}`);
	if (hasDocument !== undefined)
		conditions.push(Prisma.sql`p.has_document = ${hasDocument}`);
	if (hasMortgage !== undefined)
		conditions.push(Prisma.sql`p.has_mortgage = ${hasMortgage}`);
	if (hasRepair !== undefined)
		conditions.push(Prisma.sql`p.has_repair = ${hasRepair}`);
	if (isUrgent !== undefined)
		conditions.push(Prisma.sql`p.is_urgent = ${isUrgent}`);
	if (notLastFloor)
		conditions.push(
			Prisma.sql`(p.floor IS NULL OR p.total_floors IS NULL OR p.floor < p.total_floors)`,
		);
	if (hasActiveMortgage !== undefined)
		conditions.push(Prisma.sql`p.has_active_mortgage = ${hasActiveMortgage}`);
	if (category !== undefined)
		conditions.push(Prisma.sql`p.category = ${category}`);

	try {
		const rows = await queryRaw<
			{
				source_url: string;
				latitude: number;
				longitude: number;
				price: number;
				price_per_sqm: number;
				rooms: number | null;
				location_name: string | null;
				image_urls: string[];
				discount_percent: number;
			}[]
		> /*sql*/`
      WITH loc_avg AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE ${avgLocCondition} AND price_per_sqm > 0
          AND NOT (floor = 1 AND total_floors IS NOT NULL)
          AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        GROUP BY location_name
      )
      SELECT
        p.source_url,
        p.latitude,
        p.longitude,
        p.price,
        p.price_per_sqm,
        p.rooms,
        p.location_name,
        p.image_urls,
        ROUND(((loc_avg.avg_ppsm - p.price_per_sqm) / loc_avg.avg_ppsm * 100)::numeric, 2) AS discount_percent
      FROM "Property" p
      JOIN loc_avg ON p.location_name = loc_avg.location_name
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY discount_percent DESC
      LIMIT 2000
    `;

		return Response.json(
			{
				count: rows.length,
				data: rows.map((r) => ({
					source_url: r.source_url,
					lat: Number(r.latitude),
					lng: Number(r.longitude),
					price: Number(r.price),
					price_per_sqm: Number(r.price_per_sqm),
					rooms: r.rooms !== null ? Number(r.rooms) : null,
					location_name: r.location_name,
					image_url:
						Array.isArray(r.image_urls) && r.image_urls.length > 0
							? r.image_urls[0]
							: null,
					discount_percent: Number(r.discount_percent),
					tier: classifyDeal(Number(r.discount_percent)),
				})),
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (err) {
		console.error("[DealsController] getMapPins:", err);
		return Response.json(
			{ error: "Failed to fetch map pins" },
			{ status: 500 },
		);
	}
}

/** GET /api/deals/price-drops?location=X&minDrops=1&limit=200&offset=0 */
export async function getPriceDrops(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const q = url.searchParams;

	const locationParam = q.get("location");
	if (!locationParam) {
		return Response.json(
			{ error: 'Query parameter "location" is required' },
			{ status: 400 },
		);
	}

	const isAll = locationParam === "__all__";
	const location = isAll ? "__all__" : locationParam.split(",").filter(Boolean);

	if (!isAll && (location as string[]).length === 0) {
		return Response.json(
			{ error: 'Query parameter "location" cannot be empty' },
			{ status: 400 },
		);
	}

	const minDropsRaw = q.get("minDrops");
	const minDropCount = minDropsRaw !== null ? Number(minDropsRaw) : 1;
	if (!Number.isInteger(minDropCount) || minDropCount < 1) {
		return Response.json(
			{ error: '"minDrops" must be a positive integer' },
			{ status: 400 },
		);
	}

	const limitRaw = q.get("limit");
	const limit = limitRaw !== null ? Number(limitRaw) : 200;
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return Response.json(
			{ error: '"limit" must be an integer between 1 and 1000' },
			{ status: 400 },
		);
	}

	const offsetRaw = q.get("offset");
	const offset = offsetRaw !== null ? Number(offsetRaw) : 0;
	if (!Number.isInteger(offset) || offset < 0) {
		return Response.json(
			{ error: '"offset" must be a non-negative integer' },
			{ status: 400 },
		);
	}

	try {
		const { total, data } = await analytics.getPriceDropDeals(location, {
			minDropCount,
			limit,
			offset,
		});
		return Response.json(
			{
				location: locationParam,
				minDropCount,
				limit,
				offset,
				count: data.length,
				total,
				data,
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (err) {
		console.error("[DealsController] getPriceDrops:", err);
		return Response.json(
			{ error: "Failed to fetch price drop listings" },
			{ status: 500 },
		);
	}
}

/** GET /api/deals/undervalued */
export async function getUndervaluedDeals(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const q = url.searchParams;

	const locationParam = q.get("location");
	if (!locationParam) {
		return Response.json(
			{ error: 'Query parameter "location" is required' },
			{ status: 400 },
		);
	}

	const isAll = locationParam === "__all__";
	const locations = isAll
		? "__all__"
		: locationParam.split(",").filter(Boolean);

	if (!isAll && locations.length === 0) {
		return Response.json(
			{ error: 'Query parameter "location" cannot be empty' },
			{ status: 400 },
		);
	}

	const thresholdRaw = q.get("threshold");
	const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
	if (Number.isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
		return Response.json(
			{ error: '"threshold" must be a number between 0 and 100' },
			{ status: 400 },
		);
	}

	const limitRaw = q.get("limit");
	const limit = limitRaw !== null ? Number(limitRaw) : 200;
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return Response.json(
			{ error: '"limit" must be an integer between 1 and 1000' },
			{ status: 400 },
		);
	}

	const offsetRaw = q.get("offset");
	const offset = offsetRaw !== null ? Number(offsetRaw) : 0;
	if (!Number.isInteger(offset) || offset < 0) {
		return Response.json(
			{ error: '"offset" must be a non-negative integer' },
			{ status: 400 },
		);
	}

	function optNum(val: string | null): number | undefined {
		if (val === null || val === "") return undefined;
		const n = Number(val);
		return Number.isNaN(n) ? undefined : n;
	}

	function optBool(val: string | null): boolean | undefined {
		if (val === null || val === "") return undefined;
		return val === "true";
	}

	const filterArgs = {
		minPrice: optNum(q.get("minPrice")),
		maxPrice: optNum(q.get("maxPrice")),
		minPriceSqm: optNum(q.get("minPriceSqm")),
		maxPriceSqm: optNum(q.get("maxPriceSqm")),
		minArea: optNum(q.get("minArea")),
		maxArea: optNum(q.get("maxArea")),
		minRooms: optNum(q.get("minRooms")),
		maxRooms: optNum(q.get("maxRooms")),
		minFloor: optNum(q.get("minFloor")),
		maxFloor: optNum(q.get("maxFloor")),
		minTotalFloors: optNum(q.get("minTotalFloors")),
		maxTotalFloors: optNum(q.get("maxTotalFloors")),
		hasDocument: optBool(q.get("hasDocument")),
		hasMortgage: optBool(q.get("hasMortgage")),
		hasRepair: optBool(q.get("hasRepair")),
		isUrgent: optBool(q.get("isUrgent")),
		notLastFloor: optBool(q.get("notLastFloor")),
		hasActiveMortgage: optBool(q.get("hasActiveMortgage")),
		category: q.get("category") ?? undefined,
		limit,
		offset,
	};

	try {
		const { total, data } = isAll
			? await analytics.getUndervaluedAll(thresholdPct, filterArgs)
			: await analytics.getUndervaluedByLocation(
					locations,
					thresholdPct,
					filterArgs,
				);
		return Response.json(
			{
				location: locationParam,
				threshold_pct: thresholdPct,
				limit,
				offset,
				count: data.length,
				total,
				data,
			},
			{
				headers: { "Cache-Control": "no-store" },
			},
		);
	} catch (err) {
		console.error("[DealsController] getUndervaluedDeals:", err);
		return Response.json(
			{ error: "Failed to fetch undervalued listings" },
			{ status: 500 },
		);
	}
}
