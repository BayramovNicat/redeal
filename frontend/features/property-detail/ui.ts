import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Gallery } from "@/ui/gallery";
import { Icons } from "@/ui/icons";
import type { PropertyDetailUI } from "./types";

/**
 * Renders the property detail sheet layout and populates UI references.
 */
export function renderPropertyDetailLayout(
	ui: PropertyDetailUI,
	callbacks: {
		onExpand: () => void;
		onShare: () => void;
		onBookmark: () => void;
		onHide: () => void;
		onDelete: () => void;
	},
): HTMLElement {
	const { onExpand, onShare, onBookmark, onHide, onDelete } = callbacks;

	ui.gallery = Gallery({ onExpand, className: "flex-1 min-h-0" });

	// Header elements
	ui.locationEl = html`<div class="text-xs font-medium text-(--text-2) truncate"></div>`;
	ui.postedEl = html`<div class="text-xs font-mono-num text-(--muted) shrink-0"></div>`;
	ui.priceEl = html`<span class="text-[28px] font-extrabold font-mono-num tracking-[-0.03em] leading-none text-(--text)"></span>`;
	ui.tierEl = html`<span
		class="inline-flex items-center text-[11px] font-semibold tracking-wide px-2.5 py-0.75 rounded-full border border-current whitespace-nowrap"
	></span>`;
	ui.endedBannerEl = html`<div
		class="hidden rounded-(--r) border border-(--red-b) bg-(--red-dim) px-4 py-3 text-xs font-semibold text-(--red)"
	></div>`;

	// Stats & Tags
	ui.statsEl = html`<div class="grid grid-cols-4 gap-2 mb-3"></div>`;
	ui.mktAvgEl = html`<span class="text-(--text) font-mono-num font-semibold"></span>`;
	ui.discPctEl = html`<span class="text-base font-extrabold font-mono-num"></span>`;
	ui.tagsEl = html`<div
		class="flex flex-wrap gap-1.5 mt-3 empty:hidden"
	></div>`;

	// Content Sections
	ui.historyChartEl = html`<div></div>`;
	ui.historySecEl = html`
		<div class="pt-5 border-t border-(--border) hidden">
			<div
				class="text-[10px] font-bold text-(--muted) uppercase tracking-widest mb-3"
			>
				${t("priceHistory")}
			</div>
			${ui.historyChartEl}
		</div>
	`;

	ui.descBodyEl = html`<p
		class="text-[13.5px] text-(--text-2) leading-relaxed whitespace-pre-wrap"
	></p>`;
	ui.descSecEl = html`
		<div class="pt-5 border-t border-(--border) hidden">
			${ui.descBodyEl}
		</div>
	`;

	ui.mapCtEl = html`<div class="w-full h-full bg-(--surface-2)"></div>`;
	ui.mapSecEl = html`<div
		class="flex-1 min-h-0 border-t border-(--border) hidden h-52 md:h-full shrink-0"
	>
		${ui.mapCtEl}
	</div>`;

	// Footer Actions
	ui.linkEl = html`<a
		href="#"
		target="_blank"
		rel="noopener"
		class="w-full h-11.5 flex items-center justify-center gap-2 bg-(--accent-solid) text-white border border-white/10 rounded-(--r) font-semibold text-[13.5px] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_22px_-4px_rgba(88,101,242,0.55)] transition-all hover:bg-(--accent-hover) hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_12px_28px_-4px_rgba(88,101,242,0.65)] active:scale-[0.98]"
	>
		${t("viewListing")} ${Icons.external(14)}
	</a>` as HTMLAnchorElement;

	ui.shareBtn = Button({
		content: Icons.share(17),
		variant: "padded",
		color: "indigo",
		className: "flex-1 h-11 flex items-center justify-center rounded-(--r)",
		onclick: onShare,
		title: t("btnShare"),
	}) as HTMLButtonElement;
	ui.shareBtn.setAttribute("aria-label", t("btnShare"));

	ui.bmarkBtn = Button({
		content: Icons.bookmark({ size: 17, fill: false }),
		variant: "padded",
		color: "yellow",
		className: "flex-1 h-11 flex items-center justify-center rounded-(--r)",
		onclick: onBookmark,
		title: t("btnSave"),
	}) as HTMLButtonElement;

	ui.hideBtn = Button({
		content: Icons.hide(16),
		variant: "padded",
		color: "red",
		className: "flex-1 h-11 flex items-center justify-center rounded-(--r)",
		onclick: onHide,
		title: t("btnHide"),
	}) as HTMLButtonElement;

	ui.deleteBtn = Button({
		content: Icons.trash(16),
		variant: "padded",
		color: "red",
		className:
			"flex-1 h-11 items-center justify-center rounded-(--r) hidden text-(--red) hover:bg-(--red-dim)",
		onclick: onDelete,
		title: t("btnDelete"),
	}) as HTMLButtonElement;
	ui.deleteBtn.setAttribute("aria-label", t("btnDelete"));

	const leftCol = html`
		<div class="w-full md:flex-1 min-w-0 bg-[#050608] flex flex-col h-auto md:h-full shrink-0">
			<div class="h-68 md:h-auto md:flex-1 min-h-0 overflow-hidden">${ui.gallery}</div>
			${ui.mapSecEl}
		</div>
	`;

	const rightCol = html`
		<div
			class="w-full md:w-[400px] shrink-0 flex flex-col bg-(--surface) border-t md:border-t-0 md:border-l border-(--border) h-auto md:h-full"
		>
			<div class="p-5 md:p-6 flex-1 overflow-y-visible md:overflow-y-auto space-y-5">
				${ui.endedBannerEl}

				<!-- Core Info -->
				<div class="space-y-4">
					<div class="space-y-3">
						<div>${ui.tierEl}</div>
						<div class="space-y-2 min-w-0">
							<div>${ui.priceEl}</div>
							<div class="flex items-center gap-2 text-xs text-(--muted)">
								<span class="shrink-0 opacity-70">${Icons.map(12)}</span>
								${ui.locationEl}
								<span class="opacity-35">•</span>
								${ui.postedEl}
							</div>
						</div>
					</div>

					<!-- Market Context Banner -->
					<div
						class="flex items-center justify-between px-4 py-3.5 bg-(--surface-2)/80 border border-(--border) rounded-(--r)"
					>
						<div class="space-y-1">
							<div
								class="text-[10px] font-semibold text-(--muted) uppercase tracking-wider"
							>
								${t("propMarketAvg")}
							</div>
							<div class="text-sm">${ui.mktAvgEl}</div>
						</div>
						<div class="w-px h-8 bg-(--border)"></div>
						<div class="text-right space-y-1">
							<div
								class="text-[10px] font-semibold text-(--muted) uppercase tracking-wider"
							>
								${t("propDiscount")}
							</div>
							<div>${ui.discPctEl}</div>
						</div>
					</div>
				</div>

				<!-- Stats & Tags -->
				<div class="space-y-3.5">${ui.statsEl} ${ui.tagsEl}</div>

				<!-- Conditional Sections -->
				${ui.historySecEl} ${ui.descSecEl}
			</div>

			<!-- Sticky Actions -->
			<div
				class="p-4.5 md:p-5 border-t border-(--border) glass-panel bg-(--surface-glass-strong) space-y-2.5 shrink-0 max-md:absolute max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-30 max-md:shadow-[0_-12px_32px_rgba(0,0,0,0.5)]"
			>
				${ui.linkEl}
				<div class="flex items-center gap-2">
					${ui.bmarkBtn} ${ui.shareBtn} ${ui.hideBtn} ${ui.deleteBtn}
				</div>
			</div>
		</div>
	`;

	ui.modal = Dialog({
		id: "prop-detail-modal",
		maxWidth: "1180px",
		showClose: true,
		closeClassName:
			"bg-black/60 hover:bg-black/85 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all active:scale-95 duration-200",
		className: "text-(--text) h-full flex-1 min-h-0",
		content: html`
			<div
				class="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-y-hidden pb-44 md:pb-0 bg-(--surface)"
			>
				${leftCol} ${rightCol}
			</div>
		`,
	}) as HTMLElement & { showModal: () => void; close: () => void };

	return ui.modal;
}
