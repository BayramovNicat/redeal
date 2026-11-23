import { br } from "@/middleware/brotli.js";
import {
	createAlert,
	deleteAlert,
	getAlerts,
} from "@/modules/alerts/alerts.controller.js";
import {
	handleAddWhitelist,
	handleApproveAccessRequest,
	handleDismissAccessRequest,
	handleGetAccessRequests,
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
	"/api/auth/me": { GET: br(handleGetMe) },
	"/api/auth/logout": { POST: br(handleLogout), GET: br(handleLogout) },
	"/api/auth/whitelist": {
		GET: br(requireAdmin(handleGetWhitelist)),
		POST: br(requireAdmin(handleAddWhitelist)),
	},
	"/api/auth/whitelist/:email": {
		DELETE: br(requireAdmin(handleRemoveWhitelist)),
	},
	"/api/auth/requests": {
		GET: br(requireAdmin(handleGetAccessRequests)),
	},
	"/api/auth/requests/:email/approve": {
		POST: br(requireAdmin(handleApproveAccessRequest)),
	},
	"/api/auth/requests/:email": {
		DELETE: br(requireAdmin(handleDismissAccessRequest)),
	},

	// Public Preview & Protected Data / Deals endpoints
	"/api/deals/locations": { GET: br(getLocations) },
	"/api/deals/trend": { GET: br(getTrend) },
	"/api/deals/undervalued": { GET: br(getUndervaluedDeals) },
	"/api/deals/undervalued/validate": {
		POST: br(requireAdmin(validateUndervaluedDeals)),
	},
	"/api/deals/price-drops": { GET: br(requireAuth(getPriceDrops)) },
	"/api/deals/map-pins": { GET: br(getMapPins) },
	"/api/deals/by-json-items": { POST: br(requireAuth(getDealsByJsonItems)) },
	"/api/deals/by-urls": { POST: br(requireAuth(getDealsByUrls)) },
	"/api/deals/item": { DELETE: br(requireAdmin(deleteDeal)) },
	"/api/deals/check-ended": { POST: br(requireAuth(checkEndedListing)) },
	"/api/heatmap": { GET: br(getHeatmap) },
	"/api/scrape/runs": { GET: br(requireAuth(getScrapeRuns)) },
	"/api/scrape/session": { GET: br(getScrapeAdminSessionStatus) },
	"/api/scrape/login": { POST: br(loginScrapeAdmin) },
	"/api/scrape/logout": { POST: br(logoutScrapeAdmin) },
	"/api/scrape/run": { POST: br(runScrape) },
	"/api/alerts": {
		GET: br(requireAuth(getAlerts)),
		POST: br(requireAuth(createAlert)),
	},
	"/api/alerts/:token": { DELETE: br(requireAuth(deleteAlert)) },
	"/api/telegram/webhook": { POST: br(handleWebhook) },
} as const;
