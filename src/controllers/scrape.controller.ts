import type { ScrapeProgressEvent } from "../scrapers/base.scraper.js";
import { BinaScraper } from "../scrapers/bina.scraper.js";
import { ScrapingService } from "../services/scraping.service.js";
import { parseQueryNum } from "../utils/query.js";

const scrapingService = new ScrapingService([new BinaScraper()]);

/**
 * GET /api/scrape/stream
 *
 * Streams Server-Sent Events with live scrape progress.
 * Optional query params: maxPages, startPage, endPage, delayMs
 */
export function streamScrape(req: Request): Response {
	const q = new URL(req.url).searchParams;

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: ScrapeProgressEvent) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			};

			const options = {
				maxPages: parseQueryNum(q.get("maxPages")) ?? 20,
				startPage: parseQueryNum(q.get("startPage")),
				endPage: parseQueryNum(q.get("endPage")),
				delayMs: parseQueryNum(q.get("delayMs")) ?? 800,
				onProgress: send,
			};

			try {
				console.log("[ScrapeController] Streaming scrape triggered", {
					maxPages: options.maxPages,
				});
				await scrapingService.runAll(options);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error("[ScrapeController] streamScrape:", err);
				send({ type: "error", platform: "server", message });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
