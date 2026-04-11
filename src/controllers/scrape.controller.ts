import type { ScrapeProgressEvent } from "../scrapers/base.scraper.js";
import { BinaScraper } from "../scrapers/bina.scraper.js";
import { ScrapingService } from "../services/scraping.service.js";

const scrapingService = new ScrapingService([new BinaScraper()]);

/**
 * GET /api/scrape/stream
 *
 * Streams Server-Sent Events with live scrape progress.
 * Optional query params: maxPages, startPage, endPage, delayMs
 */
export function streamScrape(req: Request): Response {
	const url = new URL(req.url);
	const q = url.searchParams;

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: ScrapeProgressEvent) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
				);
			};

			const maxPages = q.get("maxPages");
			const startPage = q.get("startPage");
			const endPage = q.get("endPage");
			const delayMs = q.get("delayMs");

			const options = {
				maxPages: maxPages !== null ? parseInt(maxPages, 10) : 20,
				startPage: startPage !== null ? parseInt(startPage, 10) : undefined,
				endPage: endPage !== null ? parseInt(endPage, 10) : undefined,
				delayMs: delayMs !== null ? parseInt(delayMs, 10) : 800,
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
