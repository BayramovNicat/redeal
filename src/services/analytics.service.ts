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

import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';

type DealTier = 'High Value Deal' | 'Good Deal' | 'Fair Price' | 'Overpriced';

/**
 * Maps a discount percentage to a human-readable deal tier.
 * This is the single place to adjust scoring thresholds.
 */
function classifyDeal(discountPercent: number): DealTier {
  if (discountPercent >= 20) return 'High Value Deal';
  if (discountPercent >= 10) return 'Good Deal';
  if (discountPercent >= 0) return 'Fair Price';
  return 'Overpriced';
}

export class AnalyticsService {
  /**
   * Returns the mean price_per_sqm across all valid listings in a location.
   * Excludes listings with price_per_sqm = 0 (data-quality guard).
   */
  async getLocationAvgPricePerSqm(location: string): Promise<number> {
    const result = await prisma.property.aggregate({
      where: { location_name: location, price_per_sqm: { gt: 0 } },
      _avg: { price_per_sqm: true },
    });

    return parseFloat((result._avg.price_per_sqm ?? 0).toString());
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
      maxTotalFloors?: number;
      hasDocument?: boolean;
      hasMortgage?: boolean;
      hasRepair?: boolean;
      isUrgent?: boolean;
      category?: string;
    } = {},
  ) {
    const {
      minPrice, maxPrice, minArea, maxArea,
      minRooms, maxRooms, minFloor, maxFloor,
      maxTotalFloors, hasDocument, hasMortgage,
      hasRepair, isUrgent, category,
    } = filters;

    const factor = (100 - thresholdPercent) / 100.0;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.location_name = ${location}`,
      Prisma.sql`p.price_per_sqm > 0`,
      Prisma.sql`p.price_per_sqm <= avg_cte.avg_ppsm * ${factor}`,
    ];

    if (minPrice !== undefined)       conditions.push(Prisma.sql`p.price >= ${minPrice}`);
    if (maxPrice !== undefined)       conditions.push(Prisma.sql`p.price <= ${maxPrice}`);
    if (minArea !== undefined)        conditions.push(Prisma.sql`p.area_sqm >= ${minArea}`);
    if (maxArea !== undefined)        conditions.push(Prisma.sql`p.area_sqm <= ${maxArea}`);
    if (minRooms !== undefined)       conditions.push(Prisma.sql`p.rooms >= ${minRooms}`);
    if (maxRooms !== undefined)       conditions.push(Prisma.sql`p.rooms <= ${maxRooms}`);
    if (minFloor !== undefined)       conditions.push(Prisma.sql`p.floor >= ${minFloor}`);
    if (maxFloor !== undefined)       conditions.push(Prisma.sql`p.floor <= ${maxFloor}`);
    if (maxTotalFloors !== undefined) conditions.push(Prisma.sql`p.total_floors <= ${maxTotalFloors}`);
    if (hasDocument !== undefined)    conditions.push(Prisma.sql`p.has_document = ${hasDocument}`);
    if (hasMortgage !== undefined)    conditions.push(Prisma.sql`p.has_mortgage = ${hasMortgage}`);
    if (hasRepair !== undefined)      conditions.push(Prisma.sql`p.has_repair = ${hasRepair}`);
    if (isUrgent !== undefined)       conditions.push(Prisma.sql`p.is_urgent = ${isUrgent}`);
    if (category !== undefined)       conditions.push(Prisma.sql`p.category = ${category}`);

    type Row = {
      id: number; source_url: string;
      price: string; area_sqm: string; price_per_sqm: string;
      district: string; location_name: string | null;
      latitude: number | null; longitude: number | null;
      rooms: number | null; floor: number | null; total_floors: number | null;
      category: string | null; has_document: boolean | null;
      has_mortgage: boolean | null; has_repair: boolean | null;
      description: string | null; is_urgent: boolean;
      posted_date: Date | null; created_at: Date; updated_at: Date;
      avg_ppsm: string;
    };

    const rows = await prisma.$queryRaw<Row[]>`
      WITH avg_cte AS (
        SELECT AVG(price_per_sqm) AS avg_ppsm
        FROM "Property"
        WHERE location_name = ${location} AND price_per_sqm > 0
      )
      SELECT p.*, avg_cte.avg_ppsm
      FROM "Property" p, avg_cte
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY p.price_per_sqm ASC
    `;

    if (rows.length === 0) return [];

    const avg = parseFloat(rows[0]!.avg_ppsm);
    if (avg === 0) return [];
    const roundedAvg = parseFloat(avg.toFixed(2));

    return rows.map(({ avg_ppsm: _, ...p }) => {
      const pricePerSqm = parseFloat(p.price_per_sqm);
      const discountPercent = parseFloat((((avg - pricePerSqm) / avg) * 100).toFixed(2));
      return {
        ...p,
        price: parseFloat(p.price),
        area_sqm: parseFloat(p.area_sqm),
        price_per_sqm: pricePerSqm,
        location_avg_price_per_sqm: roundedAvg,
        discount_percent: discountPercent,
        tier: classifyDeal(discountPercent),
      };
    });
  }

}
