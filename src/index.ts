import {
	getDealsByUrls,
	getHeatmap,
	getLocations,
	getTrend,
	getUndervaluedDeals,
} from "./controllers/deals.controller.js";
import { createAlert, deleteAlert } from "./controllers/alerts.controller.js";
import { streamScrape } from "./controllers/scrape.controller.js";
import { BinaScraper } from "./scrapers/bina.scraper.js";
import { ScrapingService } from "./services/scraping.service.js";
import { runAlerts } from "./services/alert.service.js";
import { handleWebhook } from "./services/telegram.service.js";
import { queryRaw } from "./utils/prisma.js";

const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
	port: PORT,
	routes: {
		"/health": {
			GET: async () => {
				const result = await queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count FROM "Property"
        `;
				const count = Number(result[0]?.count ?? 0);
				return Response.json({
					status: "ok",
					timestamp: new Date().toISOString(),
					properties: count,
				});
			},
		},
		"/api/deals/locations": { GET: getLocations },
		"/api/deals/trend": { GET: getTrend },
		"/api/deals/undervalued": { GET: getUndervaluedDeals },
		"/api/deals/by-urls": { POST: getDealsByUrls },
		"/api/heatmap": { GET: getHeatmap },
		"/api/scrape/stream": { GET: streamScrape },
		"/api/alerts": { POST: createAlert },
		"/api/alerts/:token": { DELETE: deleteAlert },
		"/api/telegram/webhook": { POST: handleWebhook },
	},
	async fetch(req) {
		const url = new URL(req.url);
		const filePath = `${import.meta.dir}/../public${url.pathname}`;
		const file = Bun.file(filePath);
		if (await file.exists()) return new Response(file);
		// SPA fallback
		return new Response(Bun.file(`${import.meta.dir}/../public/index.html`));
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
		await runAlerts();
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
