import { t } from "@/core/i18n";
import { html, makeEventManager } from "@/core/utils";
import { RawButton } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { getProcessedData } from "./logic";
import { renderSearchBar } from "./search";
import { DataRow, renderSortHeader } from "./table";
import type {
	DistrictStatsState,
	DistrictStatsUI,
	LocationRow,
	SortKey,
} from "./types";

const CACHE_TTL = 15 * 60_000;

const state: DistrictStatsState = {
	cachedData: null,
	cachedAt: 0,
	sortKey: "avg_ppsm",
	sortDir: "desc",
	filterQuery: "",
	isInitialized: false,
};

const ui: DistrictStatsUI = {
	subtitle: html`<div class="text-xs text-(--muted) mt-0.5"></div>`,
	loading: createLoadingSkeleton(),
	table: null as unknown as HTMLTableElement,
	tbody: html`<tbody></tbody>`,
	error: null as unknown as HTMLElement,
	empty: html`
		<div class="hidden py-20 text-center">
			<div class="text-(--muted) text-sm">${t("districtEmpty")}</div>
		</div>
	`,
	search: null as unknown as HTMLInputElement,
	clear: null as unknown as HTMLButtonElement,
	dialogEl: null,
	sortIndicators: {} as Record<SortKey, HTMLElement>,
	sortHeaders: {} as Record<SortKey, HTMLElement>,
};

const ev = makeEventManager();

export function initDistrictStats(root: HTMLElement): () => void {
	if (state.isInitialized) return () => {};

	const retryBtn = RawButton({
		className:
			"px-4 py-2 bg-(--surface-3) rounded-(--r-sm) text-xs font-medium hover:bg-(--surface-4) transition-colors",
		content: "Retry",
		onclick: () => void loadStats(),
	});

	ui.error = html`
		<div class="hidden py-20 text-center">
			<div class="text-(--muted) mb-4 text-sm">${t("districtError")}</div>
			${retryBtn}
		</div>
	`;

	const onSort = (key: SortKey) => {
		if (state.sortKey === key) {
			state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
		} else {
			state.sortKey = key;
			state.sortDir = key === "district" ? "asc" : "desc";
		}
		renderTable();
	};

	ui.table = html`
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="border-b border-(--border) sticky top-0 bg-(--surface)/95 backdrop-blur-md z-10">
					${renderSortHeader(ui, "district", t("districtCol"), "left", () =>
						onSort("district"),
					)}
					${renderSortHeader(
						ui,
						"avg_ppsm",
						t("districtAvgPpsm"),
						"right",
						() => onSort("avg_ppsm"),
					)}
					${renderSortHeader(
						ui,
						"listing_count",
						t("districtListings"),
						"right",
						() => onSort("listing_count"),
					)}
					${renderSortHeader(ui, "trend", t("districtTrend"), "center", () =>
						onSort("trend"),
					)}
				</tr>
			</thead>
			${ui.tbody}
		</table>
	` as HTMLTableElement;

	ui.dialogEl = Dialog({
		id: "district-stats-modal",
		maxWidth: "640px",
		className: "text-(--text)",
		title: t("districtStats"),
		description: ui.subtitle,
		content: html`
			<div class="flex flex-col h-150 max-h-[82vh]">
				<div class="px-6 py-3.5 border-b border-(--border) bg-(--surface) shrink-0">
					${renderSearchBar(
						ui,
						(val) => {
							state.filterQuery = val;
							ui.clear.classList.toggle("visible", val.length > 0);
							renderTable();
						},
						() => {
							state.filterQuery = "";
							renderTable();
						},
					)}
				</div>

				<div class="flex-1 overflow-y-auto min-h-0">
					${ui.loading} ${ui.table} ${ui.error} ${ui.empty}
				</div>
			</div>
		`,
	}) as HTMLDialogElement;

	root.appendChild(ui.dialogEl);
	state.isInitialized = true;

	return () => {
		ui.dialogEl?.remove();
		state.isInitialized = false;
		ev.cleanup();
	};
}

function renderTable(): void {
	if (state.cachedData === null) return;
	const data = getProcessedData(state);
	ui.tbody.replaceChildren();

	if (data.length === 0) {
		ui.table.classList.add("hidden");
		ui.empty.classList.remove("hidden");
	} else {
		ui.table.classList.remove("hidden");
		ui.empty.classList.add("hidden");

		const fragment = document.createDocumentFragment();
		data.forEach((row) => {
			fragment.appendChild(DataRow(row));
		});
		ui.tbody.appendChild(fragment);
	}

	// Sync sort indicators
	const cols: SortKey[] = ["district", "avg_ppsm", "listing_count", "trend"];
	for (const col of cols) {
		const th = ui.sortHeaders[col];
		const indicator = ui.sortIndicators[col];
		const isActive = col === state.sortKey;

		indicator.textContent = isActive
			? state.sortDir === "asc"
				? "↑"
				: "↓"
			: "";
		indicator.className = `w-3 text-[10px] transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`;
		th.setAttribute(
			"aria-sort",
			isActive
				? state.sortDir === "asc"
					? "ascending"
					: "descending"
				: "none",
		);
	}

	const countStr = t("districtSubtitle", { n: data.length });
	const timeStr = state.cachedAt
		? new Date(state.cachedAt).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";
	ui.subtitle.textContent = timeStr
		? `${countStr} • Updated at ${timeStr}`
		: countStr;
}

let loadingStats = false;

async function loadStats(): Promise<void> {
	if (loadingStats) return;
	const isFresh = state.cachedData && Date.now() - state.cachedAt < CACHE_TTL;
	if (isFresh) {
		ui.loading.classList.add("hidden");
		renderTable();
		return;
	}

	loadingStats = true;
	ui.loading.classList.remove("hidden");
	[ui.table, ui.error, ui.empty].forEach((el) => {
		el.classList.add("hidden");
	});

	try {
		const r = await fetch("/api/heatmap");
		if (!r.ok) throw new Error(`HTTP ${r.status}`);

		const { data } = (await r.json()) as { data?: LocationRow[] };
		if (!data) throw new Error("Invalid response format");

		state.cachedData = data;
		state.cachedAt = Date.now();
		ui.loading.classList.add("hidden");
		renderTable();
	} catch (e) {
		console.error("[DistrictStats]", e);
		ui.loading.classList.add("hidden");
		ui.error.classList.remove("hidden");
	} finally {
		loadingStats = false;
	}
}

export function openDistrictStats(): void {
	if (!ui.dialogEl) return;

	ui.dialogEl.showModal();

	// Reset UI state on each open
	if (ui.search) {
		ui.search.value = "";
		state.filterQuery = "";
		ui.clear?.classList.remove("visible");
	}

	void loadStats();
}

function createLoadingSkeleton(): HTMLElement {
	return html`
		<div class="hidden py-1 px-5">
			${Array.from({ length: 8 }).map(
				() => html`
					<div
						class="py-3.5 border-b border-(--border) flex items-center gap-4 animate-pulse"
					>
						<div class="h-4 w-32 bg-(--surface-3) rounded"></div>
						<div class="flex-1"></div>
						<div class="h-4 w-16 bg-(--surface-3) rounded"></div>
						<div class="h-4 w-12 bg-(--surface-3) rounded"></div>
						<div class="h-4 w-10 bg-(--surface-3) rounded"></div>
					</div>
				`,
			)}
		</div>
	`;
}
