import { brotliCompressSync } from "node:zlib";
import {
	createAlert,
	deleteAlert,
	getAlerts,
} from "./controllers/alerts.controller.js";
import {
	getDealsByUrls,
	getHeatmap,
	getLocations,
	getMapPins,
	getPriceDrops,
	getTrend,
	getUndervaluedDeals,
} from "./controllers/deals.controller.js";
import { streamScrape } from "./controllers/scrape.controller.js";
import { BinaScraper } from "./scrapers/bina.scraper.js";
import { ScrapingService } from "./services/scraping.service.js";
import { handleWebhook } from "./services/telegram.service.js";
import { queryRaw } from "./utils/prisma.js";

const PORT = Number(process.env.PORT ?? 3000);
const IS_DEV = process.env.NODE_ENV === "development";

// --- Brotli helpers ---

type Handler = (req: Request) => Response | Promise<Response>;

/** Wrap a JSON API handler with brotli compression when client supports it. */
function br(handler: Handler): Handler {
	return async (req) => {
		const res = await handler(req);
		if (!(req.headers.get("Accept-Encoding") ?? "").includes("br")) return res;
		const body = await res.arrayBuffer();
		const compressed = brotliCompressSync(Buffer.from(body));
		const headers = new Headers(res.headers);
		headers.set("Content-Encoding", "br");
		headers.set("Vary", "Accept-Encoding");
		headers.delete("Content-Length");
		return new Response(compressed, { status: res.status, headers });
	};
}

/** Pre-compressed static assets: pathname → { data, contentType } */
const brAssets = new Map<string, { data: Buffer; contentType: string }>();

async function precompressStatic(dir: string) {
	const entries: Array<{ file: string; mime: string }> = [
		{ file: "app.js", mime: "application/javascript; charset=utf-8" },
		{ file: "styles.css", mime: "text/css; charset=utf-8" },
	];
	await Promise.all(
		entries.map(async ({ file, mime }) => {
			const f = Bun.file(`${dir}/${file}`);
			if (!(await f.exists())) return;
			const compressed = brotliCompressSync(Buffer.from(await f.arrayBuffer()));
			brAssets.set(`/${file}`, { data: compressed, contentType: mime });
		}),
	);
}

// Compute content hash at startup for cache busting
async function computeAssetHash(): Promise<string> {
	try {
		const publicDir = `${import.meta.dir}/../public`;
		const [js, css] = await Promise.all([
			Bun.file(`${publicDir}/app.js`).arrayBuffer(),
			Bun.file(`${publicDir}/styles.css`).arrayBuffer(),
		]);
		const hasher = new Bun.CryptoHasher("md5");
		hasher.update(js);
		hasher.update(css);
		return hasher.digest("hex").slice(0, 8);
	} catch {
		return "dev";
	}
}

const publicDir = `${import.meta.dir}/../public`;
const ASSET_VERSION = await computeAssetHash();

if (!IS_DEV) {
	await precompressStatic(publicDir);
	console.log(`Brotli pre-compressed: ${[...brAssets.keys()].join(", ")}`);
}

async function getVersionedHtml(): Promise<string> {
	const raw = await Bun.file(`${publicDir}/index.html`).text();
	const version = IS_DEV ? Date.now().toString() : ASSET_VERSION;
	return raw
		.replace('href="/styles.css"', `href="/styles.css?v=${version}"`)
		.replace('src="/app.js"', `src="/app.js?v=${version}"`);
}

console.log(`Asset version: ${ASSET_VERSION}`);

Bun.serve({
	port: PORT,
	routes: {
		"/health": {
			GET: br(async () => {
				const result = await queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count FROM "Property"
        `;
				const count = Number(result[0]?.count ?? 0);
				return Response.json({
					status: "ok",
					timestamp: new Date().toISOString(),
					properties: count,
				});
			}),
		},
		"/api/deals/locations": { GET: br(getLocations) },
		"/api/deals/trend": { GET: br(getTrend) },
		"/api/deals/undervalued": { GET: br(getUndervaluedDeals) },
		"/api/deals/price-drops": { GET: br(getPriceDrops) },
		"/api/deals/map-pins": { GET: br(getMapPins) },
		"/api/deals/by-urls": { POST: br(getDealsByUrls) },
		"/api/heatmap": { GET: br(getHeatmap) },
		"/api/scrape/stream": { GET: streamScrape }, // SSE — no compression
		"/api/alerts": { GET: br(getAlerts), POST: br(createAlert) },
		"/api/alerts/:token": { DELETE: br(deleteAlert) },
		"/api/telegram/webhook": { POST: br(handleWebhook) },
	},
	async fetch(req) {
		const url = new URL(req.url);
		const pathname = url.pathname;
		const acceptsBr = (req.headers.get("Accept-Encoding") ?? "").includes("br");

		// Serve pre-compressed static assets (strip query string for lookup)
		const asset = brAssets.get(pathname);
		if (!IS_DEV && acceptsBr && asset) {
			return new Response(asset.data, {
				headers: {
					"Content-Type": asset.contentType,
					"Content-Encoding": "br",
					"Cache-Control": "public, max-age=31536000, immutable",
					Vary: "Accept-Encoding",
				},
			});
		}

		const filePath = `${publicDir}${pathname}`;
		const file = Bun.file(filePath);
		if (await file.exists()) {
			return new Response(file, {
				headers: IS_DEV ? { "Cache-Control": "no-store" } : {},
			});
		}
		// SPA fallback — read fresh so frontend rebuilds are reflected immediately
		return new Response(await getVersionedHtml(), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	},
});

console.log(`Server listening on http://localhost:${PORT}`);
console.log("Routes:");
console.log("  GET  /health");
console.log("  GET  /api/deals/undervalued?location=Yasamal&threshold=10");
console.log("  GET  /api/scrape/stream?maxPages=20&delayMs=800");

// Hourly cron: scrape 40 pages every 60 minutes = 1000items
const cronService = new ScrapingService([new BinaScraper()]);
const CRON_INTERVAL_MS = 60 * 60 * 1000;

let scrapeRunning = false;

async function runCronScrape() {
	if (scrapeRunning) {
		console.log("[Cron] Previous scrape still running, skipping this tick.");
		return;
	}
	scrapeRunning = true;
	console.log("[Cron] Hourly scrape started", new Date().toISOString());
	try {
		const results = await cronService.runAll({ maxPages: 40, delayMs: 800 });
		const total = results.reduce((sum, r) => sum + r.persisted, 0);
		console.log(`[Cron] Hourly scrape done — persisted=${total}`);
	} catch (err) {
		console.error("[Cron] Hourly scrape failed:", err);
	} finally {
		scrapeRunning = false;
	}
}

setInterval(runCronScrape, CRON_INTERVAL_MS);
console.log(
	`[Cron] Hourly scrape scheduled (every ${CRON_INTERVAL_MS / 60000} min)`,
);
