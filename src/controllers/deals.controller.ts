import { AnalyticsService } from '../services/analytics.service.js';
import { prisma } from '../utils/prisma.js';

const analytics = new AnalyticsService();

/** GET /api/deals/locations — distinct location names that have at least one listing */
export async function getLocations(_req: Request): Promise<Response> {
  try {
    const rows = await prisma.property.findMany({
      where: { location_name: { not: null } },
      select: { location_name: true },
      distinct: ['location_name'],
      orderBy: { location_name: 'asc' },
    });
    const data = rows.map((r) => r.location_name as string);
    return Response.json({ data });
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
