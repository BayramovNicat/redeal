import { t } from "../core/i18n";
import { fmt, frag, ge, trust } from "../core/utils";

import { Dialog } from "../ui/dialog";

type LocationRow = {
	location_name: string;
	avg_price_per_sqm: number;
	count: number;
	recent_avg: number | null;
	prior_avg: number | null;
	trend: "up" | "down" | "flat";
};

type SortKey = "district" | "avg_ppsm" | "listing_count" | "trend";
type SortDir = "asc" | "desc";

let dialogEl: HTMLDialogElement | null = null;
let cachedData: LocationRow[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 15 * 60_000;

export function renderDistrictStatsModal(root: HTMLElement): void {
	dialogEl = Dialog({
		id: "district-stats-modal",
		maxWidth: "640px",
		className: "text-(--text)",
		content: frag`
      <div class="flex items-center justify-between px-5 pt-4.5 pb-3.5 border-b border-(--border) shrink-0">
        <div>
          <div class="text-[15px] font-bold tracking-[-0.3px]" id="dst-title">${t("districtStats")}</div>
          <div class="text-xs text-(--muted) mt-0.5" id="dst-subtitle"></div>
        </div>
        <button
          type="button"
          id="dst-close"
          class="w-7 h-7 flex items-center justify-center rounded-(--r-sm) text-(--muted) hover:text-(--text) hover:bg-(--surface-3) transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div id="dst-body" class="overflow-y-auto" style="max-height:480px">
        <div id="dst-loading" class="py-12 text-center text-sm text-(--muted)">${t("districtLoading")}</div>
        <table id="dst-table" class="hidden w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-(--border) sticky top-0 bg-(--surface) z-10">
              <th id="dst-th-district" class="text-left px-5 py-2.5 font-semibold text-xs text-(--muted) cursor-pointer select-none hover:text-(--text) whitespace-nowrap" data-col="district">
                ${t("districtCol")} <span id="dst-sort-district" class="ml-0.5 opacity-50"></span>
              </th>
              <th id="dst-th-avg_ppsm" class="text-right px-4 py-2.5 font-semibold text-xs text-(--muted) cursor-pointer select-none hover:text-(--text) whitespace-nowrap" data-col="avg_ppsm">
                ${t("districtAvgPpsm")} <span id="dst-sort-avg_ppsm" class="ml-0.5 opacity-50"></span>
              </th>
              <th id="dst-th-listing_count" class="text-right px-4 py-2.5 font-semibold text-xs text-(--muted) cursor-pointer select-none hover:text-(--text) whitespace-nowrap" data-col="listing_count">
                ${t("districtListings")} <span id="dst-sort-listing_count" class="ml-0.5 opacity-50"></span>
              </th>
              <th id="dst-th-trend" class="text-center px-4 pr-5 py-2.5 font-semibold text-xs text-(--muted) cursor-pointer select-none hover:text-(--text) whitespace-nowrap" data-col="trend">
                ${t("districtTrend")} <span id="dst-sort-trend" class="ml-0.5 opacity-50"></span>
              </th>
            </tr>
          </thead>
          <tbody id="dst-tbody"></tbody>
        </table>
        <div id="dst-error" class="hidden py-12 text-center text-sm text-(--muted)">${t("districtError")}</div>
      </div>
    `,
	});

	root.appendChild(dialogEl);

	ge("dst-close").addEventListener("click", () => dialogEl?.close());
}

let sortKey: SortKey = "avg_ppsm";
let sortDir: SortDir = "desc";

function trendOrder(t: "up" | "down" | "flat"): number {
	if (t === "up") return 2;
	if (t === "flat") return 1;
	return 0;
}

function sortedData(data: LocationRow[]): LocationRow[] {
	return [...data].sort((a, b) => {
		let cmp = 0;
		if (sortKey === "district")
			cmp = a.location_name.localeCompare(b.location_name);
		else if (sortKey === "avg_ppsm")
			cmp = a.avg_price_per_sqm - b.avg_price_per_sqm;
		else if (sortKey === "listing_count") cmp = a.count - b.count;
		else if (sortKey === "trend")
			cmp = trendOrder(a.trend) - trendOrder(b.trend);
		return sortDir === "asc" ? cmp : -cmp;
	});
}

function trendBadge(row: LocationRow): string {
	if (row.trend === "up") {
		const pct =
			row.recent_avg && row.prior_avg
				? (((row.recent_avg - row.prior_avg) / row.prior_avg) * 100).toFixed(1)
				: "";
		return `<span style="color:var(--red);font-size:11px;font-weight:600">↑${pct ? ` ${pct}%` : ""}</span>`;
	}
	if (row.trend === "down") {
		const pct =
			row.recent_avg && row.prior_avg
				? (((row.prior_avg - row.recent_avg) / row.prior_avg) * 100).toFixed(1)
				: "";
		return `<span style="color:var(--green);font-size:11px;font-weight:600">↓${pct ? ` ${pct}%` : ""}</span>`;
	}
	return `<span style="color:var(--muted);font-size:11px">—</span>`;
}

function renderTable(data: LocationRow[]): void {
	const tbody = ge("dst-tbody");
	const sorted = sortedData(data);

	const TR_BASE = "padding:10px 0;border-bottom:1px solid var(--border)";
	const TD_BASE = "padding:10px 16px;color:var(--text);font-size:13px";
	const TD_MUTED =
		"padding:10px 16px;color:var(--muted);font-size:13px;text-align:right;font-variant-numeric:tabular-nums";
	const TD_MONO =
		"padding:10px 16px;color:var(--text);font-size:13px;text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums";
	const TD_CENTER = "padding:10px 20px 10px 16px;text-align:center";

	tbody.innerHTML = trust(
		sorted
			.map(
				(row, i) => `
    <tr style="${TR_BASE};background:${i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--surface-2) 40%, transparent)"}">
      <td style="${TD_BASE};padding-left:20px;font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${row.location_name}">${row.location_name}</td>
      <td style="${TD_MONO}">₼ ${fmt(row.avg_price_per_sqm, 0)}</td>
      <td style="${TD_MUTED}">${row.count}</td>
      <td style="${TD_CENTER}">${trendBadge(row)}</td>
    </tr>
  `,
			)
			.join(""),
	) as string;


	// Update sort indicators
	const cols: SortKey[] = ["district", "avg_ppsm", "listing_count", "trend"];
	for (const col of cols) {
		const el = ge(`dst-sort-${col}`);
		if (el)
			el.textContent = col === sortKey ? (sortDir === "asc" ? "↑" : "↓") : "";
	}

	const subtitle = ge("dst-subtitle");
	if (subtitle)
		subtitle.textContent = t("districtSubtitle", { n: sorted.length });
}

async function loadStats(): Promise<void> {
	const loading = ge("dst-loading");
	const table = ge("dst-table");
	const error = ge("dst-error");

	if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
		loading.classList.add("hidden");
		table.classList.remove("hidden");
		renderTable(cachedData);
		return;
	}

	loading.classList.remove("hidden");
	table.classList.add("hidden");
	error.classList.add("hidden");

	try {
		const r = await fetch("/api/heatmap");
		const json = (await r.json()) as { data?: LocationRow[] };
		if (!json.data || json.data.length === 0) {
			loading.textContent = t("districtEmpty");
			return;
		}
		cachedData = json.data;
		cachedAt = Date.now();
		loading.classList.add("hidden");
		table.classList.remove("hidden");
		renderTable(cachedData);
	} catch {
		loading.classList.add("hidden");
		error.classList.remove("hidden");
	}
}

function attachSortHandlers(): void {
	const cols: SortKey[] = ["district", "avg_ppsm", "listing_count", "trend"];
	for (const col of cols) {
		const th = ge(`dst-th-${col}`);
		if (!th) continue;
		th.addEventListener("click", () => {
			if (sortKey === col) {
				sortDir = sortDir === "asc" ? "desc" : "asc";
			} else {
				sortKey = col;
				sortDir = col === "district" ? "asc" : "desc";
			}
			if (cachedData) renderTable(cachedData);
		});
	}
}

export function openDistrictStats(): void {
	if (!dialogEl) return;
	dialogEl.showModal();
	attachSortHandlers();
	void loadStats();
}
