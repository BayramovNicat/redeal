import { AnalyticsService } from '../services/analytics.service.js';
import { prisma } from '../utils/prisma.js';

const analytics = new AnalyticsService();

let cachedLocations: string[] | null = null;
let locationsCachedAt = 0;
const LOCATIONS_TTL_MS = 60 * 60_000; // 60 min — location list changes at most every scrape cycle

/** GET /api/deals/locations — distinct location names that have at least one listing */
export async function getLocations(_req: Request): Promise<Response> {
  try {
    const now = Date.now();
    if (cachedLocations === null || now - locationsCachedAt > LOCATIONS_TTL_MS) {
      const rows = await prisma.$queryRaw<{ location_name: string }[]>`
        SELECT DISTINCT location_name
        FROM "Property"
        WHERE location_name IS NOT NULL
        ORDER BY location_name ASC
      `;
      cachedLocations = rows.map((r) => r.location_name);
      locationsCachedAt = now;
    }
    return Response.json({ data: cachedLocations });
  } catch (err) {
    console.error('[DealsController] getLocations:', err);
    return Response.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

/** GET /api/deals/undervalued */
export async function getUndervaluedDeals(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams;

  const location = q.get('location');
  if (!location) {
    return Response.json({ error: 'Query parameter "location" is required' }, { status: 400 });
  }

  const thresholdRaw = q.get('threshold');
  const thresholdPct = thresholdRaw !== null ? Number(thresholdRaw) : 10;
  if (isNaN(thresholdPct) || thresholdPct < 0 || thresholdPct > 100) {
    return Response.json({ error: '"threshold" must be a number between 0 and 100' }, { status: 400 });
  }

  function optNum(val: string | null): number | undefined {
    if (val === null || val === '') return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  }

  function optBool(val: string | null): boolean | undefined {
    if (val === null || val === '') return undefined;
    return val === 'true';
  }

  try {
    const listings = await analytics.getUndervaluedByLocation(location, thresholdPct, {
      minPrice:       optNum(q.get('minPrice')),
      maxPrice:       optNum(q.get('maxPrice')),
      minArea:        optNum(q.get('minArea')),
      maxArea:        optNum(q.get('maxArea')),
      minRooms:       optNum(q.get('minRooms')),
      maxRooms:       optNum(q.get('maxRooms')),
      minFloor:       optNum(q.get('minFloor')),
      maxFloor:       optNum(q.get('maxFloor')),
      maxTotalFloors: optNum(q.get('maxTotalFloors')),
      hasDocument:    optBool(q.get('hasDocument')),
      hasMortgage:    optBool(q.get('hasMortgage')),
      hasRepair:      optBool(q.get('hasRepair')),
      isUrgent:       optBool(q.get('isUrgent')),
      category:       q.get('category') ?? undefined,
    });
    return Response.json({ location, threshold_pct: thresholdPct, count: listings.length, data: listings });
  } catch (err) {
    console.error('[DealsController] getUndervaluedDeals:', err);
    return Response.json({ error: 'Failed to fetch undervalued listings' }, { status: 500 });
  }
}
