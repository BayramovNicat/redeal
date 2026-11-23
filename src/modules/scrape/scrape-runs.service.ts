import type { Prisma, ScrapeRun, ScrapeRunTrigger } from "@prisma/client";
import { invalidateDealsCaches } from "@/modules/deals/deals.service.js";
import type {
	ScrapeProgressEvent,
	ScraperOptions,
} from "@/scrapers/base.scraper.js";
import { BinaScraper } from "@/scrapers/bina.scraper.js";
import { prisma } from "@/utils/prisma.js";
import { acquireLock, releaseLock } from "@/utils/scrape-lock.js";
import { type ScrapeResult, ScrapingService } from "./scrape.service.js";

export type ScrapeRunRow = ScrapeRun;

export class ScrapeRunsService {
	private readonly scrapingService = new ScrapingService([new BinaScraper()]);

	async run(
		trigger: ScrapeRunTrigger,
		options: ScraperOptions = {},
		onProgress?: (event: ScrapeProgressEvent) => void,
	): Promise<ScrapeRunRow> {
		const startedAt = new Date();
		const storedOptions = this.serializeOptions(options);
		let locked = false;

		try {
			locked = acquireLock();
			if (!locked) {
				onProgress?.({
					type: "error",
					platform: "server",
					message: "A scrape is already in progress",
				});

				const runningRun = await prisma.scrapeRun.findFirst({
					where: { status: "running" },
					orderBy: { started_at: "desc" },
				});
				if (runningRun) return runningRun;

				return prisma.scrapeRun.create({
					data: {
						trigger,
						status: "skipped",
						started_at: startedAt,
						finished_at: startedAt,
						duration_ms: 0,
						...(storedOptions ? { options: storedOptions } : {}),
						platform_results: [],
						total_fetched: 0,
						total_persisted: 0,
						total_skipped: 0,
						total_errors: 0,
						error_message: "A scrape is already in progress",
					},
				});
			}

			const stats = this.createStats();
			const run = await prisma.scrapeRun.create({
				data: {
					trigger,
					status: "running",
					started_at: startedAt,
					...(storedOptions ? { options: storedOptions } : {}),
					platform_results: [],
					total_fetched: 0,
					total_persisted: 0,
					total_skipped: 0,
					total_errors: 0,
				},
			});

			const progressHandler = (event: ScrapeProgressEvent) => {
				this.updateStats(stats, event);
				onProgress?.(event);
			};

			try {
				const results = await this.scrapingService.runAll({
					...options,
					onProgress: progressHandler,
				});
				invalidateDealsCaches();

				const finishedAt = new Date();
				const summary = this.buildSummary(stats, results);
				const status = summary.totalErrors > 0 ? "failed" : "success";
				return await prisma.scrapeRun.update({
					where: { id: run.id },
					data: {
						status,
						finished_at: finishedAt,
						duration_ms: finishedAt.getTime() - startedAt.getTime(),
						total_fetched: summary.totalFetched,
						total_persisted: summary.totalPersisted,
						total_skipped: summary.totalSkipped,
						total_errors: summary.totalErrors,
						platform_results: summary.platformResults,
						error_message:
							status === "failed" ? this.errorMessage(results) : null,
					},
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				const finishedAt = new Date();
				const summary = this.buildSummary(stats);
				const failedRun = await prisma.scrapeRun.update({
					where: { id: run.id },
					data: {
						status: "failed",
						finished_at: finishedAt,
						duration_ms: finishedAt.getTime() - startedAt.getTime(),
						total_fetched: summary.totalFetched,
						total_persisted: summary.totalPersisted,
						total_skipped: summary.totalSkipped,
						total_errors: summary.totalErrors,
						platform_results: summary.platformResults,
						error_message: message,
					},
				});
				onProgress?.({ type: "error", platform: "server", message });
				return failedRun;
			}
		} finally {
			if (locked) releaseLock();
		}
	}

	async list(limit = 20): Promise<ScrapeRunRow[]> {
		return prisma.scrapeRun.findMany({
			orderBy: { started_at: "desc" },
			take: limit,
		});
	}

	private createStats(): RunStats {
		return { platforms: new Map<string, PlatformSummary>() };
	}

	private serializeOptions(options: ScraperOptions): StoredRunOptions | null {
		const { onProgress: _onProgress, ...rest } = options;
		const stored: StoredRunOptions = {};
		if (typeof rest.maxPages === "number") stored.maxPages = rest.maxPages;
		if (typeof rest.startPage === "number") stored.startPage = rest.startPage;
		if (typeof rest.endPage === "number") stored.endPage = rest.endPage;
		if (typeof rest.delayMs === "number") stored.delayMs = rest.delayMs;
		if (typeof rest.listingType === "string")
			stored.listingType = rest.listingType;
		if (typeof rest.categoryId === "string")
			stored.categoryId = rest.categoryId;
		return Object.keys(stored).length > 0 ? stored : null;
	}

	private getPlatform(stats: RunStats, platform: string): PlatformSummary {
		let summary = stats.platforms.get(platform);
		if (!summary) {
			summary = {
				platform,
				fetched: 0,
				persisted: 0,
				skipped: 0,
				errors: 0,
			};
			stats.platforms.set(platform, summary);
		}
		return summary;
	}

	private updateStats(stats: RunStats, event: ScrapeProgressEvent): void {
		if (event.type === "complete") return;
		if (event.type === "start") return;

		const platform = this.getPlatform(stats, event.platform);
		if (event.type === "page") {
			platform.fetched = Math.max(platform.fetched, event.total);
			return;
		}

		if (event.type === "persisting") {
			platform.fetched = Math.max(platform.fetched, event.count);
			return;
		}

		if (event.type === "done") {
			platform.persisted = event.persisted;
			platform.skipped = event.skipped;
			return;
		}

		if (event.type === "error") {
			platform.errors += 1;
		}
	}

	private errorMessage(results: ScrapeResult[]): string {
		return results
			.flatMap((result) => result.errors)
			.filter((message) => message.length > 0)
			.join("; ");
	}

	private buildSummary(
		stats: RunStats,
		results?: ScrapeResult[],
	): {
		totalFetched: number;
		totalPersisted: number;
		totalSkipped: number;
		totalErrors: number;
		platformResults: Prisma.JsonArray;
	} {
		const errorsByPlatform = new Map(
			(results ?? []).map((result) => [result.platform, result.errors.length]),
		);
		const platformResults = Array.from(stats.platforms.values()).map(
			(summary) => ({
				platform: summary.platform,
				fetched: summary.fetched,
				persisted: summary.persisted,
				skipped: summary.skipped,
				errors: Math.max(
					summary.errors,
					errorsByPlatform.get(summary.platform) ?? 0,
				),
			}),
		);

		if (results && platformResults.length === 0) {
			for (const result of results) {
				platformResults.push({
					platform: result.platform,
					fetched: result.persisted + result.skipped + result.errors.length,
					persisted: result.persisted,
					skipped: result.skipped,
					errors: result.errors.length,
				});
			}
		}

		const totalFetched = platformResults.reduce(
			(sum, row) => sum + row.fetched,
			0,
		);
		const totalPersisted = results
			? results.reduce((sum, result) => sum + result.persisted, 0)
			: platformResults.reduce((sum, row) => sum + row.persisted, 0);
		const totalSkipped = results
			? results.reduce((sum, result) => sum + result.skipped, 0)
			: platformResults.reduce((sum, row) => sum + row.skipped, 0);
		const totalErrors = results
			? results.reduce((sum, result) => sum + result.errors.length, 0)
			: platformResults.reduce((sum, row) => sum + row.errors, 0);

		return {
			totalFetched,
			totalPersisted,
			totalSkipped,
			totalErrors,
			platformResults: platformResults as unknown as Prisma.JsonArray,
		};
	}
}

type StoredRunOptions = {
	maxPages?: number;
	startPage?: number;
	endPage?: number;
	delayMs?: number;
	listingType?: "sale" | "rent";
	categoryId?: string;
};

type PlatformSummary = {
	platform: string;
	fetched: number;
	persisted: number;
	skipped: number;
	errors: number;
};

type RunStats = {
	platforms: Map<string, PlatformSummary>;
};

export const scrapeRunsService = new ScrapeRunsService();
