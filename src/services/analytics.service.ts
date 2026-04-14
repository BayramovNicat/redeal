/**
 * AnalyticsService — core deal-finding logic.
 *
 * Deal Score methodology:
 * ─────────────────────────────────────────────────────────────
 *   discount_percent = ((location_avg - property_price_per_sqm) / location_avg) × 100
 *
 *   location_avg excludes 1st-floor and last-floor listings — those are
 *   structurally cheaper (noise, dampness, heat) and would drag the baseline
 *   down, making floor-penalised properties look like false "deals".
 *
 *   A positive value means the property is cheaper than the location average.
 *   A negative value means it is more expensive.
 *
 * Tier thresholds:
 *   ≥ 20% below average  →  "High Value Deal"
 *   10–19% below average →  "Good Deal"
 *    0–9% below average  →  "Fair Price"
 *   Above average        →  "Overpriced"
 * ─────────────────────────────────────────────────────────────
 */

import { Prisma } from "@prisma/client";
import { queryRaw } from "../utils/prisma.js";

type DealTier = "High Value Deal" | "Good Deal" | "Fair Price" | "Overpriced";

/**
 * Maps a discount percentage to a human-readable deal tier.
 * This is the single place to adjust scoring thresholds.
 */
export function classifyDeal(discountPercent: number): DealTier {
	if (discountPercent >= 20) return "High Value Deal";
	if (discountPercent >= 10) return "Good Deal";
	if (discountPercent >= 0) return "Fair Price";
	return "Overpriced";
}

export type TrendPoint = {
	week: Date;
	avg_ppsm: number;
	listing_count: number;
};

export class AnalyticsService {
	/**
	 * Returns weekly average price_per_sqm for a location over the last 16 weeks.
	 * Used to power the sparkline trend chart in the UI.
	 */
	async getPriceTrend(location: string): Promise<TrendPoint[]> {
		type Row = { week: Date; avg_ppsm: number; listing_count: bigint };
		const rows = await queryRaw<Row[]> /*sql*/`
      SELECT
        DATE_TRUNC('week', COALESCE(posted_date, created_at)) AS week,
        ROUND(AVG(price_per_sqm)::numeric, 0)                 AS avg_ppsm,
        COUNT(*)                                               AS listing_count
      FROM "Property"
      WHERE location_name = ${location}
        AND price_per_sqm > 0
        AND NOT (floor = 1 AND total_floors IS NOT NULL)
        AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        AND COALESCE(posted_date, created_at) >= NOW() - INTERVAL '16 weeks'
      GROUP BY DATE_TRUNC('week', COALESCE(posted_date, created_at))
      ORDER BY week ASC
    `;
		return rows.map((r) => ({
			week: r.week,
			avg_ppsm: Number(r.avg_ppsm),
			listing_count: Number(r.listing_count),
		}));
	}

	/**
	 * Returns properties in one or more locations priced at least `thresholdPercent`% below
	 * their respective location average price_per_sqm, with deal-score metadata attached.
	 *
	 * @param locations - One or more location_name values.
	 * @param thresholdPercent - Minimum discount to qualify (default: 10%)
	 */
	async getUndervaluedByLocation(
		locations: string | string[],
		thresholdPercent = 10,
		filters: {
			minPrice?: number;
			maxPrice?: number;
			minPriceSqm?: number;
			maxPriceSqm?: number;
			minArea?: number;
			maxArea?: number;
			minRooms?: number;
			maxRooms?: number;
			minFloor?: number;
			maxFloor?: number;
			minTotalFloors?: number;
			maxTotalFloors?: number;
			hasDocument?: boolean;
			hasMortgage?: boolean;
			hasRepair?: boolean;
			isUrgent?: boolean;
			notLastFloor?: boolean;
			hasActiveMortgage?: boolean;
			category?: string;
			since?: Date;
			limit?: number;
			offset?: number;
		} = {},
	) {
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
			limit = 200,
			offset = 0,
		} = filters;

		const factor = (100 - thresholdPercent) / 100.0;
		const locationList = Array.isArray(locations)
			? locations
			: locations.split(",").filter(Boolean);

		const conditions: Prisma.Sql[] = [
			Prisma.sql`p.location_name IN (${Prisma.join(locationList)})`,
			Prisma.sql`p.price_per_sqm > 0`,
			Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
		];

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
		if (since !== undefined)
			conditions.push(Prisma.sql`p.created_at > ${since}`);

		type Row = {
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
			total_count: bigint;
		};

		const rows = await queryRaw<Row[]> /*sql*/`
      WITH loc_avg AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE location_name IN (${Prisma.join(locationList)})
          AND price_per_sqm > 0
          AND NOT (floor = 1 AND total_floors IS NOT NULL)
          AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        GROUP BY location_name
      )
      SELECT
        p.*,
        ROUND(loc_avg.avg_ppsm::numeric, 2)                                          AS location_avg_price_per_sqm,
        ROUND(((loc_avg.avg_ppsm - p.price_per_sqm) / loc_avg.avg_ppsm * 100)::numeric, 2) AS discount_percent,
        COUNT(*) OVER ()                                                               AS total_count
      FROM "Property" p
      JOIN loc_avg ON p.location_name = loc_avg.location_name
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY p.price_per_sqm ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

		if (rows.length === 0) return { total: 0, data: [] };

		const total = Number(rows[0]?.total_count);
		return {
			total,
			data: rows.map(({ total_count: _, ...p }) => ({
				...p,
				tier: classifyDeal(p.discount_percent),
			})),
		};
	}

	/**
	 * Same as getUndervaluedByLocation but across all locations.
	 * Each property is compared against its own location's avg price_per_sqm.
	 */
	async getUndervaluedAll(
		thresholdPercent = 10,
		filters: {
			minPrice?: number;
			maxPrice?: number;
			minPriceSqm?: number;
			maxPriceSqm?: number;
			minArea?: number;
			maxArea?: number;
			minRooms?: number;
			maxRooms?: number;
			minFloor?: number;
			maxFloor?: number;
			minTotalFloors?: number;
			maxTotalFloors?: number;
			hasDocument?: boolean;
			hasMortgage?: boolean;
			hasRepair?: boolean;
			isUrgent?: boolean;
			notLastFloor?: boolean;
			hasActiveMortgage?: boolean;
			category?: string;
			since?: Date;
			limit?: number;
			offset?: number;
		} = {},
	) {
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
			limit = 200,
			offset = 0,
		} = filters;

		const factor = (100 - thresholdPercent) / 100.0;

		const conditions: Prisma.Sql[] = [
			Prisma.sql`p.location_name IS NOT NULL`,
			Prisma.sql`p.price_per_sqm > 0`,
			Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
		];

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
		if (since !== undefined)
			conditions.push(Prisma.sql`p.created_at > ${since}`);

		type Row = {
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
			total_count: bigint;
		};

		const rows = await queryRaw<Row[]> /*sql*/`
      WITH loc_avg AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE location_name IS NOT NULL
          AND price_per_sqm > 0
          AND NOT (floor = 1 AND total_floors IS NOT NULL)
          AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        GROUP BY location_name
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
    `;

		if (rows.length === 0) return { total: 0, data: [] };

		const total = Number(rows[0]?.total_count);
		return {
			total,
			data: rows.map(({ total_count: _, ...p }) => ({
				...p,
				tier: classifyDeal(p.discount_percent),
			})),
		};
	}

	/**
	 * Returns properties that have had at least one price drop, with drop history.
	 * Sorted by drop count descending — most desperate sellers first.
	 */
	async getPriceDropDeals(
		location: string | string[],
		options: {
			minDropCount?: number;
			limit?: number;
			offset?: number;
		} = {},
	) {
		const { minDropCount = 1, limit = 200, offset = 0 } = options;

		const isAll =
			location === "__all__" ||
			(Array.isArray(location) && location.length === 0);
		const locationList = isAll
			? []
			: Array.isArray(location)
				? location
				: location.split(",").filter(Boolean);

		const locCondition = isAll
			? Prisma.sql`p.location_name IS NOT NULL`
			: Prisma.sql`p.location_name IN (${Prisma.join(locationList)})`;

		const avgLocCondition = isAll
			? Prisma.sql`location_name IS NOT NULL`
			: Prisma.sql`location_name IN (${Prisma.join(locationList)})`;

		type HistoryEntry = { price: string; recorded_at: string };

		type Row = {
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
			image_urls: string[];
			is_urgent: boolean;
			has_active_mortgage: boolean;
			price_drop_count: number;
			posted_date: Date | null;
			created_at: Date;
			updated_at: Date;
			location_avg_price_per_sqm: number;
			discount_percent: number;
			price_history: HistoryEntry[] | null;
			total_count: bigint;
		};

		const rows = await queryRaw<Row[]>`
      WITH loc_avg AS (
        SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE ${avgLocCondition}
          AND price_per_sqm > 0
          AND NOT (floor = 1 AND total_floors IS NOT NULL)
          AND NOT (floor = total_floors AND total_floors IS NOT NULL)
        GROUP BY location_name
      ),
      history AS (
        SELECT
          property_id,
          json_agg(
            json_build_object('price', price::text, 'recorded_at', recorded_at)
            ORDER BY recorded_at DESC
          ) AS entries
        FROM "PriceHistory"
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
    `;

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
}
