import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Gallery } from "@/ui/gallery";
import { Icons } from "@/ui/icons";
import type { PropertyDetailUI } from "./types";

const DOCK_ICON_BTN =
	"size-8.5 rounded-full border-none bg-transparent text-(--text-2) hover:bg-white/[0.08] flex items-center justify-center shrink-0";

/**
 * Renders the editorial property detail sheet and populates UI references.
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

	ui.gallery = Gallery({
		onExpand,
		className: "flex-1 min-h-0 bg-[#07080c]",
	});

	// Header & Core elements
	ui.locationEl = html`<div class="text-xs font-medium text-(--text-2) truncate"></div>`;
	ui.postedEl = html`<div class="text-xs font-mono-num text-(--muted) shrink-0"></div>`;
	ui.priceEl = html`<span class="text-[30px] font-extrabold font-mono-num tracking-[-0.035em] leading-none text-(--text)"></span>`;
	ui.tierEl = html`<span
		class="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide px-2.5 py-0.75 rounded-full whitespace-nowrap"
	></span>`;
	ui.endedBannerEl = html`<div
		class="hidden rounded-(--r-sm) border border-(--red-b) bg-(--red-dim) px-3.5 py-2.5 text-xs font-semibold text-(--red)"
	></div>`;

	// Stats & Tags
	ui.statsEl = html`<div
		class="grid grid-cols-4 divide-x divide-(--border-subtle) py-3 border-y border-(--border-subtle)"
	></div>`;
	ui.mktAvgEl = html`<span class="text-(--text-2) font-mono-num font-semibold"></span>`;
	ui.discPctEl = html`<span
		class="inline-flex items-center gap-1 px-2.5 py-0.75 rounded-full text-xs font-extrabold font-mono-num"
	></span>`;
	ui.tagsEl = html`<div class="flex flex-wrap gap-1.5 empty:hidden"></div>`;

	// Content Sections
	ui.historyChartEl = html`<div></div>`;
	ui.historySecEl = html`
		<div class="pt-4 border-t border-(--border-subtle) hidden">
			<div
				class="text-[10px] font-semibold text-(--muted) uppercase tracking-[0.08em] mb-2.5"
			>
				${t("priceHistory")}
			</div>
			${ui.historyChartEl}
		</div>
	`;

	ui.descBodyEl = html`<p
		class="text-[13.5px] text-(--text-2) leading-[1.68] whitespace-pre-wrap"
	></p>`;
	ui.descSecEl = html`
		<div class="pt-4 border-t border-(--border-subtle) hidden space-y-2">
			<div
				class="text-[10px] font-semibold text-(--muted) uppercase tracking-[0.08em]"
			>
				${t("btnDescription")}
			</div>
			${ui.descBodyEl}
		</div>
	`;

	ui.mapCtEl = html`<div
		class="w-full h-full bg-(--surface-2) brightness-[0.86] contrast-[1.06] saturate-[0.85]"
	></div>`;
	ui.mapSecEl = html`<div
		class="hidden shrink-0 h-48 md:h-56 border-t border-(--border)"
	>
		${ui.mapCtEl}
	</div>`;

	// Single-Row Action Dock Controls
	ui.linkEl = html`<a
		href="#"
		target="_blank"
		rel="noopener"
		class="flex-1 h-10.5 flex items-center justify-center gap-2 bg-(--accent-solid) text-white border border-white/10 rounded-full font-semibold text-[13px] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_6px_18px_-4px_rgba(88,101,242,0.55)] transition-all hover:bg-(--accent-hover) hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_24px_-4px_rgba(88,101,242,0.65)] active:scale-[0.98]"
	>
		${t("viewListing")} ${Icons.external(13)}
	</a>` as HTMLAnchorElement;

	ui.bmarkBtn = Button({
		content: Icons.bookmark({ size: 15, fill: false }),
		variant: "square",
		color: "yellow",
		className: `${DOCK_ICON_BTN} [&.on]:text-(--yellow) [&.on]:bg-(--yellow-dim)`,
		onclick: onBookmark,
		title: t("btnSave"),
		ariaLabel: t("btnSave"),
	}) as HTMLButtonElement;

	ui.shareBtn = Button({
		content: Icons.share(15),
		variant: "square",
		color: "indigo",
		className: DOCK_ICON_BTN,
		onclick: onShare,
		title: t("btnShare"),
		ariaLabel: t("btnShare"),
	}) as HTMLButtonElement;

	ui.hideBtn = Button({
		content: Icons.hide(15),
		variant: "square",
		color: "red",
		className: `${DOCK_ICON_BTN} hover:text-(--red) hover:bg-(--red-dim)`,
		onclick: onHide,
		title: t("btnHide"),
		ariaLabel: t("btnHide"),
	}) as HTMLButtonElement;

	ui.deleteBtn = Button({
		content: Icons.trash(15),
		variant: "square",
		color: "red",
		className:
			"size-8.5 rounded-full border-none bg-transparent items-center justify-center shrink-0 hidden text-(--red)/80 hover:text-(--red) hover:bg-(--red-dim)",
		onclick: onDelete,
		title: t("btnDelete"),
		ariaLabel: t("btnDelete"),
	}) as HTMLButtonElement;

	const actionCapsule = html`
		<div
			class="inline-flex items-center gap-0.5 p-1 rounded-full bg-(--surface-2) border border-(--border) shrink-0"
		>
			${ui.bmarkBtn}${ui.shareBtn}${ui.hideBtn}${ui.deleteBtn}
		</div>
	`;

	const leftCol = html`
		<div
			class="w-full md:flex-1 min-w-0 bg-[#07080c] flex flex-col h-auto md:h-full shrink-0"
		>
			<div class="h-68 md:h-auto md:flex-1 min-h-0 overflow-hidden">
				${ui.gallery}
			</div>
			${ui.mapSecEl}
		</div>
	`;

	const rightCol = html`
		<div
			class="w-full md:w-[430px] shrink-0 flex flex-col bg-(--surface) border-t md:border-t-0 md:border-l border-(--border) h-auto md:h-full"
		>
			<!-- Top Tier Header (reserves right space for modal Close button) -->
			<div
				class="px-5 md:px-6 pt-5 pb-3 pr-15 flex items-center gap-2 shrink-0"
			>
				${ui.tierEl}
				${ui.discPctEl}
			</div>

			<!-- Scrollable Editorial Dossier Body -->
			<div
				class="px-5 md:px-6 pb-6 flex-1 overflow-y-visible md:overflow-y-auto space-y-4.5"
			>
				${ui.endedBannerEl}

				<!-- Hero Price & Benchmark -->
				<div class="space-y-2">
					<div>${ui.priceEl}</div>
					<div class="flex items-center justify-between gap-2 text-xs flex-wrap">
						<div class="flex items-center gap-1.75 min-w-0">
							<span class="text-(--muted) shrink-0">${Icons.map(12)}</span>
							${ui.locationEl}
							<span class="text-(--muted)/50">·</span>
							${ui.postedEl}
						</div>
					</div>
					<div class="inline-flex items-baseline gap-1.5 text-xs text-(--muted) pt-0.5">
						<span>${t("propMarketAvg")}</span>
						${ui.mktAvgEl}
					</div>
				</div>

				<!-- Hairline 4-Column Spec Readout (Box-Free) -->
				${ui.statsEl}

				<!-- Restrained Feature Tags -->
				${ui.tagsEl}

				<!-- Price History & Description -->
				${ui.historySecEl} ${ui.descSecEl}
			</div>

			<!-- Single-Row Floating Action Dock -->
			<div
				class="px-5 py-3.5 border-t border-(--border) glass-panel bg-(--surface-glass-strong) flex items-center gap-2.5 shrink-0 max-md:fixed max-md:bottom-4 max-md:left-4 max-md:right-4 max-md:z-30 max-md:rounded-full max-md:border max-md:border-(--border-h) max-md:shadow-[var(--shadow-float)]"
			>
				${ui.linkEl} ${actionCapsule}
			</div>
		</div>
	`;

	ui.modal = Dialog({
		id: "prop-detail-modal",
		maxWidth: "1220px",
		showClose: true,
		closeClassName:
			"top-4 right-4 size-8.5 bg-(--surface-2)/90 hover:bg-(--surface-3) text-(--text-2) hover:text-(--text) border border-(--border) hover:border-(--border-h) backdrop-blur-md transition-all active:scale-95",
		className: "text-(--text) h-full flex-1 min-h-0",
		content: html`
			<div
				class="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-y-hidden pb-24 md:pb-0 bg-(--surface)"
			>
				${leftCol} ${rightCol}
			</div>
		`,
	}) as HTMLElement & { showModal: () => void; close: () => void };

	return ui.modal;
}
