import { t } from "@/core/i18n";
import { state } from "@/core/state";
import { cn, frag, html } from "@/core/utils";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";
import { Select } from "@/ui/select";
import type { ProductsCallbacks, ProductsUI } from "./types";

const GHOST_UTIL_CLS =
	"h-8 px-2.5 rounded-full border-none bg-transparent text-(--muted) hover:text-(--text) hover:bg-white/[0.06] font-medium";

/**
 * Renders the weightless results bar (morphs into a frosted floating bar when stuck).
 */
export function renderProductsBar(
	ui: ProductsUI,
	callbacks: ProductsCallbacks,
): HTMLElement {
	const {
		onExport,
		onValidate,
		onAlertsOpen,
		onSavedClick,
		onSortChange,
		onViewChange,
	} = callbacks;

	ui.resultsMeta = html`<div
		class="text-[13px] text-(--text-2) flex items-center gap-2 flex-wrap [&_strong]:text-(--text) [&_strong]:font-bold [&_strong]:font-mono-num"
		aria-live="polite"
		role="status"
	></div>`;

	ui.savedBadge = html`<span
		class="font-mono-num text-[11px] font-bold"
	></span>`;
	ui.savedBtn = Button({
		color: "yellow",
		className:
			"hidden h-8 px-3 rounded-full bg-(--surface) border-(--border) font-semibold",
		content: frag`${Icons.bookmark({ size: 12, fill: false })} ${t("saved")} ${ui.savedBadge}`,
		onclick: onSavedClick,
	}) as HTMLButtonElement;

	ui.sortSelect = Select({
		name: "sort-by",
		variant: "xs",
		ariaLabel: t("sortBy"),
		title: t("sortBy"),
		className:
			"h-7.5 border-none bg-transparent rounded-full pl-3 pr-7 text-(--text-2) hover:text-(--text) focus:shadow-none font-medium",
		options: [
			{ value: "disc", label: t("sortDisc") },
			{ value: "drops", label: t("sortDrops") },
			{ value: "new", label: t("sortNew") },
			{ value: "price-asc", label: t("sortPriceAsc") },
			{ value: "price-desc", label: t("sortPriceDesc") },
			{ value: "area", label: t("sortArea") },
			{ value: "ppsm", label: t("sortPpsm") },
		],
		onchange: (e) => onSortChange((e.target as HTMLSelectElement).value),
	});

	const segmentedBtnCls =
		"size-7 border-none bg-transparent rounded-full text-(--muted) hover:text-(--text) hover:bg-white/[0.06] [&.on]:bg-(--surface-3) [&.on]:text-(--text) [&.on]:border-none [&.on]:shadow-[0_1px_3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]";

	ui.viewGridBtn = Button({
		variant: "square",
		color: "indigo",
		active: state.currentView === "grid",
		title: t("gridView"),
		className: segmentedBtnCls,
		content: Icons.grid(13),
		onclick: () => onViewChange("grid"),
	}) as HTMLButtonElement;

	ui.viewListBtn = Button({
		variant: "square",
		color: "indigo",
		active: state.currentView === "list",
		title: t("listView"),
		className: `hidden md:inline-flex ${segmentedBtnCls}`,
		content: Icons.list(13),
		onclick: () => onViewChange("list"),
	}) as HTMLButtonElement;

	ui.viewMapBtn = Button({
		variant: "square",
		color: "indigo",
		active: state.currentView === "map",
		title: t("mapView"),
		className: segmentedBtnCls,
		content: Icons.mapPins(13),
		onclick: () => onViewChange("map"),
	}) as HTMLButtonElement;

	const sortAndViewCapsule = html`
		<div
			class="inline-flex items-center gap-0.5 p-0.75 rounded-full bg-(--surface) border border-(--border) surface-specular"
		>
			${ui.sortSelect}
			<div class="w-px h-3.5 bg-(--border) mx-0.5 shrink-0"></div>
			<div class="inline-flex items-center gap-0.5">
				${ui.viewGridBtn}${ui.viewListBtn}${ui.viewMapBtn}
			</div>
		</div>
	`;

	ui.validateBtn = Button({
		title: t("validateBtn"),
		content: frag`${Icons.refresh(12)} ${t("validateBtn")}`,
		color: "green",
		className: cn("hidden lg:inline-flex", GHOST_UTIL_CLS),
		onclick: (e) => onValidate(e.currentTarget as HTMLButtonElement),
	}) as HTMLButtonElement;

	ui.exportBtn = Button({
		title: t("exportBtn"),
		content: frag`${Icons.download(12)} ${t("exportBtn")}`,
		color: "blue",
		className: cn("hidden md:inline-flex", GHOST_UTIL_CLS),
		onclick: onExport,
	}) as HTMLButtonElement;

	ui.adminActions = html`<div
		class="hidden md:inline-flex items-center gap-0.5 empty:hidden"
	></div>`;

	ui.resultsBarInner = html`
		<div
			class="flex items-center justify-between gap-3 flex-wrap rounded-(--r-lg) sm:rounded-full border border-transparent px-4 py-2 mb-3 transition-[background-color,border-color,box-shadow] duration-200 ease-out"
			style="display: none"
		>
			${ui.resultsMeta}
			<div class="flex items-center gap-1.5 flex-wrap">
				${ui.adminActions}
				${Button({
					title: t("telegramAlerts"),
					content: frag`${Icons.bell(12)} ${t("alertMe")}`,
					color: "yellow",
					className:
						"h-8 px-3 rounded-full bg-(--yellow-dim)/70 border-(--yellow-b)/70 text-(--yellow) hover:bg-(--yellow-dim) hover:border-(--yellow-b) font-semibold",
					onclick: onAlertsOpen,
				})}
				${ui.savedBtn}
				${sortAndViewCapsule}
			</div>
		</div>
	`;

	ui.resultsBarContainer = html`
		<div class="sticky top-2.5 z-30">
			${ui.resultsBarInner}
		</div>
	`;

	return ui.resultsBarContainer;
}
