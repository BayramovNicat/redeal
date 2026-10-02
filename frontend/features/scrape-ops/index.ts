import { t } from "@/core/i18n";
import { html, makeEventManager, timeAgo } from "@/core/utils";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Icons } from "@/ui/icons";
import { StatBox } from "@/ui/stat-box";
import {
	fetchScrapeAdminSession,
	fetchScrapeRuns,
	runScrapeNow,
} from "./api";
import type { ScrapeRun } from "./types";

const state = {
	initialized: false,
	loading: false,
	running: false,
	runs: [] as ScrapeRun[],
};

const ui = {
	modal: null as unknown as HTMLDialogElement,
	subtitle: html`<div class="text-xs text-(--muted) mt-0.5"></div>`,
	loading: html`<div class="hidden py-8 px-6 text-sm text-(--muted)">${t("scrapeRunLoading")}</div>`,
	error: html`<div class="hidden mx-6 my-4 rounded-(--r) border border-(--red-b) bg-(--red-dim) px-4 py-3 text-sm text-(--red)"></div>`,
	runs: html`<div class="flex flex-col gap-2 p-5"></div>`,
	stats: html`<div class="grid grid-cols-2 sm:grid-cols-4 gap-2"></div>`,
	runBtn: null as unknown as HTMLButtonElement,
};

const ev = makeEventManager();

export function initScrapeOps(root: HTMLElement): () => void {
	if (state.initialized) return () => {};

	ui.runBtn = Button({
		content: t("runNow"),
		variant: "base",
		color: "solid",
		onclick: () => void handleRunNow(),
	});

	ui.modal = Dialog({
		maxWidth: "860px",
		className: "p-0 overflow-hidden",
		title: t("scrapeRuns"),
		description: ui.subtitle,
		content: html`
			<div class="flex flex-col h-[80vh] max-h-[80vh] text-(--text)">
				<div class="flex flex-col gap-4 p-5 border-b border-(--border) bg-(--surface)">
					<div class="flex items-center justify-between gap-3">
						<div class="text-[10px] font-bold text-(--muted) uppercase tracking-widest opacity-70">
							${t("scrapeRunOptions")}
						</div>
						${ui.runBtn}
					</div>
					${ui.stats}
				</div>
				<div class="flex-1 overflow-y-auto min-h-0 bg-(--bg)">
					${ui.loading}
					${ui.error}
					${ui.runs}
					${EmptyState({
						icon: Icons.spinner({ size: 36, className: "text-(--muted)" }),
						title: t("scrapeRunEmpty"),
						hidden: true,
					})}
				</div>
			</div>
		`,
	}) as HTMLDialogElement;

	root.appendChild(ui.modal);
	state.initialized = true;

	return () => {
		ui.modal?.remove();
		state.initialized = false;
		ev.cleanup();
	};
}

export function openScrapeOps(): void {
	ui.modal?.showModal();
	void fetchScrapeAdminSession();
	void loadRuns();
}

async function loadRuns(): Promise<void> {
	state.loading = true;
	ui.loading.classList.remove("hidden");
	ui.error.classList.add("hidden");

	try {
		state.runs = await fetchScrapeRuns(20);
		renderRuns();
	} catch (err) {
		ui.error.textContent =
			err instanceof Error ? err.message : t("scrapeRunError");
		ui.error.classList.remove("hidden");
	} finally {
		state.loading = false;
		ui.loading.classList.add("hidden");
	}
}

async function handleRunNow(): Promise<void> {
	if (state.running) return;

	state.running = true;
	setRunButtonState();
	ui.error.classList.add("hidden");

	try {
		await runScrapeNow();
		await loadRuns();
	} catch (err) {
		ui.error.textContent =
			err instanceof Error ? err.message : t("scrapeRunError");
		ui.error.classList.remove("hidden");
	} finally {
		state.running = false;
		setRunButtonState();
	}
}

function setRunButtonState(): void {
	ui.runBtn.disabled = state.running;
	ui.runBtn.textContent = state.running ? t("scrapeRunRunning") : t("runNow");
}

function renderRuns(): void {
	ui.runs.replaceChildren();
	ui.stats.replaceChildren();

	const summary = state.runs[0];
	ui.subtitle.textContent = summary
		? `${t("scrapeRunSubtitle")} • ${timeAgo(summary.started_at) ?? ""}`
		: t("scrapeRunSubtitle");

	ui.stats.append(
		StatBox({ label: t("scrapeRunFetched"), value: total("total_fetched") }),
		StatBox({
			label: t("scrapeRunPersisted"),
			value: total("total_persisted"),
		}),
		StatBox({ label: t("scrapeRunSkipped"), value: total("total_skipped") }),
		StatBox({ label: t("scrapeRunErrors"), value: total("total_errors") }),
	);

	if (state.runs.length === 0) {
		ui.runs.appendChild(
			EmptyState({
				icon: Icons.search({ size: 36, className: "text-(--muted)" }),
				title: t("scrapeRunEmpty"),
				hidden: false,
			}),
		);
		return;
	}

	for (const run of state.runs) {
		ui.runs.appendChild(renderRun(run));
	}
}

function renderRun(run: ScrapeRun): HTMLElement {
	const platformText = (run.platform_results ?? [])
		.map((p) => `${p.platform}: ${p.persisted}/${p.fetched}`)
		.join(" · ");
	const meta = html`<div class="flex items-center gap-2 flex-wrap text-xs text-(--muted)"></div>`;
	meta.append(
		statusPill(run.status),
		textEl("span", run.trigger, "uppercase tracking-wide"),
		textEl("span", timeAgo(run.started_at) ?? "—", ""),
	);

	const card = html`
		<div class="rounded-(--r) border border-(--border) bg-(--surface) px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-colors hover:border-(--border-h)">
			<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div class="flex flex-col gap-2 min-w-0">
					${meta}
					<div class="text-sm font-semibold text-(--text) truncate">${fmtDuration(run.duration_ms)}</div>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs shrink-0 lg:min-w-105">
					${StatBox({ label: t("scrapeRunFetched"), value: run.total_fetched })}
					${StatBox({ label: t("scrapeRunPersisted"), value: run.total_persisted })}
					${StatBox({ label: t("scrapeRunSkipped"), value: run.total_skipped })}
					${StatBox({ label: t("scrapeRunErrors"), value: run.total_errors })}
				</div>
			</div>
		</div>
	`;

	if (platformText) {
		card.appendChild(
			textEl(
				"div",
				platformText,
				"mt-3 border-t border-(--border)/50 pt-3 text-[11px] text-(--muted)",
			),
		);
	}
	if (run.error_message) {
		card.appendChild(
			textEl(
				"div",
				run.error_message,
				"mt-3 rounded-(--r-sm) border border-(--red-b) bg-(--red-dim) px-3 py-2 text-xs text-(--red)",
			),
		);
	}

	return card;
}

function statusPill(status: string): HTMLElement {
	const isSuccess = status === "success";
	const isRunning = status === "running";
	const classes = isSuccess
		? "border-(--green-b) bg-(--green-dim) text-(--green)"
		: isRunning
			? "border-(--blue-b) bg-(--blue-dim) text-(--blue)"
			: "border-(--red-b) bg-(--red-dim) text-(--red)";

	return textEl(
		"span",
		status,
		`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${classes}`,
	);
}

function textEl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text: string,
	className: string,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	el.className = className;
	el.textContent = text;
	return el;
}

function total(
	key: keyof Pick<
		ScrapeRun,
		"total_fetched" | "total_persisted" | "total_skipped" | "total_errors"
	>,
): number {
	return state.runs.reduce((sum, run) => sum + (run[key] ?? 0), 0);
}

function fmtDuration(ms: number | null): string {
	if (ms === null) return "—";
	const sec = Math.max(0, Math.round(ms / 1000));
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	const rem = sec % 60;
	return `${min}m ${rem}s`;
}
