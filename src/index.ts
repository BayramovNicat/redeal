import { IS_DEV, PORT } from "@/config.js";
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
		if (pathname === "/admin") {
			return Response.redirect(new URL("/", req.url).toString(), 302);
		}
		if (pathname === "/login") {
			const user = await getUserFromRequest(req);
			if (user) {
				return Response.redirect(new URL("/", req.url).toString(), 302);
			}
		}
	}

	return serveStatic(req, publicDir);
}

const MAX_PORT_ATTEMPTS = 20;

function startServer(initialPort: number) {
	const maxAttempts = IS_DEV ? MAX_PORT_ATTEMPTS : 1;

	for (let offset = 0; offset < maxAttempts; offset++) {
		const port = initialPort + offset;
		try {
			const server = Bun.serve({
				port,
				routes,
				fetch: handleFetch,
			});
			const boundPort = server.port ?? port;
			if (offset > 0) {
				console.log(
					`Port ${initialPort} is in use, using ${boundPort} instead.`,
				);
			}
			return { server, port: boundPort };
		} catch (error) {
			const code = (error as { code?: string })?.code;
			if (code !== "EADDRINUSE" || offset === maxAttempts - 1) {
				throw error;
			}
		}
	}

	throw new Error(`No available port found starting at ${initialPort}`);
}

const { port: boundPort } = startServer(PORT);

console.log(`Server listening on http://localhost:${boundPort}`);
console.log("Routes:");
console.log("  GET  /health");
console.log("  GET  /api/auth/google");
console.log("  GET  /api/auth/me");
console.log("  POST /api/auth/logout");
console.log("  GET  /api/deals/undervalued?location=Yasamal&threshold=10");
console.log("  GET  /api/scrape/runs?limit=20");
console.log("  POST /api/scrape/run");

if (!IS_DEV) startCron();
