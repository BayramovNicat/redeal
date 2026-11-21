import { fmt, html } from "@/core/utils";
import { Icons } from "@/ui/icons";
import type { DistrictStatsUI, LocationRow, SortKey } from "./types";

/**
 * Renders a sortable table header and populates UI indicators.
 */
export function renderSortHeader(
	ui: DistrictStatsUI,
	key: SortKey,
	label: string,
	align: "left" | "right" | "center",
	onClick: () => void,
): HTMLElement {
	const indicator = html`<span
		class="w-3 text-[10px] opacity-0 transition-opacity"
	></span>`;
	ui.sortIndicators[key] = indicator;

	const th = html`
		<th
			class="px-5 py-3 font-semibold text-[10.5px] uppercase tracking-wider text-(--muted) cursor-pointer select-none hover:text-(--text) transition-colors ${
				align === "right"
					? "text-right"
					: align === "center"
						? "text-center"
						: "text-left"
			}"
			data-col="${key}"
		>
			<div
				class="flex items-center gap-1 ${
					align === "right"
						? "justify-end"
						: align === "center"
							? "justify-center"
							: ""
				}"
			>
				${label} ${indicator}
			</div>
		</th>
	`;
	th.onclick = onClick;
	ui.sortHeaders[key] = th;
	return th;
}

/**
 * Renders a trend badge for a location row.
 */
export function TrendBadge(row: LocationRow): HTMLElement {
	const { trend, recent_avg, prior_avg } = row;
	if (trend === "flat" || !recent_avg || !prior_avg) {
		return html`<span class="text-(--muted) text-[11px] font-mono-num">···</span>`;
	}

	const isUp = trend === "up";
	const diff = Math.abs(((recent_avg - prior_avg) / prior_avg) * 100);
	const colorClass = isUp
		? "bg-(--red-dim) border-(--red-b) text-(--red)"
		: "bg-(--green-dim) border-(--green-b) text-(--green)";

	return html`
		<div
			class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${colorClass} text-[11px] font-bold font-mono-num"
		>
			${Icons.chevron({
				size: 10,
				strokeWidth: 2.8,
				className: isUp ? "rotate-180" : "",
			})}
			${diff.toFixed(1)}%
		</div>
	`;
}

/**
 * Renders a single data row for the stats table.
 */
export function DataRow(row: LocationRow): HTMLElement {
	return html`
		<tr
			class="group hover:bg-(--surface-2)/80 border-b border-(--border-subtle) transition-colors"
		>
			<td
				class="px-5 py-3.25 font-medium text-[13.5px] text-(--text) max-w-52 truncate"
				title="${row.location_name}"
			>
				${row.location_name}
			</td>
			<td class="px-5 py-3.25 text-right font-mono-num text-[13px] font-semibold text-(--text)">
				₼ ${fmt(row.avg_price_per_sqm, 0)}
			</td>
			<td class="px-5 py-3.25 text-right text-(--text-2) font-mono-num text-xs">
				${row.count}
			</td>
			<td class="px-5 py-3.25 text-center">${TrendBadge(row)}</td>
		</tr>
	`;
}
