import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { CardCallbacks, Property } from "@/core/types";
import {
	fmt,
	frag,
	hide,
	html,
	makeEventManager,
	show,
	toast,
	tTier,
} from "@/core/utils";
// Lazy triggered via bus.emit(EVENTS.GALLERY_OPEN)
// Map View is lazy loaded in setView()
// Lazy triggered via bus.emit(EVENTS.PROPERTY_OPEN)
import {
	getCachedAuthUser,
	isUserAuthenticated,
	openLoginModal,
} from "@/features/auth/api";
import { EmptyState } from "@/ui/empty-state";
import { Icons } from "@/ui/icons";
import { BackToTopButton } from "@/ui/scroll-top";
import { renderProductsBar } from "./bar";
import { appendSkeletons, renderList, updatePagination } from "./list";
import { hideItem, sortDeals, syncStateToStorage, toggleBM } from "./logic";
import type { ProductsUI } from "./types";

export function initProducts(container: HTMLElement): () => void {
	const ui: ProductsUI = {
		container,
		resultsMeta: null as unknown as HTMLElement,
		adminActions: null as unknown as HTMLElement,
		validateBtn: null as unknown as HTMLButtonElement,
		exportBtn: null as unknown as HTMLButtonElement,
		savedBtn: null as unknown as HTMLButtonElement,
		savedBadge: null as unknown as HTMLElement,
		sortSelect: null as unknown as HTMLSelectElement,
		viewGridBtn: null as unknown as HTMLButtonElement,
		viewListBtn: null as unknown as HTMLButtonElement,
		viewMapBtn: null as unknown as HTMLButtonElement,
		resultsBarInner: null as unknown as HTMLElement,
		resultsBarContainer: null as unknown as HTMLElement,
		loadingState: null as unknown as HTMLElement,
		emptyState: null as unknown as HTMLElement,
		welcomeState: null as unknown as HTMLElement,
		cardsContainer: null as unknown as HTMLElement,
		sentinel: null as unknown as HTMLElement,
		loadMoreContainer: null as unknown as HTMLElement,
		mapViewContainer: null as unknown as HTMLElement,
		backToTopBtn: null as unknown as HTMLButtonElement,
	};

	ui.loadingState = EmptyState({
		icon: Icons.spinner({
			size: 26,
			className: "animate-spin text-(--muted) opacity-40 mb-1",
		}),
		title: t("searching"),
	});

	ui.emptyState = EmptyState({
		icon: Icons.noResults({
			size: 42,
			strokeWidth: 1.4,
			className: "text-(--muted) opacity-40 mb-1",
		}),
		title: t("noResults"),
		subtitle: t("noResultsSub"),
	});

	ui.welcomeState = EmptyState({
		icon: Icons.home({
			size: 52,
			strokeWidth: 1.1,
			className: "text-(--muted) opacity-40 mb-1",
		}),
		title: t("welcome"),
		subtitle: t("welcomeSub"),
		hidden: true,
		padTop: true,
	});

	ui.cardsContainer = html`<div></div>`;
	ui.sentinel = html`<div></div>`;
	ui.loadMoreContainer = html`<div class="hidden"></div>`;
	ui.mapViewContainer = html`<div
		style="display:none;height:calc(100vh - 280px);min-height:460px"
		class="rounded-(--r-lg) overflow-hidden border border-(--border) shadow-(--shadow-card)"
	></div>`;

	const productsBar = renderProductsBar(ui, {
		onSortChange: () => {
			if (!isUserAuthenticated()) {
				if (ui.sortSelect.value !== "disc") {
					ui.sortSelect.value = "disc";
					openLoginModal("sort");
				}
				return;
			}
			localStorage.setItem("re-sort", ui.sortSelect.value);
			state.renderedSet.clear();
			if (state.showingSaved) {
				render();
				return;
			}
			bus.emit(EVENTS.SEARCH_STARTED, { more: false });
		},
		onViewChange: (view) => setView(view),
		onExport: () => {
			if (isAdminUser) {
				void import("./logic").then(({ handleExport }) =>
					handleExport(ui.sortSelect.value),
				);
			}
		},
		onValidate: (button) => void handleValidate(button),
		onSavedClick: (e) => void handleSavedClick(e),
		onAlertsOpen: () => {
			if (!isUserAuthenticated()) {
				openLoginModal("alerts");
				return;
			}
			bus.emit(EVENTS.ALERTS_OPEN);
		},
	});

	const backToTop = BackToTopButton();
	ui.backToTopBtn = backToTop.element;

	container.appendChild(
		frag`${productsBar}${ui.loadingState}${ui.emptyState}${ui.welcomeState}${ui.cardsContainer}${ui.sentinel}${ui.loadMoreContainer}${ui.mapViewContainer}`,
	);
	document.body.appendChild(ui.backToTopBtn);

	const cardCallbacks: CardCallbacks = {
		onBM: (p) => {
			toggleBM(p);
			updateSavedBadge();
			return state.bookmarks.has(p.source_url);
		},
		onHide: (url) => {
			hideItem(url);
			updateSavedBadge();
		},
		onGallery: (urls, index) => bus.emit(EVENTS.GALLERY_OPEN, { urls, index }),
		onDetail: (p) => bus.emit(EVENTS.PROPERTY_OPEN, p),
	};

	const isAdminUser = getCachedAuthUser()?.role === "admin";
	if (isAdminUser) {
		ui.adminActions.replaceChildren(ui.validateBtn, ui.exportBtn);
		cardCallbacks.onDelete = (p) => {
			void import("./logic").then(({ deleteItem }) =>
				deleteItem(p).then((deleted) => {
					if (deleted) updateSavedBadge();
				}),
			);
		};
	}

	function render(): void {
		let list = state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url));

		const sortBy = ui.sortSelect.value || "disc";

		if (state.currentView === "map") {
			show(ui.resultsBarInner);
			updateResultsMeta(list.length);
			return;
		}

		if (state.hasSearched) hide(ui.welcomeState);

		if (state.showingSaved) list = sortDeals(list, sortBy);
		if (!list.length) {
			if (!state.hasSearched) hide(ui.resultsBarInner);
			else {
				show(ui.resultsBarInner);
				updateResultsMeta(0);
			}
			show(ui.emptyState);
			ui.cardsContainer.replaceChildren();
			return;
		}

		show(ui.resultsBarInner);
		hide(ui.emptyState);
		renderList(ui, list, cardCallbacks);
		updateResultsMeta(list.length, list);
		updatePagination(ui);
		updateSavedBadge();
		scheduleScrollSync();
	}

	function updateResultsMeta(count: number, list: Property[] = []): void {
		const tierCounts = list.reduce<Record<string, number>>((acc, p) => {
			acc[p.tier] = (acc[p.tier] ?? 0) + 1;
			return acc;
		}, {});

		const TIER_BADGES = [
			{ t: "High Value Deal", c: "var(--green)" },
			{ t: "Good Deal", c: "var(--blue)" },
			{ t: "Fair Price", c: "var(--yellow)" },
			{ t: "Overpriced", c: "var(--red)" },
		];

		const distNodes = TIER_BADGES.filter((b) => tierCounts[b.t]).map((b) => {
			return frag`<span class="inline-flex items-center gap-1.25 text-xs font-medium" style="color:${b.c}"><span class="size-1.5 rounded-full shrink-0" style="background:${b.c}"></span><span class="font-mono-num font-semibold">${tierCounts[b.t]}</span> ${tTier(b.t, true)}</span>`;
		});

		const totalNode =
			state.currentTotal > state.allResults.length && !state.showingSaved
				? frag`<span class="text-xs font-mono-num text-(--muted)">/ ${fmt(state.currentTotal)} ${t("total")}</span>`
				: "";

		const label = state.showingSaved
			? count !== 1
				? t("savedDeals")
				: t("savedDeal")
			: count !== 1
				? t("results")
				: t("result");

		ui.resultsMeta.replaceChildren(
			frag`<span class="inline-flex items-baseline gap-1.5"><strong>${count}</strong><span>${label}</span>${totalNode}</span>${distNodes.length ? frag`<span class="w-px h-3.5 bg-(--border) mx-0.5 hidden sm:inline-block"></span><span class="inline-flex items-center gap-2.5 flex-wrap">${distNodes}</span>` : ""}`,
		);
	}

	function updateSavedBadge(): void {
		if (state.bookmarks.size > 0) {
			show(ui.savedBtn, "inline-flex");
			ui.savedBadge.textContent = String(state.bookmarks.size);
		} else {
			hide(ui.savedBtn);
		}
	}

	async function setView(view: "grid" | "list" | "map") {
		if (state.currentView === view) return;
		const wasMap = state.currentView === "map";
		state.currentView = view;

		ui.viewGridBtn.classList.toggle("on", view === "grid");
		ui.viewListBtn.classList.toggle("on", view === "list");
		ui.viewMapBtn.classList.toggle("on", view === "map");

		if (view === "map") {
			hide(ui.cardsContainer);
			hide(ui.sentinel);
			hide(ui.loadMoreContainer);
			hide(ui.emptyState);
			render();
			const { initMapView, showMapView } = await import(
				"@/features/map-view/index"
			);
			if (state.currentView !== "map") return;
			if (!cleanupMapView) cleanupMapView = initMapView(ui.mapViewContainer);
			showMapView();
		} else {
			if (wasMap) {
				const { hideMapView } = await import("@/features/map-view/index");
				hideMapView();
				show(ui.cardsContainer);
				show(ui.sentinel);
			}
			state.renderedSet.clear();
			render();
		}
		scheduleScrollSync();
	}

	async function handleSavedClick(e: MouseEvent) {
		const btn = e.currentTarget as HTMLElement;
		state.showingSaved = !state.showingSaved;
		btn.classList.toggle("on", state.showingSaved);
		state.renderedSet.clear();

		if (!state.showingSaved || state.bookmarks.size === 0) {
			state.savedOnlyResults = [];
			render();
			return;
		}

		const cached = [...state.bookmarkData.values()].filter((p) =>
			state.bookmarks.has(p.source_url),
		);
		state.savedOnlyResults = cached;
		render();

		if (!isUserAuthenticated()) return;

		try {
			const res = await fetch("/api/deals/by-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ urls: [...state.bookmarks] }),
			});
			const json = (await res.json()) as { data?: Property[] };
			if (!state.showingSaved) return;
			if (res.ok && Array.isArray(json.data)) {
				state.savedOnlyResults = json.data;
				for (const p of json.data) {
					state.bookmarkData.set(p.source_url, p);
				}
				syncStateToStorage();
				state.renderedSet.clear();
				render();
			}
		} catch {
			// Silently fail, cached data is already shown
		}
	}

	async function handleValidate(button: HTMLButtonElement): Promise<void> {
		if (
			!isAdminUser ||
			state.loading ||
			!state.hasSearched ||
			state.showingSaved
		)
			return;

		state.loading = true;
		button.disabled = true;
		button.replaceChildren(
			frag`${Icons.spinner({ size: 12, className: "animate-spin" })} ${t("validating")}`,
		);

		try {
			const filters = state.getFilters();
			const searchParams = new URLSearchParams({
				location: filters.location,
				threshold: String(filters.threshold),
				sort: ui.sortSelect.value || "disc",
			});

			Object.entries(filters).forEach(([key, val]) => {
				if (key !== "location" && key !== "threshold" && val !== undefined) {
					searchParams.set(key, String(val));
				}
			});

			const descriptionQuery =
				(
					document.getElementById(
						"descriptionSearch",
					) as HTMLInputElement | null
				)?.value.trim() || "";
			if (descriptionQuery) {
				searchParams.set("descriptionSearch", descriptionQuery);
			}

			const response = await fetch(
				`/api/deals/undervalued/validate?${searchParams}`,
				{
					method: "POST",
				},
			);
			const result = (await response.json()) as {
				error?: string;
				data: Property[];
				total: number;
				validation?: { checked: number; deleted: number; failed: number };
			};

			if (!response.ok || result.error) {
				throw new Error(result.error ?? `Request failed (${response.status})`);
			}

			state.allResults = result.data;
			state.currentTotal = result.total;
			state.currentOffset = result.data.length;
			state.renderedSet.clear();
			bus.emit(EVENTS.DEALS_UPDATED);
			const failed = result.validation?.failed ?? 0;
			if (failed > 0) {
				toast(
					t("validateDonePartial", {
						deleted: result.validation?.deleted ?? 0,
						failed,
						total: result.total,
					}),
					true,
				);
			} else {
				toast(
					t("validateDone", {
						deleted: result.validation?.deleted ?? 0,
						total: result.total,
					}),
				);
			}
		} catch (err) {
			toast((err as Error).message, true);
		} finally {
			state.loading = false;
			button.disabled = false;
			button.replaceChildren(frag`${Icons.refresh(12)} ${t("validateBtn")}`);
		}
	}

	const { add, cleanup: cleanupHandlers } = makeEventManager();
	let cleanupMapView: (() => void) | null = null;
	let typedIndexBuffer = "";
	let jumpTimer: ReturnType<typeof setTimeout> | null = null;
	let hideJumpTimer: ReturnType<typeof setTimeout> | null = null;
	let invalidJumpTimer: ReturnType<typeof setTimeout> | null = null;
	const jumpDelayMs = 550;
	const maxJumpDigits = 6;
	const jumpIndicator = html`<div
		class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-1001 min-w-24 h-24 px-6 rounded-(--r-xl) border border-(--border-h) glass-panel bg-(--surface-glass-strong) text-(--text) text-4xl font-bold font-mono-num inline-flex items-center justify-center shadow-(--shadow-float) opacity-0 pointer-events-none transition-opacity duration-120"
		style="display:none"
	></div>`;
	document.body.appendChild(jumpIndicator);

	const showJumpIndicator = (value: string) => {
		if (hideJumpTimer) {
			clearTimeout(hideJumpTimer);
			hideJumpTimer = null;
		}
		jumpIndicator.textContent = value;
		jumpIndicator.classList.remove("border-(--red-b)", "text-(--red)");
		jumpIndicator.style.display = "inline-flex";
		jumpIndicator.style.opacity = "1";
	};

	const hideJumpIndicator = () => {
		if (hideJumpTimer) clearTimeout(hideJumpTimer);
		jumpIndicator.style.opacity = "0";
		hideJumpTimer = setTimeout(() => {
			if (jumpIndicator.style.opacity === "0")
				jumpIndicator.style.display = "none";
			hideJumpTimer = null;
		}, 120);
	};

	const flashInvalidJump = () => {
		if (invalidJumpTimer) clearTimeout(invalidJumpTimer);
		jumpIndicator.classList.add("border-(--red-b)", "text-(--red)");
		invalidJumpTimer = setTimeout(() => {
			jumpIndicator.classList.remove("border-(--red-b)", "text-(--red)");
		}, 180);
	};

	const finishJump = () => {
		if (
			document.body.hasAttribute("data-dialog-open") ||
			isTextEntryFocused()
		) {
			typedIndexBuffer = "";
			jumpTimer = null;
			hideJumpIndicator();
			return;
		}

		const targetIndex = Number.parseInt(typedIndexBuffer, 10);
		const allCards = Array.from(
			ui.cardsContainer.firstElementChild?.children || [],
		).filter((c) => c.classList.contains("product-card")) as HTMLElement[];

		if (
			Number.isFinite(targetIndex) &&
			targetIndex >= 1 &&
			targetIndex <= allCards.length
		) {
			const targetCard = allCards[targetIndex - 1];
			targetCard?.focus({ preventScroll: true });
			targetCard?.scrollIntoView({ block: "nearest", behavior: "instant" });
		} else if (typedIndexBuffer) {
			flashInvalidJump();
		}

		typedIndexBuffer = "";
		jumpTimer = null;
		hideJumpIndicator();
	};

	const resetJumpTimer = () => {
		if (jumpTimer) clearTimeout(jumpTimer);
		jumpTimer = setTimeout(finishJump, jumpDelayMs);
	};

	const isTextEntryFocused = () => {
		const active = document.activeElement as HTMLElement | null;
		return Boolean(
			active &&
				(active.matches("input, textarea, select") || active.isContentEditable),
		);
	};

	let scrollRafId: number | null = null;

	const syncScrollUI = () => {
		const scrollY = window.scrollY;
		const maxScroll = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight,
		);
		const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
		const isVisible = state.currentView !== "map" && scrollY > 450;
		backToTop.update(isVisible, progress);

		if (ui.resultsBarInner) {
			const stuck = ui.resultsBarContainer.getBoundingClientRect().top <= 12;
			ui.resultsBarInner.classList.toggle("glass-panel", stuck);
			ui.resultsBarInner.classList.toggle("bg-(--surface-glass-strong)", stuck);
			ui.resultsBarInner.classList.toggle("border-(--border-h)", stuck);
			ui.resultsBarInner.classList.toggle("border-transparent", !stuck);
			ui.resultsBarInner.classList.toggle(
				"shadow-[var(--shadow-float)]",
				stuck,
			);
			ui.resultsBarInner.classList.toggle("px-4", stuck);
			ui.resultsBarInner.classList.toggle("py-2", stuck);
			ui.resultsBarInner.classList.toggle("px-0.5", !stuck);
			ui.resultsBarInner.classList.toggle("py-1.5", !stuck);
		}
	};

	function scheduleScrollSync() {
		if (scrollRafId !== null) return;
		scrollRafId = requestAnimationFrame(() => {
			scrollRafId = null;
			syncScrollUI();
		});
	}

	add(window, "scroll", scheduleScrollSync, { passive: true });
	add(window, "resize", scheduleScrollSync, { passive: true });
	syncScrollUI();

	const getColumnCount = () => {
		const wrap = ui.cardsContainer.firstElementChild as HTMLElement;
		if (!wrap) return 1;
		const style = getComputedStyle(wrap);
		if (style.display !== "grid") return 1;
		return style.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
	};

	add(document, "keydown", (e: KeyboardEvent) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (document.body.hasAttribute("data-dialog-open")) return;

		if (isTextEntryFocused()) return;

		if (/^[0-9]$/.test(e.key)) {
			typedIndexBuffer = (typedIndexBuffer + e.key).slice(0, maxJumpDigits);
			showJumpIndicator(typedIndexBuffer);
			resetJumpTimer();
			e.preventDefault();
			return;
		}

		if (e.key === "Backspace" && typedIndexBuffer.length > 0) {
			typedIndexBuffer = typedIndexBuffer.slice(0, -1);
			if (typedIndexBuffer.length > 0) {
				showJumpIndicator(typedIndexBuffer);
				resetJumpTimer();
			} else {
				if (jumpTimer) {
					clearTimeout(jumpTimer);
					jumpTimer = null;
				}
				hideJumpIndicator();
			}
			e.preventDefault();
			return;
		}

		if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
			return;

		const target = e.target as HTMLElement;
		const currentCard = target.closest(".product-card") as HTMLElement;
		if (!currentCard) return;

		const allCards = Array.from(
			ui.cardsContainer.firstElementChild?.children || [],
		).filter((c) => c.classList.contains("product-card")) as HTMLElement[];
		const currentIndex = allCards.indexOf(currentCard);
		if (currentIndex === -1) return;

		const cols = getColumnCount();
		let nextIndex = currentIndex;

		switch (e.key) {
			case "ArrowLeft":
				nextIndex = currentIndex - 1;
				break;
			case "ArrowRight":
				nextIndex = currentIndex + 1;
				break;
			case "ArrowUp":
				nextIndex = currentIndex - cols;
				break;
			case "ArrowDown":
				nextIndex = currentIndex + cols;
				break;
		}

		if (
			nextIndex >= 0 &&
			nextIndex < allCards.length &&
			nextIndex !== currentIndex
		) {
			e.preventDefault();
			allCards[nextIndex].focus({ preventScroll: true });
			allCards[nextIndex].scrollIntoView({
				block: "nearest",
				behavior: "instant",
			});
		}
	});

	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => render());

	const offSearchStart = bus.on(EVENTS.SEARCH_STARTED, (detail) => {
		if (detail?.more) appendSkeletons(ui);
	});

	const onPdBmark = (e: Event) => {
		const p = (e as CustomEvent<Property>).detail;
		if (p) {
			toggleBM(p);
			updateSavedBadge();
		}
	};
	const onPdHide = (e: Event) => {
		const p = (e as CustomEvent<Property>).detail;
		if (p) {
			const restoreFocus = prepareFocusRestore(p.source_url);
			const dialog = e.target instanceof HTMLDialogElement ? e.target : null;
			hideItem(p.source_url);
			updateSavedBadge();

			if (dialog?.open) {
				dialog.addEventListener("close", restoreFocus, { once: true });
			} else {
				restoreFocus();
			}
		}
	};
	const onPdDelete = (e: Event) => {
		const p = (e as CustomEvent<Property>).detail;
		if (p) {
			const dialog = e.target instanceof HTMLDialogElement ? e.target : null;
			void import("./logic").then(({ deleteItem }) =>
				deleteItem(p).then((deleted) => {
					if (deleted) {
						updateSavedBadge();
						if (dialog?.open) {
							dialog.close();
						}
					}
				}),
			);
		}
	};
	add(document, "pd:bmark", onPdBmark);
	add(document, "pd:hide", onPdHide);
	add(document, "pd:delete", onPdDelete);

	function prepareFocusRestore(url: string): () => void {
		const cards = Array.from(
			ui.cardsContainer.firstElementChild?.children || [],
		).filter((c) => c.classList.contains("product-card")) as HTMLElement[];
		const removedIndex = Math.max(
			0,
			cards.findIndex((card) => card.dataset.url === url),
		);

		return () => {
			requestAnimationFrame(() => {
				const remainingCards = Array.from(
					ui.cardsContainer.firstElementChild?.children || [],
				).filter((c) => c.classList.contains("product-card")) as HTMLElement[];
				const targetCard =
					remainingCards[Math.min(removedIndex, remainingCards.length - 1)];
				targetCard?.focus({ preventScroll: true });
			});
		};
	}

	// Populate global refs for other features
	state.refs.cards = ui.cardsContainer;
	state.refs.loading = ui.loadingState;
	state.refs.empty = ui.emptyState;
	state.refs.welcome = ui.welcomeState;
	state.refs.resultsBar = ui.resultsBarInner;
	state.refs.resultsMeta = ui.resultsMeta;
	state.refs.loadMore = ui.loadMoreContainer;
	state.refs.savedBtn = ui.savedBtn;
	state.refs.sortSelect = ui.sortSelect;

	// Restore persisted sort only for authenticated users
	if (isUserAuthenticated()) {
		const savedSort = localStorage.getItem("re-sort");
		if (savedSort) ui.sortSelect.value = savedSort;
	} else {
		ui.sortSelect.value = "disc";
	}

	return () => {
		cleanupHandlers();
		if (scrollRafId !== null) {
			cancelAnimationFrame(scrollRafId);
			scrollRafId = null;
		}
		if (jumpTimer) clearTimeout(jumpTimer);
		if (hideJumpTimer) clearTimeout(hideJumpTimer);
		if (invalidJumpTimer) clearTimeout(invalidJumpTimer);
		if (state.scrollObserver) {
			state.scrollObserver.disconnect();
			state.scrollObserver = null;
		}
		offDeals();
		offSearchStart();
		ui.backToTopBtn.remove();
		jumpIndicator.remove();
		if (cleanupMapView) cleanupMapView();
	};
}
