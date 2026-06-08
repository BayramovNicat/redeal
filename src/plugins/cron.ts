import { runAlerts } from "@/modules/alerts/alerts.service.js";
import { scrapeRunsService } from "@/modules/scrape/scrape-runs.service.js";

export function startCron(): void {
	async function runCronScrape() {
		console.log("[Cron] Hourly scrape started", new Date().toISOString());
		try {
			const run = await scrapeRunsService.run("cron", {
				maxPages: 10,
				delayMs: 800,
				listingType: "sale",
				categoryId: "1",
			});
			if (run.status === "success") {
				await runAlerts();
			}
			console.log(`[Cron] Hourly scrape done — status=${run.status}`);
		} catch (err) {
			console.error("[Cron] Hourly scrape failed:", err);
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

	scheduleNext();
}
