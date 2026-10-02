import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Gallery } from "@/ui/gallery";
import { Icons } from "@/ui/icons";
import type { PropertyDetailUI } from "./types";

/**
 * Renders the property detail layout and populates UI references.
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
	ui.locationEl = html`<div class="text-xs text-(--muted) truncate"></div>`;
	ui.postedEl = html`<div class="text-xs text-(--muted) shrink-0"></div>`;
	ui.priceEl = html`<span class="text-2xl font-bold tracking-tight"></span>`;
	ui.tierEl = html`<span
		class="inline-flex items-center text-[10px] font-semibold tracking-wider px-2 py-0.75 rounded-full border border-current whitespace-nowrap"
	></span>`;
	ui.endedBannerEl = html`<div
		class="hidden rounded-(--r) border border-(--red-b) bg-(--red-dim) px-4 py-3 text-sm font-semibold text-(--red)"
	></div>`;

	// Stats & Tags
	ui.statsEl = html`<div class="grid grid-cols-4 gap-2 mb-3"></div>`;
	ui.mktAvgEl = html`<span class="text-(--text-2) font-medium"></span>`;
	ui.discPctEl = html`<span class="text-sm font-bold"></span>`;
	ui.tagsEl = html`<div
		class="flex flex-wrap gap-1.25 mt-3 empty:hidden"
	></div>`;

	// Content Sections
	ui.historyChartEl = html`<div></div>`;
	ui.historySecEl = html`
		<div class="pt-6 border-t border-(--border)/60 hidden">
			<div
				class="text-[10px] font-bold text-(--muted) uppercase tracking-widest mb-3"
			>
				${t("priceHistory")}
			</div>
			${ui.historyChartEl}
		</div>
	`;

	ui.descBodyEl = html`<p
		class="text-sm text-(--text-2) leading-relaxed whitespace-pre-wrap"
	></p>`;
	ui.descSecEl = html`
		<div class="pt-6 border-t border-(--border)/60 hidden">
			${ui.descBodyEl}
		</div>
	`;

	ui.mapCtEl = html`<div class="w-full h-full bg-(--surface-3)"></div>`;
	ui.mapSecEl = html`<div
		class="flex-1 min-h-0 border-t border-(--border) hidden h-48 md:h-full shrink-0"
	>
		${ui.mapCtEl}
	</div>`;

	// Footer Actions
	ui.linkEl = html`<a
		href="#"
		target="_blank"
		rel="noopener"
		class="w-full h-12.5 flex items-center justify-center gap-2.5 bg-(--accent-solid) text-white rounded-(--r) font-bold text-sm transition-all hover:bg-(--accent-h) hover:shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]"
	>
		${t("viewListing")} ${Icons.external(14)}
	</a>` as HTMLAnchorElement;

	ui.shareBtn = Button({
		content: Icons.share(18),
		variant: "padded",
		color: "indigo",
		className: "w-12.5 h-12.5 flex items-center justify-center shrink-0",
		onclick: onShare,
		title: t("btnShare"),
	}) as HTMLButtonElement;
	ui.shareBtn.setAttribute("aria-label", t("btnShare"));

	ui.bmarkBtn = Button({
		content: Icons.bookmark({ size: 18, fill: false }),
		variant: "padded",
		color: "yellow",
		className: "w-12.5 h-12.5 flex items-center justify-center shrink-0",
		onclick: onBookmark,
		title: t("btnSave"),
	}) as HTMLButtonElement;

	ui.hideBtn = Button({
		content: Icons.hide(16),
		variant: "padded",
		color: "red",
		className: "w-12.5 h-12.5 flex items-center justify-center shrink-0",
		onclick: onHide,
		title: t("btnHide"),
	}) as HTMLButtonElement;

	ui.deleteBtn = Button({
		content: Icons.trash(16),
		variant: "padded",
		color: "red",
		className:
			"w-12.5 h-12.5 flex items-center justify-center shrink-0 hidden text-(--red) hover:bg-(--red-dim)",
		onclick: onDelete,
		title: t("btnDelete"),
	}) as HTMLButtonElement;
	ui.deleteBtn.setAttribute("aria-label", t("btnDelete"));

	const leftCol = html`
		<div class="w-full md:flex-1 min-w-0 bg-(--surface) flex flex-col h-auto md:h-full shrink-0">
			<div class="h-64 md:h-auto md:flex-1 min-h-0 overflow-hidden">${ui.gallery}</div>
			${ui.mapSecEl}
		</div>
	`;

	const rightCol = html`
		<div
			class="w-full md:w-95 shrink-0 flex flex-col bg-(--surface-2) border-t md:border-t-0 md:border-l border-(--border) h-auto md:h-full"
		>
			<div class="p-5 md:p-6 flex-1 overflow-y-visible md:overflow-y-auto space-y-5 md:space-y-6 custom-scrollbar">
				${ui.endedBannerEl}

				<!-- Core Info -->
				<div class="space-y-5">
					<div class="space-y-3">
						<div>${ui.tierEl}</div>
						<div class="space-y-1.5 min-w-0">
							${ui.priceEl}
							<div class="flex items-center gap-2 text-xs text-(--muted)">
								${ui.locationEl}
								<span class="opacity-30">•</span>
								${ui.postedEl}
							</div>
						</div>
					</div>

					<!-- Market Context Banner -->
					<div
						class="flex items-center justify-between p-4 bg-(--surface) border border-(--border) rounded-(--r)"
					>
						<div class="space-y-1">
							<div
								class="text-[10px] font-bold text-(--muted) uppercase tracking-wider"
							>
								${t("propMarketAvg")}
							</div>
							<div class="text-sm font-semibold">${ui.mktAvgEl}</div>
						</div>
						<div class="text-right space-y-1">
							<div
								class="text-[10px] font-bold text-(--muted) uppercase tracking-wider"
							>
								${t("propDiscount")}
							</div>
							<div class="text-sm font-bold">${ui.discPctEl}</div>
						</div>
					</div>
				</div>

				<!-- Stats & Tags -->
				<div class="space-y-4">${ui.statsEl} ${ui.tagsEl}</div>

				<!-- Conditional Sections -->
				${ui.historySecEl} ${ui.descSecEl}
			</div>

			<!-- Sticky Actions -->
			<div
				class="p-5 md:p-6 border-t border-(--border) bg-(--surface) space-y-4 shrink-0 max-md:absolute max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-30 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
			>
				${ui.linkEl}
				<div class="flex items-center justify-center gap-3">
					${ui.bmarkBtn} ${ui.shareBtn} ${ui.hideBtn} ${ui.deleteBtn}
				</div>
			</div>
		</div>
	`;

	ui.modal = Dialog({
		id: "prop-detail-modal",
		maxWidth: "1150px",
		showClose: true,
		closeClassName:
			"bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95 duration-200",
		className: "text-(--text) h-full flex-1 min-h-0",
		content: html`
			<div
				class="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-y-hidden pb-44 md:pb-0 bg-(--surface-2)"
			>
				${leftCol} ${rightCol}
			</div>
		`,
	}) as HTMLElement & { showModal: () => void; close: () => void };

	return ui.modal;
}
