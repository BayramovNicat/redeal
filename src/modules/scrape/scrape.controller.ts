import { runAlerts } from "@/modules/alerts/alerts.service.js";
import type { ScrapeProgressEvent } from "@/scrapers/base.scraper.js";
import { BinaScraper } from "@/scrapers/bina.scraper.js";
import { parseQueryNum } from "@/utils/query.js";
import { acquireLock, releaseLock } from "@/utils/scrape-lock.js";
import { ScrapingService } from "./scrape.service.js";

const scrapingService = new ScrapingService([new BinaScraper()]);

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	Connection: "keep-alive",
} as const;

export function streamScrape(req: Request): Response {
	const q = new URL(req.url).searchParams;
	const encoder = new TextEncoder();

	function encodeEvent(event: ScrapeProgressEvent): Uint8Array {
		return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
	}

	if (!acquireLock()) {
		const body = encodeEvent({
			type: "error",
			platform: "server",
			message: "A scrape is already in progress",
		});
		return new Response(body, { headers: SSE_HEADERS });
	}

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: ScrapeProgressEvent) => {
				controller.enqueue(encodeEvent(event));
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
				await runAlerts();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error("[ScrapeController] streamScrape:", err);
				send({ type: "error", platform: "server", message });
			} finally {
				releaseLock();
				controller.close();
			}
		},
	});

	return new Response(stream, { headers: SSE_HEADERS });
}
