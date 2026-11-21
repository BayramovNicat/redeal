import { t } from "@/core/i18n";
import { hide, show } from "@/core/utils";
import { CloseableChip } from "@/ui/chip";
import { getBooleanFilters, getNumericFilters } from "./constants";
import type { SearchUI } from "./types";

const categoryLabels: Record<string, string> = {
	new: t("newBuild"),
	old: t("secondary"),
	house: t("house"),
};

const listingTypeLabels: Record<string, string> = {
	sale: t("sale"),
	rent: t("rent"),
};

/**
 * Updates the filter chips display based on current UI state.
 */
export function refreshFilterChips(ui: SearchUI, onSearch: () => void): void {
	const activeChips: HTMLElement[] = [];

	const isFilterChecked = (id: string) =>
		ui.booleanInputs[id]?.checked || false;
	const getNumericValue = (id: string) =>
		ui.numericInputs[id]?.value.trim() || "";

	// Helper to create a removable chip
	const createChip = (label: string, clear: () => void) => {
		return CloseableChip({
			label,
			onClose: () => {
				clear();
				refreshFilterChips(ui, onSearch);
				onSearch();
			},
		});
	};

	for (const config of getBooleanFilters()) {
		if (isFilterChecked(config.id)) {
			activeChips.push(
				createChip(config.label, () => {
					ui.booleanInputs[config.id].checked = false;
				}),
			);
		}
	}

	for (const config of getNumericFilters()) {
		const value = getNumericValue(config.id);
		if (value) {
			activeChips.push(
				createChip(`${config.chipLabel}: ${value}`, () => {
					ui.numericInputs[config.id].value = "";
				}),
			);
		}
	}

	if (ui.categorySelect.value) {
		const label =
			categoryLabels[ui.categorySelect.value] ?? ui.categorySelect.value;
		activeChips.push(
			createChip(`${t("chipCategory")}: ${label}`, () => {
				ui.categorySelect.value = "";
			}),
		);
	}

	if (ui.listingTypeSelect.value && ui.listingTypeSelect.value !== "sale") {
		const label =
			listingTypeLabels[ui.listingTypeSelect.value] ??
			ui.listingTypeSelect.value;
		activeChips.push(
			createChip(`${t("listingType")}: ${label}`, () => {
				ui.listingTypeSelect.value = "sale";
			}),
		);
	}

	if (ui.mortgageSelect.value) {
		const label = ui.mortgageSelect.value === "true" ? t("yes") : t("no");
		activeChips.push(
			createChip(`${t("chipActiveMortgage")}: ${label}`, () => {
				ui.mortgageSelect.value = "";
			}),
		);
	}

	const desc = ui.descriptionInput.value.trim();
	if (desc) {
		activeChips.push(
			createChip(`${t("chipDescSearch")}: ${desc}`, () => {
				ui.descriptionInput.value = "";
			}),
		);
	}

	ui.activeChipsContainer.replaceChildren(...activeChips);
	if (activeChips.length) show(ui.activeChipsContainer, "flex");
	else hide(ui.activeChipsContainer);

	if (activeChips.length) {
		ui.advancedCount.textContent = String(activeChips.length);
		show(ui.advancedCount, "inline-flex");
	} else {
		hide(ui.advancedCount);
	}
}
