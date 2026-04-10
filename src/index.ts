import { getUndervaluedDeals } from './controllers/deals.controller.js';
import { streamScrape } from './controllers/scrape.controller.js';
import { ScrapingService } from './services/scraping.service.js';
import { BinaScraper } from './scrapers/bina.scraper.js';
import { prisma } from './utils/prisma.js';

const PORT = Number(process.env['PORT'] ?? 3000);

Bun.serve({
  port: PORT,
  routes: {
    '/health': {
      GET: async () => {
        const count = await prisma.property.count();
        return Response.json({ status: 'ok', timestamp: new Date().toISOString(), properties: count });
      },
    },
    '/api/deals/undervalued': { GET: getUndervaluedDeals },
    '/api/scrape/stream':     { GET: streamScrape },
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
console.log('Routes:');
console.log('  GET  /health');
console.log('  GET  /api/deals/undervalued?location=Yasamal&threshold=10');
console.log('  GET  /api/scrape/stream?maxPages=20&delayMs=800');

// Hourly cron: scrape 20 pages every 60 minutes
const cronService = new ScrapingService([new BinaScraper()]);
const CRON_INTERVAL_MS = 60 * 60 * 1000;

async function runCronScrape() {
  console.log('[Cron] Hourly scrape started', new Date().toISOString());
  try {
    const results = await cronService.runAll({ maxPages: 20, delayMs: 800 });
    const total = results.reduce((sum, r) => sum + r.persisted, 0);
    console.log(`[Cron] Hourly scrape done — persisted=${total}`);
  } catch (err) {
    console.error('[Cron] Hourly scrape failed:', err);
  }
}

setInterval(runCronScrape, CRON_INTERVAL_MS);
console.log(`[Cron] Hourly scrape scheduled (every ${CRON_INTERVAL_MS / 60000} min)`);
