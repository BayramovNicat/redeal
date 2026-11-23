import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { Property } from "@/core/types";
import { hide, html, makeEventManager, show, toast } from "@/core/utils";
import { isUserAuthenticated, openLoginModal } from "@/features/auth/api";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";
import type { MultiSelectElement } from "@/ui/multi-select";
import { SkeletonList } from "@/ui/skeleton";
// Lazy triggered via bus.emit(EVENTS.HEATMAP_OPEN)
import { refreshFilterChips } from "./chips";
import { getBooleanFilters, getNumericFilters } from "./constants";
import { renderSearchFilters } from "./filters";
import {
	consumePreloadedDealsFetch,
	consumePreloadedLocationsFetch,
} from "./preload";
import type { SearchUI } from "./types";
import {
	hasNonDefaultUrlFilters,
	resetGatedFiltersToDefault,
	restorePublicFiltersFromUrl,
	restoreStateFromUrl,
	saveFiltersToStorage,
	syncPublicFiltersToUrl,
	syncStateToUrl,
} from "./url";

export function initSearch(container: HTMLElement): () => void {
	const globalElements = {
		resultsContainer: state.refs.cards as HTMLElement,
		loadingIndicator: state.refs.loading as HTMLElement,
		emptyState: state.refs.empty as HTMLElement,
		welcomeState: state.refs.welcome as HTMLElement,
		resultsBar: state.refs.resultsBar as HTMLElement,
		loadMoreButton: state.refs.loadMore as HTMLElement,
		trendPanel: state.refs.trendPanel as HTMLElement,
		savedToggleBtn: state.refs.savedBtn as HTMLElement,
	};

	const ui: SearchUI = {
		locationSelect: null as unknown as MultiSelectElement,
		discountRange: null as unknown as HTMLInputElement,
		discountValueDisplay: null as unknown as HTMLElement,
		advancedToggle: null as unknown as HTMLButtonElement,
		advancedPanel: null as unknown as HTMLElement,
		advancedCount: null as unknown as HTMLElement,
		activeChipsContainer: null as unknown as HTMLElement,
		clearAllBtn: null as unknown as HTMLButtonElement,
		categorySelect: null as unknown as HTMLSelectElement,
		listingTypeSelect: null as unknown as HTMLSelectElement,
		mortgageSelect: null as unknown as HTMLSelectElement,
		descriptionInput: null as unknown as HTMLInputElement,
		priceMapActionBtn: null as unknown as HTMLButtonElement,
		numericInputs: {},
		booleanInputs: {},
	};

	// Assign filter bridge immediately to avoid TDZ for other modules
	state.getFilters = (): import("@/core/types").AlertFilters => {
		const locations = ui.locationSelect?.getValue() || [];
		const filters: import("@/core/types").AlertFilters = {
			location: locations.join(",") || "__all__",
			threshold: ui.discountRange ? Number(ui.discountRange.value) : 10,
		};

		for (const config of getNumericFilters()) {
			const val = ui.numericInputs[config.id]?.value.trim();
			if (val) filters[config.id] = Number(val);
		}

		for (const config of getBooleanFilters()) {
			if (ui.booleanInputs[config.id]?.checked) filters[config.id] = true;
		}

		if (ui.categorySelect?.value) filters.category = ui.categorySelect.value;
		if (ui.listingTypeSelect?.value) {
			filters.listingType = ui.listingTypeSelect.value as "sale" | "rent";
		}
		if (ui.mortgageSelect?.value) {
			filters.hasActiveMortgage = ui.mortgageSelect.value === "true";
		}

		return filters;
	};

	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	function debouncedSearch() {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => void executeSearch(false), 500);
	}

	function resetUIForSearch() {
		state.allResults = [];
		state.savedOnlyResults = [];
		state.currentOffset = 0;
		state.currentTotal = 0;
		state.showingSaved = false;
		state.renderedSet.clear();
		state.hasSearched = true;
		globalElements.savedToggleBtn?.classList.remove("on");

		hide(globalElements.welcomeState);
		hide(globalElements.emptyState);
		hide(globalElements.loadMoreButton);
		hide(globalElements.trendPanel);

		globalElements.resultsContainer.replaceChildren();
		show(globalElements.resultsBar);

		if (state.currentView === "map") {
			show(globalElements.loadingIndicator);
		} else {
			globalElements.resultsContainer.appendChild(
				SkeletonList(state.currentView as "grid" | "row"),
			);
		}
	}

	function buildSearchParams(
		currentFilters: import("@/core/types").AlertFilters,
	) {
		const searchParams = new URLSearchParams({
			location: currentFilters.location,
			threshold: String(currentFilters.threshold),
			limit: String(state.PAGE),
			offset: String(state.currentOffset),
			sort: state.refs.sortSelect?.value || "disc",
		});

		Object.entries(currentFilters).forEach(([key, val]) => {
			if (key !== "location" && key !== "threshold" && val !== undefined) {
				searchParams.set(key, String(val));
			}
		});

		const descriptionQuery = ui.descriptionInput.value.trim();
		if (descriptionQuery)
			searchParams.set("descriptionSearch", descriptionQuery);

		return searchParams;
	}

	let searchAbortController: AbortController | null = null;

	async function executeSearch(isPagination = false): Promise<void> {
		if (state.loading) {
			if (isPagination) return;
			searchAbortController?.abort();
		}

		const isGuest = !isUserAuthenticated();
		if (isGuest && isPagination) {
			openLoginModal("more", {
				total: state.currentTotal,
				limit: state.previewLimit,
			});
			return;
		}

		const locations = ui.locationSelect.getValue();
		if (locations.length === 0) {
			ui.locationSelect.focus({ preventScroll: true });
			return;
		}

		const controller = new AbortController();
		searchAbortController = controller;
		state.loading = true;
		if (!isPagination) resetUIForSearch();

		try {
			const searchParams = buildSearchParams(state.getFilters());
			const dealsUrl = `/api/deals/undervalued?${searchParams}`;
			const response = await (consumePreloadedDealsFetch(dealsUrl) ??
				fetch(dealsUrl, { signal: controller.signal }));
			if (controller.signal.aborted) return;

			const searchResults = (await response.json()) as {
				error?: string;
				code?: string;
				preview?: boolean;
				preview_limit?: number;
				data: Property[];
				total: number;
			};
			if (controller.signal.aborted) return;

			hide(globalElements.loadingIndicator);

			if (response.status === 401 || searchResults.code === "AUTH_REQUIRED") {
				if (!isPagination) globalElements.resultsContainer.replaceChildren();
				if (isGuest) {
					resetGatedFiltersToDefault(ui);
					openLoginModal("filter");
				} else {
					toast(searchResults.error ?? "Unauthorized", true);
				}
				return;
			}

			if (!response.ok || searchResults.error) {
				if (!isPagination) globalElements.resultsContainer.replaceChildren();
				toast(
					searchResults.error ?? `Request failed (${response.status})`,
					true,
				);
				return;
			}

			state.isPreviewLimited = Boolean(searchResults.preview);
			if (searchResults.preview_limit) {
				state.previewLimit = searchResults.preview_limit;
			}
			state.allResults = [...state.allResults, ...searchResults.data];
			state.currentTotal = searchResults.total;
			state.currentOffset += searchResults.data.length;

			if (!isPagination) {
				refreshFilterChips(ui, debouncedSearch);
				if (isGuest) {
					syncPublicFiltersToUrl(locations, Number(ui.discountRange.value));
				} else {
					saveFiltersToStorage(ui);
					syncStateToUrl(searchParams);
				}

				// Location broadcast (always notify so Trend panel hides when leaving single-location mode)
				bus.emit(
					EVENTS.LOCATION_CHANGED,
					locations.length === 1 && locations[0] !== "__all__"
						? locations[0]
						: "__all__",
				);
			}

			// UI Update
			if (state.allResults.length === 0) {
				globalElements.resultsContainer.replaceChildren();
				show(globalElements.emptyState);
				hide(globalElements.resultsBar);
			} else {
				bus.emit(EVENTS.DEALS_UPDATED);
			}
		} catch (error) {
			if ((error as Error).name === "AbortError") return;
			hide(globalElements.loadingIndicator);
			if (!isPagination) globalElements.resultsContainer.replaceChildren();
			toast((error as Error).message, true);
		} finally {
			if (searchAbortController === controller) {
				searchAbortController = null;
				state.loading = false;
			}
		}
	}

	function hasAnyGatedFilter(): boolean {
		if (ui.listingTypeSelect.value !== "sale") return true;
		if (ui.categorySelect.value !== "") return true;
		if (ui.mortgageSelect.value !== "") return true;
		if (ui.descriptionInput.value.trim() !== "") return true;
		for (const config of getNumericFilters()) {
			if (ui.numericInputs[config.id].value.trim() !== "") return true;
		}
		for (const config of getBooleanFilters()) {
			if (ui.booleanInputs[config.id].checked) return true;
		}
		return false;
	}

	function promptGuestFilterLogin() {
		resetGatedFiltersToDefault(ui);
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		openLoginModal("filter");
	}

	function onFilterChange() {
		if (!isUserAuthenticated()) {
			if (hasAnyGatedFilter()) {
				promptGuestFilterLogin();
				return;
			}
			refreshFilterChips(ui, debouncedSearch);
			debouncedSearch();
			return;
		}
		refreshFilterChips(ui, debouncedSearch);
		saveFiltersToStorage(ui);
		debouncedSearch();
	}

	const onClear = () => {
		if (!isUserAuthenticated()) {
			resetGatedFiltersToDefault(ui);
			return;
		}
		for (const config of getNumericFilters())
			ui.numericInputs[config.id].value = "";
		for (const config of getBooleanFilters())
			ui.booleanInputs[config.id].checked = false;
		ui.categorySelect.value = "";
		ui.listingTypeSelect.value = "sale";
		ui.mortgageSelect.value = "";
		ui.descriptionInput.value = "";
		refreshFilterChips(ui, debouncedSearch);
		saveFiltersToStorage(ui);
		void executeSearch(false);
	};

	const onPriceMap = () => {
		const activeLocations = ui.locationSelect.getValue();
		bus.emit(EVENTS.HEATMAP_OPEN, {
			activeLocations,
			onAction: (locName: string, isToggle: boolean) => {
				if (isToggle) {
					const current = ui.locationSelect
						.getValue()
						.filter((v) => v !== "__all__");
					const idx = current.indexOf(locName);
					if (idx > -1) {
						const next = current.filter((v) => v !== locName);
						ui.locationSelect.setValue(next.length > 0 ? next : ["__all__"]);
					} else {
						ui.locationSelect.setValue([...current, locName]);
					}
				} else {
					ui.locationSelect.setValue([locName]);
				}
				bus.emit(EVENTS.SEARCH_STARTED, { more: false });
			},
			onSelectMany: (locNames: string[]) => {
				ui.locationSelect.setValue(
					locNames.length > 0 ? locNames : ["__all__"],
				);
				bus.emit(EVENTS.SEARCH_STARTED, { more: false });
			},
		});
	};

	const searchLayout = renderSearchFilters(ui, {
		onFilterChange,
		onPriceMap,
		onClear,
	});

	const guestBanner = !isUserAuthenticated()
		? html`
			<div
				id="guest-preview-banner"
				class="flex items-center justify-between gap-3 flex-wrap rounded-(--r) border border-(--accent-b)/60 bg-(--accent-dim)/45 px-3.5 py-2 mb-3.5 text-xs"
			>
				<div class="flex items-center gap-2 min-w-0">
					<span class="inline-flex items-center gap-1 rounded-full bg-(--accent-dim) border border-(--accent-b) px-2 py-0.5 text-[10.5px] font-semibold text-(--accent) shrink-0">
						${Icons.lock(10)}
						<span>${t("previewBannerBadge")}</span>
					</span>
					<span class="text-(--text-2) leading-snug">
						${t("previewBannerText")}
					</span>
				</div>
				${Button({
					title: t("signIn"),
					ariaLabel: t("signIn"),
					color: "indigo",
					variant: "padded",
					content: html`<span class="flex items-center gap-1.5">${Icons.logIn(12)}<span>${t("signIn")}</span></span>`,
					className:
						"h-7 px-3 rounded-full bg-(--accent-solid) hover:bg-(--accent) border-(--accent-b) text-white text-[11.5px] font-semibold shrink-0",
					onclick: () => openLoginModal("general"),
				})}
			</div>
		`
		: null;

	if (guestBanner) {
		container.append(searchLayout, guestBanner, ui.activeChipsContainer);
	} else {
		container.append(searchLayout, ui.activeChipsContainer);
	}

	const { add, cleanup: cleanupHandlers } = makeEventManager();

	add(document, "keydown", (e: KeyboardEvent) => {
		const target = e.target as Element | null;
		if (
			e.key === "Enter" &&
			!e.defaultPrevented &&
			!document.body.hasAttribute("data-dialog-open") &&
			target &&
			!["BUTTON", "A", "SELECT"].includes(target.tagName)
		) {
			if (!isUserAuthenticated()) {
				if (
					target.tagName === "INPUT" &&
					target.id !== "discount-threshold" &&
					!target.closest('[role="listbox"]')
				) {
					openLoginModal("filter");
				}
				return;
			}
			void executeSearch(false);
		}
	});

	const offSearchBus = bus.on(
		EVENTS.SEARCH_STARTED,
		(data: { more?: boolean } | undefined) => {
			void executeSearch(data?.more ?? false);
		},
	);

	const initialUrlParams = new URLSearchParams(window.location.search);
	const guestLandedWithFilters =
		!isUserAuthenticated() && hasNonDefaultUrlFilters(initialUrlParams);
	const intendedReturnTo = guestLandedWithFilters
		? window.location.pathname + window.location.search
		: undefined;

	if (isUserAuthenticated()) {
		restoreStateFromUrl(ui);
	} else {
		resetGatedFiltersToDefault(ui);
		restorePublicFiltersFromUrl(ui);
	}
	refreshFilterChips(ui, debouncedSearch);

	if (guestLandedWithFilters) {
		openLoginModal("filter", { returnTo: intendedReturnTo });
	}

	async function loadInitialData() {
		const searchPromise = executeSearch(false);

		try {
			const response = await (consumePreloadedLocationsFetch() ??
				fetch("/api/deals/locations"));
			const locationData = (await response.json()) as { data: string[] };
			const locationOptions = [
				{ value: "__all__", label: t("allLocations") },
				...locationData.data.map((loc) => ({ value: loc, label: loc })),
			];

			ui.locationSelect.setOptions(locationOptions);
		} catch {
			ui.locationSelect.setOptions([{ value: "", label: t("failedLocs") }]);
		}

		await searchPromise;
	}

	void loadInitialData();

	return () => {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		cleanupHandlers();
		offSearchBus();
	};
}
