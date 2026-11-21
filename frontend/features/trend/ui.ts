import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import type { TrendUI } from "./types";

/**
 * Renders the trend telemetry panel shell and populates UI refs.
 */
export function renderTrendUI(ui: TrendUI): HTMLElement {
	ui.locEl = html`<span class="text-(--text) font-semibold"></span>`;
	ui.curEl = html`<span></span>`;
	ui.chgEl = html`<span
		class="text-[11px] font-semibold font-mono-num px-2.5 py-0.5 rounded-full border"
	></span>`;
	ui.weeksEl = html`<div
		class="text-[11px] font-medium text-(--muted) bg-(--surface-2) border border-(--border) rounded-full px-2.75 py-1 whitespace-nowrap"
	></div>`;
	ui.tipEl = html`<div
		class="absolute hidden glass-panel bg-(--surface-glass-strong) border border-(--border-h) rounded-(--r-sm) px-3 py-2 text-xs shadow-[var(--shadow-float)] pointer-events-none z-10 whitespace-nowrap leading-normal top-0 left-0"
	></div>`;
	ui.chartEl = html`<div class="w-full relative">${ui.tipEl}</div>`;
	ui.datesEl = html`<div
		class="flex justify-between text-[11px] font-mono-num text-(--muted) mt-2 px-0.5"
	></div>`;

	ui.panel = html`<div class="hidden">
		<div
			class="bg-(--surface) border border-(--border) rounded-(--r-lg) pt-4.5 px-5 pb-3.5 mb-4 surface-specular animate-[fadeUp_0.22s_ease-out]"
		>
			<div class="flex items-start justify-between mb-4 gap-3 flex-wrap">
				<div>
					<div class="text-xs text-(--muted) mb-1.5 tracking-tight">
						${t("avgTrend")} · ${ui.locEl}
					</div>
					<div class="flex items-center gap-2.5 flex-wrap">
						<span class="text-[22px] font-extrabold font-mono-num tracking-[-0.03em] leading-none text-(--text)"
							>${ui.curEl}</span
						>
						${ui.chgEl}
					</div>
				</div>
				${ui.weeksEl}
			</div>
			${ui.chartEl} ${ui.datesEl}
		</div>
	</div>`;

	return ui.panel;
}
