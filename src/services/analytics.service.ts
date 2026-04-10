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
    const avg = await this.getLocationAvgPricePerSqm(location);

    if (avg === 0) return [];

    const maxPricePerSqm = avg * (1 - thresholdPercent / 100);

    const {
      minPrice, maxPrice, minArea, maxArea,
      minRooms, maxRooms, minFloor, maxFloor,
      maxTotalFloors, hasDocument, hasMortgage,
      hasRepair, isUrgent, category,
    } = filters;

    const properties = await prisma.property.findMany({
      where: {
        location_name: location,
        price_per_sqm: { gt: 0, lte: maxPricePerSqm },
        ...(minPrice !== undefined || maxPrice !== undefined
          ? { price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } }
          : {}),
        ...(minArea !== undefined || maxArea !== undefined
          ? { area_sqm: { ...(minArea !== undefined && { gte: minArea }), ...(maxArea !== undefined && { lte: maxArea }) } }
          : {}),
        ...(minRooms !== undefined || maxRooms !== undefined
          ? { rooms: { ...(minRooms !== undefined && { gte: minRooms }), ...(maxRooms !== undefined && { lte: maxRooms }) } }
          : {}),
        ...(minFloor !== undefined || maxFloor !== undefined
          ? { floor: { ...(minFloor !== undefined && { gte: minFloor }), ...(maxFloor !== undefined && { lte: maxFloor }) } }
          : {}),
        ...(maxTotalFloors !== undefined && { total_floors: { lte: maxTotalFloors } }),
        ...(hasDocument !== undefined && { has_document: hasDocument }),
        ...(hasMortgage !== undefined && { has_mortgage: hasMortgage }),
        ...(hasRepair !== undefined && { has_repair: hasRepair }),
        ...(isUrgent !== undefined && { is_urgent: isUrgent }),
        ...(category !== undefined && { category }),
      },
      orderBy: { price_per_sqm: 'asc' },
    });

    return properties.map((p) => {
      const pricePerSqm = parseFloat(p.price_per_sqm.toString());
      const discountPercent = parseFloat(
        (((avg - pricePerSqm) / avg) * 100).toFixed(2),
      );

      return {
        ...p,
        price: parseFloat(p.price.toString()),
        area_sqm: parseFloat(p.area_sqm.toString()),
        price_per_sqm: pricePerSqm,
        location_avg_price_per_sqm: parseFloat(avg.toFixed(2)),
        discount_percent: discountPercent,
        tier: classifyDeal(discountPercent),
      };
    });
  }

}
