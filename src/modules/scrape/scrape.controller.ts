import { runAlerts } from "@/modules/alerts/alerts.service.js";
import { getUserFromRequest } from "@/modules/auth/auth.middleware.js";
import {
	adminPasswordConfigured,
	clearScrapeAdminSessionResponse,
	createScrapeAdminSessionResponse,
	getScrapeAdminSession,
	requireScrapeAdminMutation,
	verifyScrapeAdminPassword,
} from "@/modules/scrape/scrape-admin-auth.js";
import { parseQueryNum } from "@/utils/query.js";
import { ResponseHelper } from "@/utils/response.js";
import { scrapeRunsService } from "./scrape-runs.service.js";

export async function loginScrapeAdmin(req: Request): Promise<Response> {
	if (!adminPasswordConfigured()) {
		return ResponseHelper.error("SCRAPE_ADMIN_PASSWORD is not configured", 503);
	}

	let body: { password?: unknown } = {};
	try {
		body = (await req.json()) as { password?: unknown };
	} catch {
		return ResponseHelper.error("Invalid JSON body", 400);
	}

	if (
		typeof body.password !== "string" ||
		!verifyScrapeAdminPassword(body.password)
	) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	return createScrapeAdminSessionResponse();
}

export function logoutScrapeAdmin(): Response {
	return clearScrapeAdminSessionResponse();
}

export async function getScrapeAdminSessionStatus(
	req: Request,
): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (user?.role === "admin") {
		return ResponseHelper.privateJson({
			ok: true,
			authenticated: true,
			csrfToken: "admin-user",
		});
	}
	if (!adminPasswordConfigured()) {
		return ResponseHelper.privateJson({ ok: true, authenticated: false });
	}
	const session = await getScrapeAdminSession(req);
	return ResponseHelper.privateJson({ ok: true, ...session });
}

export async function getScrapeRuns(req: Request): Promise<Response> {
	const q = new URL(req.url).searchParams;
	const limitParam = q.get("limit");
	const limitRaw = parseQueryNum(limitParam);
	const limit = limitRaw ?? 20;
	if (
		(limitParam !== null && limitRaw === undefined) ||
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > 100
	) {
		return ResponseHelper.error(
			'"limit" must be an integer between 1 and 100',
			400,
		);
	}

	try {
		const runs = await scrapeRunsService.list(limit);
		return ResponseHelper.privateJson({ ok: true, runs });
	} catch (err) {
		console.error("[ScrapeController] getScrapeRuns:", err);
		return ResponseHelper.error("Failed to fetch scrape runs");
	}
}

export async function runScrape(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user || user.role !== "admin") {
		const authError = await requireScrapeAdminMutation(req);
		if (authError) return authError;
	}

	scrapeRunsService
		.run("manual", {
			maxPages: 20,
			delayMs: 800,
		})
		.then(async (run) => {
			if (run.status === "success") await runAlerts();
		})
		.catch((err) => {
			console.error("[ScrapeController] runScrape:", err);
		});

	return ResponseHelper.privateJson({ ok: true });
}
