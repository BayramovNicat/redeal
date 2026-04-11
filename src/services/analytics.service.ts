/**
 * AnalyticsService — core deal-finding logic.
 *
 * Deal Score methodology:
 * ─────────────────────────────────────────────────────────────
 *   discount_percent = ((location_avg - property_price_per_sqm) / location_avg) × 100
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
function classifyDeal(discountPercent: number): DealTier {
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
		const rows = await queryRaw<Row[]>`
      SELECT
        DATE_TRUNC('week', created_at)            AS week,
        ROUND(AVG(price_per_sqm)::numeric, 0)     AS avg_ppsm,
        COUNT(*)                                   AS listing_count
      FROM "Property"
      WHERE location_name = ${location}
        AND price_per_sqm > 0
        AND created_at >= NOW() - INTERVAL '16 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week ASC
    `;
		return rows.map((r) => ({
			week: r.week,
			avg_ppsm: Number(r.avg_ppsm),
			listing_count: Number(r.listing_count),
		}));
	}

	/**
	 * Returns properties in a location priced at least `thresholdPercent`% below
	 * the location average price_per_sqm, with deal-score metadata attached.
	 * Uses a single CTE query to compute the avg and fetch matching rows together.
	 *
	 * @param location - Exact location_name value (e.g. "Memar Əcəmi m.")
	 * @param thresholdPercent - Minimum discount to qualify (default: 10%)
	 */
	async getUndervaluedByLocation(
		location: string,
		thresholdPercent = 10,
		filters: {
			minPrice?: number;
			maxPrice?: number;
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
			category?: string;
			limit?: number;
			offset?: number;
		} = {},
	) {
		const {
			minPrice,
			maxPrice,
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
			category,
			limit = 200,
			offset = 0,
		} = filters;

		const factor = (100 - thresholdPercent) / 100.0;

		const conditions: Prisma.Sql[] = [
			Prisma.sql`p.location_name = ${location}`,
			Prisma.sql`p.price_per_sqm > 0`,
			Prisma.sql`p.price_per_sqm <= avg_cte.avg_ppsm * ${factor}`,
		];

		if (minPrice !== undefined)
			conditions.push(Prisma.sql`p.price >= ${minPrice}`);
		if (maxPrice !== undefined)
			conditions.push(Prisma.sql`p.price <= ${maxPrice}`);
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
		if (category !== undefined)
			conditions.push(Prisma.sql`p.category = ${category}`);

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
			posted_date: Date | null;
			created_at: Date;
			updated_at: Date;
			location_avg_price_per_sqm: number;
			discount_percent: number;
			total_count: bigint;
		};

		const rows = await queryRaw<Row[]>`
      WITH avg_cte AS (
        SELECT AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE location_name = ${location} AND price_per_sqm > 0
      )
      SELECT
        p.*,
        ROUND(avg_cte.avg_ppsm::numeric, 2)                                          AS location_avg_price_per_sqm,
        ROUND(((avg_cte.avg_ppsm - p.price_per_sqm) / avg_cte.avg_ppsm * 100)::numeric, 2) AS discount_percent,
        COUNT(*) OVER ()                                                               AS total_count
      FROM "Property" p, avg_cte
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
}
