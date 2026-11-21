import { t } from "@/core/i18n";
import { frag, hide, html } from "@/core/utils";
import { Button, RawButton } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icons } from "@/ui/icons";
import { Field, Input, RawInput } from "@/ui/input";
import { Label } from "@/ui/label";
import { MultiSelect } from "@/ui/multi-select";
import { RawRange, setRangeColor, setRangeProgress } from "@/ui/range";
import { Select } from "@/ui/select";
import { thresholdStyle } from "@/ui/tier";
import { getBooleanFilters, getNumericFilters } from "./constants";
import type { SearchCallbacks, SearchUI } from "./types";

/**
 * Synchronizes the discount slider fill, color theme, and value pill
 * to reflect the current threshold value.
 */
export function syncDiscountThresholdUI(ui: SearchUI): void {
	const value = Number(ui.discountRange.value);
	const style = thresholdStyle(value);

	setRangeProgress(ui.discountRange);
	setRangeColor(ui.discountRange, {
		track: style.c,
		thumb: style.solid,
		glow: style.glow,
	});

	ui.discountValueDisplay.textContent = value === 0 ? t("all") : `${value}%`;
	ui.discountValueDisplay.style.color = style.c;
	ui.discountValueDisplay.style.backgroundColor = style.bg;
	ui.discountValueDisplay.style.borderColor = style.b;
}

/**
 * Renders the unified command search bar, quick-filter strip,
 * and collapsible advanced filters drawer.
 */
export function renderSearchFilters(
	ui: SearchUI,
	callbacks: SearchCallbacks,
): HTMLElement {
	const { onFilterChange, onPriceMap, onClear } = callbacks;

	ui.locationSelect = MultiSelect({
		id: "loc-trigger",
		placeholder: t("chooseLocs"),
		variant: "embedded",
		className: "w-full",
		exclusiveValue: "__all__",
		options: [],
		onChange: onFilterChange,
	});

	ui.priceMapActionBtn = Button({
		id: "price-map-btn",
		title: t("priceMapTitle"),
		color: "indigo",
		variant: "padded",
		ariaLabel: t("priceMap"),
		className:
			"h-8 px-3 rounded-full bg-(--surface-2) border-(--border) hover:border-(--accent-b) hover:text-(--accent) hover:bg-(--accent-dim) font-semibold shrink-0",
		content: frag`${Icons.globe(13)} <span class="max-[420px]:hidden">${t("priceMap")}</span>`,
		onclick: onPriceMap,
	}) as HTMLButtonElement;

	ui.descriptionInput = RawInput({
		id: "descriptionSearch",
		type: "text",
		placeholder: t("descriptionSearchPlaceholder"),
		className:
			"w-full h-7 bg-transparent border-none text-[13.5px] font-medium text-(--text) placeholder:text-(--muted)/70 focus:outline-none p-0",
		oninput: onFilterChange,
	});

	ui.discountValueDisplay = html`<span
		class="text-[11px] font-bold font-mono-num border px-2 py-px rounded-full leading-tight transition-colors duration-150"
		>10%</span
	>`;

	ui.discountRange = RawRange({
		id: "discount-threshold",
		min: 0,
		max: 50,
		value: 10,
		ariaLabel: t("discountThreshold"),
		oninput: () => {
			syncDiscountThresholdUI(ui);
			onFilterChange();
		},
	});
	syncDiscountThresholdUI(ui);

	ui.advancedCount = html`<span
		class="bg-(--accent-solid) text-white rounded-full min-w-4.5 h-4.5 px-1.25 text-[10px] font-bold font-mono-num inline-flex items-center justify-center"
	></span>`;
	hide(ui.advancedCount);

	ui.advancedToggle = html`
		<button
			type="button"
			aria-expanded="false"
			class="group w-full lg:w-auto h-9.5 inline-flex items-center justify-center gap-2 bg-(--surface-2)/90 border border-(--border) rounded-(--r) px-3.75 text-(--text-2) text-xs font-semibold transition-all duration-180 hover:border-(--border-h) hover:text-(--text) hover:bg-(--surface-3) aria-expanded:text-(--accent) aria-expanded:border-(--accent-b) aria-expanded:bg-(--accent-dim) whitespace-nowrap"
		>
			${Icons.sliders(13)}
			<span>${t("advancedFilters")}</span>
			${ui.advancedCount}
			${Icons.chevron(
				11,
				"opacity-65 transition-transform duration-200 group-aria-expanded:rotate-180",
			)}
		</button>
	` as HTMLButtonElement;

	ui.advancedToggle.onclick = () => {
		const isOpen = ui.advancedPanel.classList.toggle("open");
		ui.advancedToggle.setAttribute("aria-expanded", String(isOpen));
	};

	ui.categorySelect = Select({
		id: "category",
		className: "w-full",
		options: [
			{ value: "", label: t("any") },
			{ value: "new", label: t("newBuild") },
			{ value: "old", label: t("secondary") },
			{ value: "house", label: t("house") },
		],
		onchange: onFilterChange,
	});

	ui.listingTypeSelect = Select({
		id: "listingType",
		variant: "xs",
		ariaLabel: t("listingType"),
		className:
			"h-7.5 rounded-full bg-(--surface) border-(--border) text-(--text) font-semibold pl-3.25 pr-7.5",
		options: [
			{ value: "sale", label: t("sale") },
			{ value: "rent", label: t("rent") },
		],
		onchange: onFilterChange,
	});

	ui.mortgageSelect = Select({
		id: "hasActiveMortgage",
		className: "w-full",
		options: [
			{ value: "", label: t("any") },
			{ value: "false", label: t("no") },
			{ value: "true", label: t("yes") },
		],
		onchange: onFilterChange,
	});

	ui.clearAllBtn = RawButton({
		className:
			"inline-flex items-center gap-1.5 text-xs font-medium text-(--text-2) hover:text-(--red) transition-colors border border-(--border) hover:border-(--red-b) hover:bg-(--red-dim) rounded-full px-3.5 py-1.75 h-9.5",
		content: frag`${Icons.close(11)} ${t("clearFilters")}`,
		onclick: onClear,
	});

	ui.advancedPanel = html`
		<div class="filter-drawer">
			<div>
				<div
					class="p-4 sm:p-5 border-t border-(--border) bg-(--surface-2)/35 rounded-b-(--r-lg) space-y-4"
				>
					<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
						${getNumericFilters().map((config) => {
							ui.numericInputs[config.id] = Input({
								id: config.id,
								type: "number",
								placeholder: config.placeholder,
								className: "w-full font-mono-num",
								min: "0",
								oninput: (e) => {
									const input = e.target as HTMLInputElement;
									if (input.value && parseFloat(input.value) < 0) {
										input.value = "";
									}
									onFilterChange();
								},
							});
							return Field({
								label: config.label,
								htmlFor: config.id,
								input: ui.numericInputs[config.id],
							});
						})}
					</div>

					<div
						class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-end pt-3.5 border-t border-(--border-subtle)"
					>
						${Field({
							label: t("category"),
							htmlFor: "category",
							input: ui.categorySelect,
						})}
						${Field({
							label: t("activeMortgage"),
							htmlFor: "hasActiveMortgage",
							input: ui.mortgageSelect,
						})}
						<div class="flex justify-end">${ui.clearAllBtn}</div>
					</div>
				</div>
			</div>
		</div>
	`;

	const quickFiltersRow = html`
		<div class="flex items-center gap-2 flex-wrap mb-3.5">
			${ui.listingTypeSelect}
			<div class="w-px h-4 bg-(--border) mx-0.5 hidden sm:block"></div>
			${getBooleanFilters().map((config) => {
				const chipWrapper = Chip({
					id: config.id,
					label: config.label,
					onchange: onFilterChange,
				});
				ui.booleanInputs[config.id] = chipWrapper.inputElement;
				return chipWrapper;
			})}
		</div>
	`;

	ui.activeChipsContainer = html`<div
		class="flex flex-wrap gap-1.75 mb-3.5"
	></div>`;
	hide(ui.activeChipsContainer);

	const eyebrowCls =
		"text-[10px] font-semibold text-(--muted) tracking-[0.08em] uppercase leading-none";

	return html`
		<div>
			<!-- Unified Single-Row Command Bar -->
			<div
				class="bg-(--surface) border border-(--border) rounded-(--r-lg) mb-3 surface-specular transition-[border-color] duration-200 focus-within:border-(--border-h)"
			>
				<div
					class="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr_260px_auto] divide-y lg:divide-y-0 lg:divide-x divide-(--border)"
				>
					<!-- Location + Map Trigger -->
					<div
						class="px-4 py-2.75 flex items-center justify-between gap-2.5 min-w-0"
					>
						<div class="flex-1 min-w-0 flex flex-col gap-0.75">
							${Label({
								text: t("location"),
								htmlFor: "loc-trigger",
								className: eyebrowCls,
							})}
							${ui.locationSelect}
						</div>
						${ui.priceMapActionBtn}
					</div>

					<!-- Keyword Search -->
					<div
						class="px-4 py-2.75 flex flex-col justify-center gap-0.75 min-w-0"
					>
						${Label({
							text: t("descriptionSearch"),
							htmlFor: "descriptionSearch",
							className: eyebrowCls,
						})}
						<div class="flex items-center gap-2 min-w-0">
							<span class="text-(--muted) shrink-0">${Icons.search(14)}</span>
							${ui.descriptionInput}
						</div>
					</div>

					<!-- Discount Threshold -->
					<div class="px-4 py-2.75 flex flex-col justify-center gap-2">
						<div class="flex items-center justify-between gap-2">
							${Label({
								text: t("discountThreshold"),
								htmlFor: "discount-threshold",
								className: eyebrowCls,
							})}
							${ui.discountValueDisplay}
						</div>
						<div class="flex items-center h-4">${ui.discountRange}</div>
					</div>

					<!-- Advanced Filters Trigger -->
					<div class="px-3.5 py-2.5 lg:py-0 flex items-center justify-center">
						${ui.advancedToggle}
					</div>
				</div>

				${ui.advancedPanel}
			</div>

			<!-- Quick Filter Strip -->
			${quickFiltersRow}
		</div>
	`;
}
