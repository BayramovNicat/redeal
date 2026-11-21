import { t } from "@/core/i18n";
import { state } from "@/core/state";
import { frag, html } from "@/core/utils";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";
import { Select } from "@/ui/select";
import type { ProductsCallbacks, ProductsUI } from "./types";

/**
 * Renders the floating glass products results bar and populates UI references.
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
		class="text-[13px] text-(--text-2) flex items-center gap-1.5 flex-wrap [&_strong]:text-(--text) [&_strong]:font-bold [&_strong]:font-mono-num"
		aria-live="polite"
		role="status"
	></div>`;

	ui.savedBadge = html`<span
		class="font-mono-num text-[11px] font-bold"
	></span>`;
	ui.savedBtn = Button({
		className: "hidden h-8 rounded-(--r-sm)",
		content: frag`${Icons.bookmark({ size: 12, fill: false })} ${t("saved")} ${ui.savedBadge}`,
		onclick: onSavedClick,
	}) as HTMLButtonElement;

	ui.sortSelect = Select({
		name: "sort-by",
		variant: "xs",
		ariaLabel: t("sortBy"),
		title: t("sortBy"),
		className: "h-8 rounded-(--r-sm)",
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
		"size-7 border-none bg-transparent rounded-[6px] text-(--muted) hover:text-(--text) hover:bg-(--surface-3)/60 [&.on]:bg-(--surface-3) [&.on]:text-(--text) [&.on]:border-none [&.on]:shadow-[0_1px_3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]";

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

	const viewSegmented = html`
		<div
			class="inline-flex items-center gap-0.5 p-0.5 bg-(--surface-2) border border-(--border) rounded-(--r-sm)"
		>
			${ui.viewGridBtn}${ui.viewListBtn}${ui.viewMapBtn}
		</div>
	`;

	ui.validateBtn = Button({
		title: t("validateBtn"),
		content: frag`${Icons.refresh(12)} ${t("validateBtn")}`,
		color: "green",
		className: "hidden lg:inline-flex h-8",
		onclick: (e) => onValidate(e.currentTarget as HTMLButtonElement),
	}) as HTMLButtonElement;

	ui.exportBtn = Button({
		title: t("exportBtn"),
		content: frag`${Icons.download(12)} ${t("exportBtn")}`,
		color: "blue",
		className: "hidden md:inline-flex h-8",
		onclick: onExport,
	}) as HTMLButtonElement;

	ui.adminActions = html`<div class="contents"></div>`;

	ui.resultsBarInner = html`
		<div
			class="flex items-center justify-between gap-3 flex-wrap glass-panel bg-(--surface-glass) border border-(--border) rounded-(--r-lg) px-3.5 py-2.5 mb-4 surface-specular transition-shadow duration-200"
			style="display: none"
		>
			${ui.resultsMeta}
			<div class="flex items-center gap-1.5 flex-wrap">
				${ui.adminActions}
				${Button({
					title: t("telegramAlerts"),
					content: frag`${Icons.bell(12)} ${t("alertMe")}`,
					color: "yellow",
					className: "h-8",
					onclick: onAlertsOpen,
				})}
				${ui.savedBtn}
				<div class="w-px h-4.5 bg-(--border) mx-0.5 hidden sm:block"></div>
				${ui.sortSelect}
				${viewSegmented}
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
