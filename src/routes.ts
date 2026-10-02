import { br } from "@/middleware/brotli.js";
import {
	createAlert,
	deleteAlert,
	getAlerts,
} from "@/modules/alerts/alerts.controller.js";
import {
	handleAddWhitelist,
	handleGetMe,
	handleGetWhitelist,
	handleGoogleCallback,
	handleGoogleLogin,
	handleLogout,
	handleRemoveWhitelist,
} from "@/modules/auth/auth.controller.js";
import { requireAdmin, requireAuth } from "@/modules/auth/auth.middleware.js";
import {
	checkEndedListing,
	deleteDeal,
	getDealsByJsonItems,
	getDealsByUrls,
	getHeatmap,
	getLocations,
	getMapPins,
	getPriceDrops,
	getTrend,
	getUndervaluedDeals,
	validateUndervaluedDeals,
} from "@/modules/deals/deals.controller.js";
import {
	getScrapeAdminSessionStatus,
	getScrapeRuns,
	loginScrapeAdmin,
	logoutScrapeAdmin,
	runScrape,
} from "@/modules/scrape/scrape.controller.js";
import { handleWebhook } from "@/modules/telegram/telegram.controller.js";
import { prisma } from "@/utils/prisma.js";

let healthCache: { count: number; at: number } | null = null;
let healthPromise: Promise<number> | null = null;
const HEALTH_TTL = 5 * 60_000;

export const routes = {
	"/health": {
		GET: br(async () => {
			if (!healthCache || Date.now() - healthCache.at > HEALTH_TTL) {
				if (!healthPromise) {
					healthPromise = (async () => {
						try {
							const count = await prisma.property.count();
							healthCache = { count, at: Date.now() };
							return count;
						} finally {
							healthPromise = null;
						}
					})();
				}
				await healthPromise;
			}
			return Response.json({
				status: "ok",
				timestamp: new Date().toISOString(),
				properties: healthCache?.count ?? 0,
			});
		}),
	},
	// Authentication & Whitelist endpoints
	"/api/auth/google": { GET: handleGoogleLogin },
	"/api/auth/google/callback": { GET: handleGoogleCallback },
	"/api/auth/me": { GET: handleGetMe },
	"/api/auth/logout": { POST: handleLogout, GET: handleLogout },
	"/api/auth/whitelist": {
		GET: requireAdmin(handleGetWhitelist),
		POST: requireAdmin(handleAddWhitelist),
	},
	"/api/auth/whitelist/:email": { DELETE: requireAdmin(handleRemoveWhitelist) },

	// Protected Data & Deals endpoints
	"/api/deals/locations": { GET: requireAuth(br(getLocations)) },
	"/api/deals/trend": { GET: requireAuth(br(getTrend)) },
	"/api/deals/undervalued": { GET: requireAuth(br(getUndervaluedDeals)) },
	"/api/deals/undervalued/validate": {
		POST: requireAuth(br(validateUndervaluedDeals)),
	},
	"/api/deals/price-drops": { GET: requireAuth(br(getPriceDrops)) },
	"/api/deals/map-pins": { GET: requireAuth(br(getMapPins)) },
	"/api/deals/by-json-items": { POST: requireAuth(br(getDealsByJsonItems)) },
	"/api/deals/by-urls": { POST: requireAuth(br(getDealsByUrls)) },
	"/api/deals/item": { DELETE: requireAdmin(br(deleteDeal)) },
	"/api/deals/check-ended": { POST: requireAuth(br(checkEndedListing)) },
	"/api/heatmap": { GET: requireAuth(br(getHeatmap)) },
	"/api/scrape/runs": { GET: requireAuth(br(getScrapeRuns)) },
	"/api/scrape/session": { GET: getScrapeAdminSessionStatus },
	"/api/scrape/login": { POST: loginScrapeAdmin },
	"/api/scrape/logout": { POST: logoutScrapeAdmin },
	"/api/scrape/run": { POST: runScrape },
	"/api/alerts": {
		GET: requireAuth(br(getAlerts)),
		POST: requireAuth(br(createAlert)),
	},
	"/api/alerts/:token": { DELETE: requireAuth(br(deleteAlert)) },
	"/api/telegram/webhook": { POST: br(handleWebhook) },
} as const;
