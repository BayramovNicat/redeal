/**
 * Deal Score methodology:
 * ─────────────────────────────────────────────────────────────
 *   discount_percent = ((location_avg - property_price_per_sqm) / location_avg) × 100
 *
 *   location_avg excludes 1st-floor and last-floor listings — those are
 *   structurally cheaper (noise, dampness, heat) and would drag the baseline
 *   down, making floor-penalised properties look like false "deals".
 *
 *   Listings with > 90% discount (MAX_DEAL_DISCOUNT_PERCENT) are excluded
 *   because they are mostly wrongly declared (e.g. price/area typos or daily
 *   rent listed as monthly).
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
	DealSort,
	HeatmapPoint,
	MapPin,
	MapPinRow,
	PaginationOptions,
	PriceHistoryEntry,
	PropertyFilters,
	PropertyRow,
	PropertyRowWithHistory,
	TrendPoint,
} from "@/types/index.js";
import {
	classifyDeal,
	type DealTier,
	MAX_DEAL_DISCOUNT_PERCENT,
} from "@/utils/deals.js";
import { queryRaw } from "@/utils/prisma.js";

const LOCATIONS_CACHE_TTL = 10 * 60_000;
let locationsCache: { data: string[]; at: number } | null = null;

const AVG_CACHE_TTL = 30 * 60_000;
const avgCache = new Map<string, { avg: number; at: number }>();
const avgPromises = new Map<string, Promise<Map<string, number>>>();

export function invalidateDealsCaches(): void {
	avgCache.clear();
	avgPromises.clear();
	locationsCache = null;
}

function effectiveCategory(filters: PropertyFilters = {}): string {
	return filters.category ?? "new";
}

function effectiveListingType(filters: PropertyFilters = {}): "sale" | "rent" {
	return filters.listingType ?? "sale";
}

function categoryCondition(category: string, alias = "p"): Prisma.Sql {
	return Prisma.sql`${Prisma.raw(alias)}.category::text = ${category}`;
}

function listingTypeCondition(
	listingType: "sale" | "rent",
	alias = "p",
): Prisma.Sql {
	return Prisma.sql`${Prisma.raw(alias)}.listing_type::text = ${listingType}`;
}

function getUndervaluedOrderBy(sort: DealSort = "disc"): Prisma.Sql {
	switch (sort) {
		case "drops":
			return Prisma.sql`p.price_drop_count DESC NULLS LAST, p.updated_at DESC, p.id DESC`;
		case "new":
			return Prisma.sql`p.posted_date DESC NULLS LAST, p.created_at DESC, p.id DESC`;
		case "price-asc":
			return Prisma.sql`p.price ASC, p.id DESC`;
		case "price-desc":
			return Prisma.sql`p.price DESC, p.id DESC`;
		case "area":
			return Prisma.sql`p.area_sqm DESC NULLS LAST, p.id DESC`;
		case "ppsm":
			return Prisma.sql`p.price_per_sqm ASC, p.id DESC`;
		case "disc":
			return Prisma.sql`discount_percent DESC, p.id DESC`;
	}
}

export async function getPriceTrend(location: string): Promise<TrendPoint[]> {
	const rows = await queryRaw<TrendPoint[]>(Prisma.sql`
		SELECT
			DATE_TRUNC('week', COALESCE(posted_date, created_at)) AS week,
			ROUND(AVG(price_per_sqm)::numeric, 0)                 AS avg_ppsm,
			COUNT(*)                                              AS listing_count
		FROM "Property"
		WHERE location_name = ${location}
			AND listing_type::text = 'sale'
			AND category::text = 'new'
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

let locationsPromise: Promise<string[]> | null = null;
export async function getLocations(): Promise<string[]> {
	if (locationsCache && Date.now() - locationsCache.at < LOCATIONS_CACHE_TTL) {
		return locationsCache.data;
	}
	if (locationsPromise) return locationsPromise;

	locationsPromise = (async () => {
		try {
			const rows = await queryRaw<{ location_name: string }[]>(Prisma.sql`
				SELECT DISTINCT location_name
				FROM "Property"
				WHERE location_name IS NOT NULL
				ORDER BY location_name ASC
			`);
			const data = rows.map((r) => r.location_name);
			locationsCache = { data, at: Date.now() };
			return data;
		} finally {
			locationsPromise = null;
		}
	})();

	return locationsPromise;
}

async function getLocationAverages(
	locations: string[] | "__all__",
	category = "new",
	listingType: "sale" | "rent" = "sale",
): Promise<Map<string, number>> {
	const now = Date.now();
	const isAll = locations === "__all__";
	const locList = isAll ? [] : (locations as string[]);
	const cacheKey = (location: string) =>
		`${listingType}:${category}:${location}`;
	const promiseKey = isAll
		? `${listingType}:${category}:__all__`
		: `${listingType}:${category}:${locList.join("|")}`;

	if (!isAll) {
		const cached = new Map<string, number>();
		let allInCache = true;
		for (const l of locList) {
			const entry = avgCache.get(cacheKey(l));
			if (entry && now - entry.at < AVG_CACHE_TTL) {
				cached.set(l, entry.avg);
			} else {
				allInCache = false;
				break;
			}
		}
		if (allInCache) return cached;
	} else {
		const avgPromise = avgPromises.get(promiseKey);
		if (avgPromise) return avgPromise;
	}

	const fetchPromise = (async () => {
		const avgLocCondition = isAll
			? Prisma.sql`location_name IS NOT NULL`
			: Prisma.sql`location_name IN (${Prisma.join(locList)})`;

		const rows = await queryRaw<{ location_name: string; avg_ppsm: number }[]>(
			Prisma.sql`
			SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
			FROM "Property"
			WHERE ${avgLocCondition}
				AND listing_type::text = ${listingType}
				AND category::text = ${category}
				${locAvgBaseConditions()}
			GROUP BY location_name
			HAVING COUNT(*) >= 3
		`,
		);

		const result = new Map<string, number>();
		for (const r of rows) {
			const avg = Number(r.avg_ppsm);
			result.set(r.location_name, avg);
			avgCache.set(cacheKey(r.location_name), { avg, at: now });
		}
		return result;
	})();

	if (isAll) {
		avgPromises.set(promiseKey, fetchPromise);
		try {
			return await fetchPromise;
		} finally {
			avgPromises.delete(promiseKey);
		}
	}

	return fetchPromise;
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
			ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '14 days'
							THEN price_per_sqm END))::int                                        AS recent_avg,
			ROUND(AVG(CASE WHEN COALESCE(posted_date, created_at) >= NOW() - INTERVAL '28 days'
						   AND  COALESCE(posted_date, created_at) <  NOW() - INTERVAL '14 days'
							THEN price_per_sqm END))::int                                        AS prior_avg
		FROM "Property"
		WHERE location_name IS NOT NULL
			AND listing_type::text = 'sale'
			AND category::text = 'new'
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
				AND listing_type::text = 'sale'
				AND category::text = 'new'
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
	const category = effectiveCategory(filters);
	const listingType = effectiveListingType(filters);
	const factor = (100 - thresholdPercent) / 100.0;

	const avgsMap = await getLocationAverages(locations, category, listingType);
	if (avgsMap.size === 0) return [];

	const isAll = locations === "__all__";
	const locCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locations)})`;

	const avgEntries = Array.from(avgsMap.entries()).map(
		([loc, avg]) => Prisma.sql`(${loc}, ${avg}::numeric)`,
	);

	const conditions: Prisma.Sql[] = [
		locCondition,
		Prisma.sql`p.latitude IS NOT NULL`,
		Prisma.sql`p.longitude IS NOT NULL`,
		Prisma.sql`p.price_per_sqm > 0`,
		listingTypeCondition(listingType),
		categoryCondition(category),
		maxDiscountCondition(),
		...(thresholdPercent > 0
			? [Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`]
			: []),
		...applyFilters(filters),
	];

	const rows = await queryRaw<MapPinRow[]>(Prisma.sql`
		WITH loc_avg(location_name, avg_ppsm) AS (
			VALUES ${Prisma.join(avgEntries)}
		)
		SELECT
			p.source_url,
			p.latitude,
			p.longitude,
			p.price,
			p.price_per_sqm,
			p.area_sqm,
			p.floor,
			p.total_floors,
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
		area_sqm: r.area_sqm !== null ? Number(r.area_sqm) : null,
		floor: r.floor !== null ? Number(r.floor) : null,
		total_floors: r.total_floors !== null ? Number(r.total_floors) : null,
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
	const { limit = 200, offset = 0, sort = "disc" } = pagination;
	const category = effectiveCategory(filters);
	const listingType = effectiveListingType(filters);
	const orderBy = getUndervaluedOrderBy(sort);
	const factor = (100 - thresholdPercent) / 100.0;

	const avgsMap = await getLocationAverages(locations, category, listingType);
	if (avgsMap.size === 0) return { total: 0, data: [] };

	const isAll = locations === "__all__";
	const pLocCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locations)})`;

	const avgEntries = Array.from(avgsMap.entries()).map(
		([loc, avg]) => Prisma.sql`(${loc}, ${avg}::numeric)`,
	);

	const conditions = [
		pLocCondition,
		Prisma.sql`p.price_per_sqm > 0`,
		listingTypeCondition(listingType),
		categoryCondition(category),
		maxDiscountCondition(),
		...(thresholdPercent > 0
			? [Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`]
			: []),
		...applyFilters(filters),
	];

	const baseQuery = Prisma.sql`
		FROM "Property" p
		JOIN loc_avg ON p.location_name = loc_avg.location_name
		WHERE ${Prisma.join(conditions, " AND ")}
	`;

	const [totalRows, dataRows] = await Promise.all([
		queryRaw<{ count: bigint }[]>(Prisma.sql`
			WITH loc_avg(location_name, avg_ppsm) AS (
				VALUES ${Prisma.join(avgEntries)}
			)
			SELECT COUNT(*)::bigint AS count
			${baseQuery}
		`),
		queryRaw<PropertyRow[]>(Prisma.sql`
			WITH loc_avg(location_name, avg_ppsm) AS (
				VALUES ${Prisma.join(avgEntries)}
			)
			SELECT
				p.*,
				ROUND(loc_avg.avg_ppsm::numeric, 2)                                                AS location_avg_price_per_sqm,
				ROUND(((loc_avg.avg_ppsm - p.price_per_sqm) / loc_avg.avg_ppsm * 100)::numeric, 2) AS discount_percent
			${baseQuery}
			ORDER BY ${orderBy}
			LIMIT ${limit} OFFSET ${offset}
		`),
	]);

	return {
		total: Number(totalRows[0]?.count || 0),
		data: dataRows.map((p) => ({
			...p,
			tier: classifyDeal(Number(p.discount_percent)),
		})),
	};
}

export async function getUndervaluedUrlTiers(
	locations: string[] | "__all__",
	thresholdPercent = 10,
	filters: PropertyFilters = {},
	options: { sort?: DealSort; limit?: number } = {},
): Promise<{ source_url: string; tier: DealTier }[]> {
	const { sort = "disc", limit } = options;
	const listingType = effectiveListingType(filters);
	const category = effectiveCategory(filters);
	const orderBy = getUndervaluedOrderBy(sort);
	const factor = (100 - thresholdPercent) / 100.0;

	const avgsMap = await getLocationAverages(locations, category, listingType);
	if (avgsMap.size === 0) return [];

	const isAll = locations === "__all__";
	const pLocCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locations)})`;

	const avgEntries = Array.from(avgsMap.entries()).map(
		([loc, avg]) => Prisma.sql`(${loc}, ${avg}::numeric)`,
	);

	const conditions = [
		pLocCondition,
		Prisma.sql`p.price_per_sqm > 0`,
		listingTypeCondition(listingType),
		categoryCondition(category),
		maxDiscountCondition(),
		...(thresholdPercent > 0
			? [Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`]
			: []),
		...applyFilters(filters),
	];

	const limitClause =
		limit !== undefined ? Prisma.sql`LIMIT ${limit}` : Prisma.empty;

	const rows = await queryRaw<
		{ source_url: string; discount_percent: number | string }[]
	>(Prisma.sql`
		WITH loc_avg(location_name, avg_ppsm) AS (
			VALUES ${Prisma.join(avgEntries)}
		)
		SELECT
			p.source_url,
			ROUND(((loc_avg.avg_ppsm - p.price_per_sqm) / loc_avg.avg_ppsm * 100)::numeric, 2) AS discount_percent
		FROM "Property" p
		JOIN loc_avg ON p.location_name = loc_avg.location_name
		WHERE ${Prisma.join(conditions, " AND ")}
		ORDER BY ${orderBy}
		${limitClause}
	`);

	return rows.map((row) => ({
		source_url: row.source_url,
		tier: classifyDeal(Number(row.discount_percent)),
	}));
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
	const category = "new";
	const listingType = "sale";

	const isAll = location === "__all__";
	const locationList = isAll ? [] : (location as string[]);

	const avgsMap = await getLocationAverages(location, category, listingType);
	if (avgsMap.size === 0) return { total: 0, data: [] };

	const locCondition = isAll
		? Prisma.sql`p.location_name IS NOT NULL`
		: Prisma.sql`p.location_name IN (${Prisma.join(locationList)})`;

	const avgEntries = Array.from(avgsMap.entries()).map(
		([loc, avg]) => Prisma.sql`(${loc}, ${avg}::numeric)`,
	);

	const baseQuery = Prisma.sql`
		FROM "Property" p
		LEFT JOIN loc_avg la ON la.location_name = p.location_name
		LEFT JOIN (
			SELECT property_id, json_agg(json_build_object(
				'price', price,
				'price_per_sqm', price_per_sqm,
				'recorded_at', recorded_at
			) ORDER BY recorded_at ASC) AS entries
			FROM "PriceHistory"
			GROUP BY property_id
		) h ON h.property_id = p.id
		WHERE ${locCondition}
			AND ${listingTypeCondition(listingType)}
			AND ${categoryCondition(category)}
			AND p.price_drop_count >= ${minDropCount}
			AND (la.avg_ppsm IS NULL OR ${maxDiscountCondition("la.avg_ppsm")})
	`;

	const [totalRows, dataRows] = await Promise.all([
		queryRaw<{ count: bigint }[]>(Prisma.sql`
			WITH loc_avg(location_name, avg_ppsm) AS (
				VALUES ${Prisma.join(avgEntries)}
			)
			SELECT COUNT(*)::bigint AS count
			${baseQuery}
		`),
		queryRaw<PropertyRowWithHistory[]>(Prisma.sql`
			WITH loc_avg(location_name, avg_ppsm) AS (
				VALUES ${Prisma.join(avgEntries)}
			)
			SELECT
				p.*,
				COALESCE(ROUND(la.avg_ppsm::numeric, 2), 0) AS location_avg_price_per_sqm,
				CASE WHEN la.avg_ppsm > 0
					THEN ROUND(((la.avg_ppsm - p.price_per_sqm) / la.avg_ppsm * 100)::numeric, 2)
					ELSE 0
				END AS discount_percent,
				h.entries AS price_history
			${baseQuery}
			ORDER BY p.price_drop_count DESC, p.updated_at DESC
			LIMIT ${limit} OFFSET ${offset}
		`),
	]);

	return {
		total: Number(totalRows[0]?.count || 0),
		data: dataRows.map((p) => ({
			...p,
			tier: classifyDeal(Number(p.discount_percent)),
		})),
	};
}

// --- Internal helpers (not exported) ---

function maxDiscountCondition(avgRef = "loc_avg.avg_ppsm"): Prisma.Sql {
	return Prisma.sql`p.price_per_sqm >= ${Prisma.raw(avgRef)} * ((100 - ${MAX_DEAL_DISCOUNT_PERCENT})::numeric / 100)`;
}

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
		listingType,
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
		conditions.push(Prisma.sql`p.category::text = ${category}`);
	if (listingType !== undefined)
		conditions.push(Prisma.sql`p.listing_type::text = ${listingType}`);
	if (since !== undefined) conditions.push(Prisma.sql`p.created_at > ${since}`);
	if (descriptionSearch !== undefined && descriptionSearch.trim() !== "")
		conditions.push(
			Prisma.sql`p.description ILIKE ${`%${descriptionSearch.trim()}%`}`,
		);

	return conditions;
}
