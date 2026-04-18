import { runAlerts } from "@/modules/alerts/alerts.service.js";
import { ScrapingService } from "@/modules/scrape/scrape.service.js";
import { BinaScraper } from "@/scrapers/bina.scraper.js";
import { acquireLock, releaseLock } from "@/utils/scrape-lock.js";

export function startCron(): void {
	const cronService = new ScrapingService([new BinaScraper()]);

	async function runCronScrape() {
		if (!acquireLock()) {
			console.log("[Cron] Previous scrape still running, skipping this tick.");
			return;
		}
		console.log("[Cron] Hourly scrape started", new Date().toISOString());
		try {
			const results = await cronService.runAll({ maxPages: 40, delayMs: 800 });
			const total = results.reduce((sum, r) => sum + r.persisted, 0);
			console.log(`[Cron] Hourly scrape done — persisted=${total}`);
			await runAlerts();
		} catch (err) {
			console.error("[Cron] Hourly scrape failed:", err);
		} finally {
			releaseLock();
		}
	}

	function scheduleNext() {
		const now = new Date();
		const next = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			now.getHours() + 1,
			0,
			0,
			0,
		);
		const delay = next.getTime() - now.getTime();

		console.log(
			`[Cron] Next hourly scrape scheduled in ${Math.round(delay / 60000)} min (at ${next.toISOString()})`,
		);

		setTimeout(async () => {
			await runCronScrape();
			scheduleNext();
		}, delay);
	}

	runCronScrape();
	scheduleNext();
}
