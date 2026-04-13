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
		const rows = await queryRaw<{ location_name: string }[]>`
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

/** GET /api/heatmap — avg price_per_sqm + listing count per location_name */
export async function getHeatmap(_req: Request): Promise<Response> {
	try {
		const rows = await queryRaw<
			{
				location_name: string;
				avg_ppsm: number;
				count: bigint;
				lat: number;
				lng: number;
			}[]
		>`
      SELECT
        location_name,
        ROUND(AVG(price_per_sqm))::int AS avg_ppsm,
        COUNT(*)::bigint AS count,
        AVG(latitude)::float8 AS lat,
        AVG(longitude)::float8 AS lng
      FROM "Property"
      WHERE location_name IS NOT NULL
        AND price_per_sqm > 0
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      GROUP BY location_name
      HAVING COUNT(*) >= 3
      ORDER BY avg_ppsm DESC
    `;
		const data = rows.map((r) => ({
			location_name: r.location_name,
			avg_price_per_sqm: Number(r.avg_ppsm),
			count: Number(r.count),
			lat: Number(r.lat),
			lng: Number(r.lng),
		}));
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
		>`
      WITH avgs AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE price_per_sqm > 0
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

/** GET /api/deals/undervalued */
export async function getUndervaluedDeals(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const q = url.searchParams;

	const location = q.get("location");
	if (!location) {
		return Response.json(
			{ error: 'Query parameter "location" is required' },
			{ status: 400 },
		);
	}
	const isAll = location === "__all__";

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
					location,
					thresholdPct,
					filterArgs,
				);
		return Response.json(
			{
				location,
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
