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
import type {
	HeatmapPoint,
	MapPin,
	MapPinRow,
	PropertyFilters,
	PropertyRow,
	PropertyRowWithCount,
	PropertyRowWithHistory,
	TrendPoint,
} from "../types.js";
import { type DealTier, classifyDeal } from "../utils/deals.js";
import { queryRaw } from "../utils/prisma.js";

export class AnalyticsService {
	/**
	 * Returns weekly average price_per_sqm for a location over the last 16 weeks.
	 * Used to power the sparkline trend chart in the UI.
	 */
	async getPriceTrend(location: string): Promise<TrendPoint[]> {
		const rows = await queryRaw<TrendPoint[]>(Prisma.sql`
			SELECT
				DATE_TRUNC('week', COALESCE(posted_date, created_at))      AS week,
				ROUND(AVG(price_per_sqm)::numeric, 0) AS avg_ppsm,
				COUNT(*)                              AS listing_count
			FROM "Property"
			WHERE location_name = ${location}
				AND price_per_sqm > 0
				AND (floor IS NULL OR floor <> 1)
				AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
				AND (
					posted_date >= NOW() - INTERVAL '16 weeks'
					OR (posted_date IS NULL AND created_at >= NOW() - INTERVAL '16 weeks')
				)
			GROUP BY DATE_TRUNC('week', COALESCE(posted_date, created_at))
			ORDER BY week ASC
    	`);
		return rows.map((r) => ({
			week: r.week,
			avg_ppsm: Number(r.avg_ppsm),
			listing_count: Number(r.listing_count),
		}));
	}

	/**
	 * Returns distinct location names that have at least one listing.
	 */
	async getLocations(): Promise<string[]> {
		const rows = await queryRaw<{ location_name: string }[]>(Prisma.sql`
			SELECT DISTINCT location_name
			FROM "Property"
			WHERE location_name IS NOT NULL
			ORDER BY location_name ASC
    	`);
		return rows.map((r) => r.location_name);
	}

	/**
	 * Returns heatmap data: avg price_per_sqm, listing count, coordinates and trend per location.
	 */
	async getHeatmapData(): Promise<HeatmapPoint[]> {
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

	/**
	 * Fetches specific properties by source_url list with location avg comparison.
	 */
	async getPropertiesByUrls(urls: string[]): Promise<(PropertyRow & { tier: DealTier })[]> {
		const rows = await queryRaw<PropertyRow[]>(Prisma.sql`
			WITH avgs AS (
				SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
				FROM "Property"
				WHERE price_per_sqm > 0
					AND (floor IS NULL OR floor <> 1)
					AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
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
			WHERE p.source_url = ANY(${urls})
    	`);

		return rows.map((r) => ({
			...r,
			tier: classifyDeal(Number(r.discount_percent)),
		}));
	}

	/**
	 * Returns lightweight map pins for filtered properties.
	 */
	async getMapPins(options: {
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
			Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
			...this._applyFilters(filters),
		];

		const rows = await queryRaw<MapPinRow[]>(Prisma.sql`
			WITH loc_avg AS (
				SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
				FROM "Property"
				WHERE ${avgLocCondition} AND price_per_sqm > 0
					AND (floor IS NULL OR floor <> 1)
					AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
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
		filters: PropertyFilters = {},
	) {
		const { limit = 200, offset = 0 } = filters;
		const factor = (100 - thresholdPercent) / 100.0;
		const locationList = Array.isArray(locations)
			? locations
			: locations.split(",").filter(Boolean);

		const conditions = [
			Prisma.sql`p.location_name IN (${Prisma.join(locationList)})`,
			Prisma.sql`p.price_per_sqm > 0`,
			Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
			...this._applyFilters(filters),
		];

		const rows = await queryRaw<PropertyRowWithCount[]>(Prisma.sql`
			WITH loc_avg AS (
				SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
				FROM "Property"
				WHERE location_name IN (${Prisma.join(locationList)})
				${this._getLocAvgBaseConditions()}
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
		`);

		return this._mapResponse(rows);
	}

	/**
	 * Same as getUndervaluedByLocation but across all locations.
	 * Each property is compared against its own location's avg price_per_sqm.
	 */
	async getUndervaluedAll(
		thresholdPercent = 10,
		filters: PropertyFilters = {},
	) {
		const { limit = 200, offset = 0 } = filters;
		const factor = (100 - thresholdPercent) / 100.0;

		const conditions = [
			Prisma.sql`p.location_name IS NOT NULL`,
			Prisma.sql`p.price_per_sqm > 0`,
			Prisma.sql`p.price_per_sqm <= loc_avg.avg_ppsm * ${factor}`,
			...this._applyFilters(filters),
		];

		const rows = await queryRaw<PropertyRowWithCount[]>(Prisma.sql`
			WITH loc_avg AS (
				SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
				FROM "Property"
				WHERE location_name IS NOT NULL
					${this._getLocAvgBaseConditions()}
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
		`);

		return this._mapResponse(rows);
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

		const rows = await queryRaw<PropertyRowWithHistory[]>(Prisma.sql`
			WITH loc_avg AS (
				SELECT location_name, AVG(price_per_sqm) AS avg_ppsm
				FROM "Property"
				WHERE ${avgLocCondition}
					AND price_per_sqm > 0
					AND (floor IS NULL OR floor <> 1)
					AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
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
		`);

		return this._mapResponse(rows);
	}

	private _getLocAvgBaseConditions() {
		return Prisma.sql`
			AND price_per_sqm > 0
			AND (floor IS NULL OR floor <> 1)
			AND (floor IS NULL OR total_floors IS NULL OR floor <> total_floors)
		`;
	}

	private _applyFilters(filters: PropertyFilters): Prisma.Sql[] {
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
		if (notLastFloor) {
			conditions.push(
				Prisma.sql`(p.floor IS NULL OR p.total_floors IS NULL OR p.floor < p.total_floors)`,
			);
		}
		if (hasActiveMortgage !== undefined)
			conditions.push(Prisma.sql`p.has_active_mortgage = ${hasActiveMortgage}`);
		if (category !== undefined)
			conditions.push(Prisma.sql`p.category = ${category}`);
		if (since !== undefined)
			conditions.push(Prisma.sql`p.created_at > ${since}`);

		return conditions;
	}

	private _mapResponse<T extends PropertyRowWithCount>(rows: T[]) {
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
