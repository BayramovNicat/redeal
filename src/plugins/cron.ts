import { runAlerts } from "@/modules/alerts/alerts.service.js";
import { scrapeRunsService } from "@/modules/scrape/scrape-runs.service.js";

const JITTER_MIN_MS = 2 * 60_000;
const JITTER_MAX_MS = 17 * 60_000;

export function getNextHourlyDelayMs(now = new Date()): {
	next: Date;
	delayMs: number;
} {
	const nextHour = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		now.getHours() + 1,
		0,
		0,
		0,
	);
	const jitterMs =
		JITTER_MIN_MS +
		Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1));
	const next = new Date(nextHour.getTime() + jitterMs);
	return { next, delayMs: next.getTime() - now.getTime() };
}

export function startCron(): void {
	async function runCronScrape() {
		console.log("[Cron] Hourly scrape started", new Date().toISOString());
		try {
			const run = await scrapeRunsService.run("cron", {
				maxPages: 4,
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
		const { next, delayMs } = getNextHourlyDelayMs();

		console.log(
			`[Cron] Next hourly scrape scheduled in ${Math.round(delayMs / 60000)} min (at ${next.toISOString()})`,
		);

		setTimeout(async () => {
			await runCronScrape();
			scheduleNext();
		}, delayMs);
	}

	scheduleNext();
}
