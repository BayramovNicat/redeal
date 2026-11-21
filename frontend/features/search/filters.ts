import { t } from "@/core/i18n";
import { frag, hide, html } from "@/core/utils";
import { Button, RawButton } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icons } from "@/ui/icons";
import { Field, Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { MultiSelect } from "@/ui/multi-select";
import { Range } from "@/ui/range";
import { Select } from "@/ui/select";
import { getBooleanFilters, getNumericFilters } from "./constants";
import type { SearchCallbacks, SearchUI } from "./types";

/**
 * Renders the search filter command dock and populates the UI references.
 */
export function renderSearchFilters(
	ui: SearchUI,
	callbacks: SearchCallbacks,
): HTMLElement {
	const { onFilterChange, onPriceMap, onClear } = callbacks;

	ui.locationSelect = MultiSelect({
		id: "loc-trigger",
		placeholder: t("chooseLocs"),
		className: "w-full",
		exclusiveValue: "__all__",
		options: [],
		onChange: onFilterChange,
	});

	ui.priceMapActionBtn = Button({
		id: "price-map-btn",
		title: t("priceMapTitle"),
		color: "indigo",
		variant: "base",
		ariaLabel: t("priceMap"),
		className: "h-10 px-3.75 rounded-(--r) font-semibold w-full md:w-auto",
		content: frag`${Icons.globe(14)} <span>${t("priceMap")}</span>`,
		onclick: onPriceMap,
	}) as HTMLButtonElement;

	ui.discountValueDisplay = html`<span
		class="text-[11px] font-bold font-mono-num text-(--accent) bg-(--accent-dim) border border-(--accent-b) px-2 py-0.5 rounded-full leading-tight"
		>10%</span
	>`;

	const rangeWrapper = Range({
		id: "discount-threshold",
		min: 0,
		max: 50,
		value: 10,
		ariaLabel: t("discountThreshold"),
		oninput: (e) => {
			const value = (e.target as HTMLInputElement).value;
			ui.discountValueDisplay.textContent =
				value === "0" ? t("all") : `${value}%`;
			onFilterChange();
		},
	});
	ui.discountRange = rangeWrapper.inputElement;

	ui.advancedCount = html`<span
		class="bg-(--accent-solid) text-white rounded-full min-w-4.5 h-4.5 px-1.25 text-[10px] font-bold font-mono-num inline-flex items-center justify-center"
	></span>`;
	hide(ui.advancedCount);

	ui.advancedToggle = html`
		<button
			type="button"
			aria-expanded="false"
			class="group inline-flex items-center gap-2 bg-(--surface-2)/70 border border-(--border) rounded-full px-3.5 py-1.5 text-(--text-2) text-xs font-semibold transition-all duration-150 hover:border-(--border-h) hover:text-(--text) hover:bg-(--surface-3)/70 aria-expanded:text-(--accent) aria-expanded:border-(--accent-b) aria-expanded:bg-(--accent-dim)"
		>
			${Icons.chevron(
				12,
				"transition-transform duration-200 group-aria-expanded:rotate-180",
			)}
			<span>${t("advancedFilters")}</span>
			${ui.advancedCount}
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
		className: "w-full",
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

	ui.descriptionInput = Input({
		id: "descriptionSearch",
		type: "text",
		placeholder: t("descriptionSearchPlaceholder"),
		className: "w-full",
		oninput: onFilterChange,
	});

	ui.clearAllBtn = RawButton({
		className:
			"inline-flex items-center gap-1.5 text-xs font-medium text-(--text-2) hover:text-(--red) transition-colors border border-(--border) hover:border-(--red-b) hover:bg-(--red-dim) rounded-full px-3.25 py-1.5",
		content: frag`${Icons.close(11)} ${t("clearFilters")}`,
		onclick: onClear,
	});

	ui.advancedPanel = html`
		<div class="filter-drawer">
			<div>
				<div class="pt-4 mt-4 border-t border-(--border) space-y-4">
					<div
						class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
					>
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
						class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-(--border-subtle)"
					>
						${Field({
							label: t("listingType"),
							htmlFor: "listingType",
							input: ui.listingTypeSelect,
						})}
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
						${Field({
							label: t("descriptionSearch"),
							htmlFor: "descriptionSearch",
							input: ui.descriptionInput,
						})}
					</div>

					<div
						class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-(--border-subtle)"
					>
						<div class="flex flex-wrap gap-2">
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
						${ui.clearAllBtn}
					</div>
				</div>
			</div>
		</div>
	`;

	ui.activeChipsContainer = html`<div
		class="flex flex-wrap gap-1.75 mb-4"
	></div>`;
	hide(ui.activeChipsContainer);

	return html`
		<div
			class="bg-(--surface) border border-(--border) rounded-(--r-lg) p-4 sm:p-5 mb-4 surface-specular"
		>
			<div
				class="grid grid-cols-1 md:grid-cols-[1fr_auto_280px] gap-3.5 items-end"
			>
				${Field({
					label: t("location"),
					htmlFor: "loc-trigger",
					input: ui.locationSelect,
				})}
				<div class="flex items-end">
					${ui.priceMapActionBtn}
				</div>
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between gap-2">
						${Label({
							text: t("discountThreshold"),
							htmlFor: "discount-threshold",
						})}
						${ui.discountValueDisplay}
					</div>
					${rangeWrapper}
				</div>
			</div>
			<div class="flex items-center justify-between mt-3.5">
				${ui.advancedToggle}
			</div>
			${ui.advancedPanel}
		</div>
	`;
}
