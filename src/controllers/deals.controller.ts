import { AnalyticsService } from '../services/analytics.service.js';
import { queryRaw } from '../utils/prisma.js';

const analytics = new AnalyticsService();

let cachedLocations: string[] | null = null;
let locationsCachedAt = 0;
const LOCATIONS_TTL_MS = 60 * 60_000; // 60 min — location list changes at most every scrape cycle

/** GET /api/deals/locations — distinct location names that have at least one listing */
export async function getLocations(_req: Request): Promise<Response> {
  try {
    const now = Date.now();
    if (cachedLocations === null || now - locationsCachedAt > LOCATIONS_TTL_MS) {
      const rows = await queryRaw<{ location_name: string }[]>`
        SELECT DISTINCT location_name
        FROM "Property"
        WHERE location_name IS NOT NULL
        ORDER BY location_name ASC
      `;
      cachedLocations = rows.map((r) => r.location_name);
      locationsCachedAt = now;
    }
    return Response.json({ data: cachedLocations }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    });
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

  const limitRaw = q.get('limit');
  const limit = limitRaw !== null ? Number(limitRaw) : 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return Response.json({ error: '"limit" must be an integer between 1 and 1000' }, { status: 400 });
  }

  const offsetRaw = q.get('offset');
  const offset = offsetRaw !== null ? Number(offsetRaw) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    return Response.json({ error: '"offset" must be a non-negative integer' }, { status: 400 });
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
    const { total, data } = await analytics.getUndervaluedByLocation(location, thresholdPct, {
      minPrice:       optNum(q.get('minPrice')),
      maxPrice:       optNum(q.get('maxPrice')),
      minArea:        optNum(q.get('minArea')),
      maxArea:        optNum(q.get('maxArea')),
      minRooms:       optNum(q.get('minRooms')),
      maxRooms:       optNum(q.get('maxRooms')),
      minFloor:       optNum(q.get('minFloor')),
      maxFloor:       optNum(q.get('maxFloor')),
      minTotalFloors: optNum(q.get('minTotalFloors')),
      maxTotalFloors: optNum(q.get('maxTotalFloors')),
      hasDocument:    optBool(q.get('hasDocument')),
      hasMortgage:    optBool(q.get('hasMortgage')),
      hasRepair:      optBool(q.get('hasRepair')),
      isUrgent:       optBool(q.get('isUrgent')),
      category:       q.get('category') ?? undefined,
      limit,
      offset,
    });
    return Response.json({ location, threshold_pct: thresholdPct, limit, offset, count: data.length, total, data }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[DealsController] getUndervaluedDeals:', err);
    return Response.json({ error: 'Failed to fetch undervalued listings' }, { status: 500 });
  }
}
