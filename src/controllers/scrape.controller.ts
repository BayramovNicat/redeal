import type { Request, Response } from 'express';
import { ScrapingService } from '../services/scraping.service.js';
import { BinaScraper } from '../scrapers/bina.scraper.js';
import type { ScrapeProgressEvent } from '../scrapers/base.scraper.js';

/** All active scrapers. Add new platform scrapers here. */
const scrapingService = new ScrapingService([new BinaScraper()]);

/**
 * POST /api/scrape/trigger
 *
 * Optional JSON body:
 *   { maxPages?: number, delayMs?: number }
 *
 * maxPages controls how many 25-listing pages to fetch per scraper (default: 20).
 * startPage controls from which page to begin fetching (default: 1).
 * endPage controls exactly at which page to stop (overrides maxPages).
 * delayMs controls the pause between pages in ms (default: 800).
 */
export async function triggerScrape(req: Request, res: Response): Promise<void> {
  const { maxPages, startPage, endPage, delayMs } = req.body as Record<string, unknown>;

  const options = {
    maxPages: typeof maxPages === 'number' ? maxPages : 20,
    startPage: typeof startPage === 'number' ? startPage : undefined,
    endPage: typeof endPage === 'number' ? endPage : undefined,
    delayMs: typeof delayMs === 'number' ? delayMs : 800,
  };

  try {
    console.log('[ScrapeController] Manual scrape triggered', options);
    const results = await scrapingService.runAll(options);
    const totalPersisted = results.reduce((sum, r) => sum + r.persisted, 0);
    res.json({ message: 'Scrape completed', total_persisted: totalPersisted, results });
  } catch (err) {
    console.error('[ScrapeController] triggerScrape:', err);
    res.status(500).json({ error: 'Scrape job failed' });
  }
}

/**
 * GET /api/scrape/stream
 *
 * Same as /trigger but streams Server-Sent Events so the caller sees live progress.
 * Optional query params: maxPages, delayMs
 *
 * Each event line:  data: <JSON>\n\n
 * Event types: start | page | persisting | done | error | complete
 */
export async function streamScrape(req: Request, res: Response): Promise<void> {
  const { maxPages, startPage, endPage, delayMs } = req.query as Record<string, string | undefined>;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: ScrapeProgressEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const options = {
    maxPages: maxPages !== undefined ? parseInt(maxPages, 10) : 20,
    startPage: startPage !== undefined ? parseInt(startPage, 10) : undefined,
    endPage: endPage !== undefined ? parseInt(endPage, 10) : undefined,
    delayMs: delayMs !== undefined ? parseInt(delayMs, 10) : 800,
    onProgress: send,
  };

  try {
    console.log('[ScrapeController] Streaming scrape triggered', { maxPages: options.maxPages });
    await scrapingService.runAll(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ScrapeController] streamScrape:', err);
    send({ type: 'error', platform: 'server', message });
  } finally {
    res.end();
  }
}
