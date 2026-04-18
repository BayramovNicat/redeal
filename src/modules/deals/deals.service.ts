/**
 * Deal Score methodology:
 * ─────────────────────────────────────────────────────────────
 *   discount_percent = ((location_avg - property_price_per_sqm) / location_avg) × 100
 *
 *   location_avg excludes 1st-floor and last-floor listings — those are
 *   structurally cheaper (noise, dampness, heat) and would drag the baseline
 *   down, making floor-penalised properties look like false "deals".
 *
 * Tier thresholds:
 *   ≥ 20% below average  →  "High Value Deal"
 *   10–19% below average →  "Good Deal"
 *    0–9% below average  →  "Fair Price"
 *   Above average        →  "Overpriced"
 * ─────────────────────────────────────────────────────────────
 */

import { Prisma } from "@prisma/client";
import type {
	HeatmapPoint,
	MapPin,
	MapPinRow,
	PaginationOptions,
	PriceHistoryEntry,
	PropertyFilters,
	PropertyRow,
	PropertyRowWithCount,
	PropertyRowWithHistory,
	TrendPoint,
} from "@/types/index.js";
import { classifyDeal, type DealTier } from "@/utils/deals.js";
import { queryRaw } from "@/utils/prisma.js";

export async function getPriceTrend(location: string): Promise<TrendPoint[]> {
	const rows = await queryRaw<TrendPoint[]>(Prisma.sql`
		SELECT
			DATE_TRUNC('week', COALESCE(posted_date, created_at)) AS week,
			ROUND(AVG(price_per_sqm)::numeric, 0)                 AS avg_ppsm,
			COUNT(*)                                              AS listing_count
		FROM "Property"
		WHERE location_name = ${location}
			AND price_per_sqm > 0
			AND (floor IS NULL OR floor <> 1)
			AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
			AND COALESCE(posted_date, created_at) >= NOW() - INTERVAL '16 weeks'
		GROUP BY DATE_TRUNC('week', COALESCE(posted_date, created_at))
		ORDER BY week ASC
	`);
	return rows.map((r) => ({
		week: r.week,
		avg_ppsm: Number(r.avg_ppsm),
		listing_count: Number(r.listing_count),
	}));
}

export async function getLocations(): Promise<string[]> {
	const rows = await queryRaw<{ location_name: string }[]>(Prisma.sql`
		SELECT DISTINCT location_name
		FROM "Property"
		WHERE location_name IS NOT NULL
		ORDER BY location_name ASC
	`);
	return rows.map((r) => r.location_name);
}

export async function getHeatmapData(): Promise<HeatmapPoint[]> {
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
	>(Prisma.sql`
		SELECT
			location_name,
			ROUND(AVG(price_per_sqm))::int                                                   AS avg_ppsm,
			COUNT(*)::bigint                                                                  AS count,
			AVG(latitude)::float8                                                            AS lat,
			AVG(longitude)::float8                                                           AS lng,
			ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '4 weeks'
							THEN price_per_sqm END))::int                                        AS recent_avg,
			ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '8 weeks'
						   AND  COALESCE(posted_date, created_at) <  NOW() - INTERVAL '4 weeks'
							THEN price_per_sqm END))::int                                        AS prior_avg
		FROM "Property"
		WHERE location_name IS NOT NULL
			AND price_per_sqm > 0
			AND (floor IS NULL OR floor <> 1)
			AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
			AND latitude IS NOT NULL
			AND longitude IS NOT NULL
		GROUP BY location_name
		HAVING COUNT(*) >= 3
		ORDER BY avg_ppsm DESC
	`);

	return rows.map((r) => {
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
}

export async function getPropertiesByUrls(
	urls: string[],
): Promise<(PropertyRow & { tier: DealTier })[]> {
	const rows = await queryRaw<PropertyRow[]>(Prisma.sql`
		WITH needed AS (
			SELECT DISTINCT location_name
			FROM "Property"
			WHERE source_url = ANY(${urls}) AND location_name IS NOT NULL
		),
		avgs AS (
			SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
			FROM "Property"
			WHERE location_name IN (SELECT location_name FROM needed)
				${locAvgBaseConditions()}
			GROUP BY location_name
			HAVING COUNT(*) >= 3
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
		WHERE p.source_url = ANY(${urls})
	`);

	return rows.map((r) => ({
		...r,
		tier: classifyDeal(Number(r.discount_percent)),
	}));
}

export async function getMapPins(options: {
	locations: string[] | "__all__";
	thresholdPercent: number;
	filters: PropertyFilters;
}): Promise<MapPin[]> {
	const { locations, thresholdPercent, filters } = options;
	const factor = (100 - thresholdPercent) / 100.0;

	const isAll = locations === "__all__";
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
		...(thresholdPercent > 0
			? [Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`]
			: []),
		...applyFilters(filters),
	];

	const rows = await queryRaw<MapPinRow[]>(Prisma.sql`
		WITH loc_avg AS (
			SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
			FROM "Property"
			WHERE ${avgLocCondition}
				${locAvgBaseConditions()}
			GROUP BY location_name
			HAVING COUNT(*) >= 3
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
	`);

	return rows.map((r) => ({
		source_url: r.source_url,
		lat: Number(r.latitude),
		lng: Number(r.longitude),
		price: Number(r.price),
		price_per_sqm: Number(r.price_per_sqm),
		rooms: r.rooms !== null ? Number(r.rooms) : null,
		location_name: r.location_name,
		image_url: r.image_urls?.[0] ?? null,
		discount_percent: Number(r.discount_percent),
		tier: classifyDeal(Number(r.discount_percent)),
	}));
}

export async function getUndervalued(
	locations: string[] | "__all__",
	thresholdPercent = 10,
	filters: PropertyFilters = {},
	pagination: PaginationOptions = {},
): Promise<{ total: number; data: (PropertyRow & { tier: DealTier })[] }> {
	const { limit = 200, offset = 0 } = pagination;
	const factor = (100 - thresholdPercent) / 100.0;

	const isAll = locations === "__all__";
	const avgLocCondition = isAll
		? Prisma.sql`location_name IS NOT NULL`
		: Prisma.sql`location_name IN (${Prisma.join(locations)})`;
	const pLocCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locations)})`;

	const conditions = [
		pLocCondition,
		Prisma.sql`p.price_per_sqm > 0`,
		...(thresholdPercent > 0
			? [Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`]
			: []),
		...applyFilters(filters),
	];

	const rows = await queryRaw<PropertyRowWithCount[]>(Prisma.sql`
		WITH loc_avg AS (
			SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
			FROM "Property"
			WHERE ${avgLocCondition}
				${locAvgBaseConditions()}
			GROUP BY location_name
			HAVING COUNT(*) >= 3
		)
		SELECT
			p.*,
			ROUND(loc_avg.avg_ppsm::numeric, 2)                                                AS location_avg_price_per_sqm,
			ROUND(((loc_avg.avg_ppsm - p.price_per_sqm) / loc_avg.avg_ppsm * 100)::numeric, 2) AS discount_percent,
			COUNT(*) OVER ()                                                                    AS total_count
		FROM "Property" p
		JOIN loc_avg ON p.location_name = loc_avg.location_name
		WHERE ${Prisma.join(conditions, " AND ")}
		ORDER BY discount_percent DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	return mapResponse(rows);
}

export async function getPriceDropDeals(
	location: string[] | "__all__",
	options: { minDropCount?: number } & PaginationOptions = {},
): Promise<{
	total: number;
	data: (PropertyRow & {
		price_history: PriceHistoryEntry[] | null;
		tier: DealTier;
	})[];
}> {
	const { minDropCount = 1, limit = 200, offset = 0 } = options;

	const isAll = location === "__all__";
	const locationList = isAll ? [] : location;

	const locCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locationList)})`;
	const avgLocCondition = isAll
		? Prisma.sql`location_name IS NOT NULL`
		: Prisma.sql`location_name IN (${Prisma.join(locationList)})`;

	const rows = await queryRaw<PropertyRowWithHistory[]>(Prisma.sql`
		WITH loc_avg AS (
			SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
			FROM "Property"
			WHERE ${avgLocCondition}
				${locAvgBaseConditions()}
			GROUP BY location_name
			HAVING COUNT(*) >= 3
		),
		history AS (
			SELECT
				property_id,
				json_agg(
					json_build_object('price', price::text, 'recorded_at', recorded_at)
					ORDER BY recorded_at DESC
				) AS entries
			FROM "PriceHistory"
			WHERE property_id IN (
				SELECT id FROM "Property"
				WHERE ${locCondition} AND price_drop_count >= ${minDropCount}
			)
			GROUP BY property_id
		)
		SELECT
			p.*,
			COALESCE(ROUND(la.avg_ppsm::numeric, 2), 0) AS location_avg_price_per_sqm,
			CASE WHEN la.avg_ppsm > 0
				THEN ROUND(((la.avg_ppsm - p.price_per_sqm) / la.avg_ppsm * 100)::numeric, 2)
				ELSE 0
			END AS discount_percent,
			h.entries AS price_history,
			COUNT(*) OVER () AS total_count
		FROM "Property" p
		LEFT JOIN loc_avg la ON la.location_name = p.location_name
		LEFT JOIN history h ON h.property_id = p.id
		WHERE ${locCondition}
			AND p.price_drop_count >= ${minDropCount}
		ORDER BY p.price_drop_count DESC, p.updated_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	return mapResponse(rows);
}

// --- Internal helpers (not exported) ---

function locAvgBaseConditions() {
	return Prisma.sql`
		AND price_per_sqm > 0
		AND (floor IS NULL OR floor <> 1)
		AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
	`;
}

function applyFilters(filters: PropertyFilters): Prisma.Sql[] {
	const conditions: Prisma.Sql[] = [];
	const {
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
		hasDocument,
		hasMortgage,
		hasRepair,
		isUrgent,
		notLastFloor,
		hasActiveMortgage,
		category,
		since,
		descriptionSearch,
	} = filters;

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
	if (since !== undefined) conditions.push(Prisma.sql`p.created_at > ${since}`);
	if (descriptionSearch !== undefined && descriptionSearch.trim() !== "")
		conditions.push(
			Prisma.sql`p.description ILIKE ${`%${descriptionSearch.trim()}%`}`,
		);

	return conditions;
}

function mapResponse<T extends PropertyRowWithCount>(rows: T[]) {
	if (rows.length === 0) return { total: 0, data: [] };
	const total = Number(rows[0]?.total_count);
	return {
		total,
		data: rows.map(({ total_count: _, ...p }) => ({
			...p,
			tier: classifyDeal(Number(p.discount_percent)),
		})),
	};
}
