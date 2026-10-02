import { AUTH_ENABLED, IS_DEV, PORT } from "@/config.js";
import { initStatic, serveStatic } from "@/middleware/static.js";
import { getUserFromRequest } from "@/modules/auth/auth.middleware.js";
import { startCron } from "@/plugins/cron.js";
import { routes } from "@/routes.js";

const publicDir = `${import.meta.dir}/../public`;
await initStatic(publicDir);

async function handleFetch(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const pathname = url.pathname;

	// Only guard navigation pages, not static files (which have extensions like .js, .css, etc.)
	const hasFileExtension =
		pathname.includes(".") && !pathname.endsWith(".html");

	if (!hasFileExtension && !pathname.startsWith("/api/")) {
		if (pathname === "/login") {
			const user = await getUserFromRequest(req);
			if (user) {
				return Response.redirect(new URL("/", req.url).toString(), 302);
			}
		} else if (AUTH_ENABLED) {
			const user = await getUserFromRequest(req);
			if (!user) {
				const returnTo =
					pathname === "/"
						? ""
						: `?returnTo=${encodeURIComponent(pathname + url.search)}`;
				return Response.redirect(
					new URL(`/login${returnTo}`, req.url).toString(),
					302,
				);
			}
		}
	}

	return serveStatic(req, publicDir);
}

Bun.serve({
	port: PORT,
	routes,
	fetch: handleFetch,
});

console.log(`Server listening on http://localhost:${PORT}`);
console.log("Routes:");
console.log("  GET  /health");
console.log("  GET  /api/auth/google");
console.log("  GET  /api/auth/me");
console.log("  POST /api/auth/logout");
console.log("  GET  /api/deals/undervalued?location=Yasamal&threshold=10");
console.log("  GET  /api/scrape/runs?limit=20");
console.log("  POST /api/scrape/run");

if (!IS_DEV) startCron();
