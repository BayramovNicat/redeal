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
import { Button, RawButton } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Icons } from "@/ui/icons";
import { Product } from "@/ui/product";
import { renderProductsBar } from "./bar";
import { appendSkeletons, renderList, updatePagination } from "./list";
import {
	deleteItem,
	handleExport,
	hideItem,
	sortDeals,
	syncStateToStorage,
	toggleBM,
} from "./logic";
import type { ProductsUI } from "./types";

export function initProducts(container: HTMLElement): () => void {
	const ui: ProductsUI = {
		container,
		resultsMeta: null as unknown as HTMLElement,
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
		hidden: false,
		padTop: true,
	});

	ui.cardsContainer = html`<div></div>`;
	ui.sentinel = html`<div></div>`;
	ui.loadMoreContainer = html`<div class="hidden"></div>`;
	ui.mapViewContainer = html`<div
		style="display:none;height:calc(100vh - 280px);min-height:420px"
		class="rounded-(--r-lg) overflow-hidden border border-(--border)"
	></div>`;

	const productsBar = renderProductsBar(ui, {
		onSortChange: () => {
			localStorage.setItem("re-sort", ui.sortSelect.value);
			state.renderedSet.clear();
			if (state.showingSaved) {
				render();
				return;
			}
			bus.emit(EVENTS.SEARCH_STARTED, { more: false });
		},
		onViewChange: (view) => setView(view),
		onExport: () => handleExport(ui.sortSelect.value),
		onJsonReviewOpen: () => openJsonReviewDialog(),
		onValidate: (button) => void handleValidate(button),
		onSavedClick: (e) => void handleSavedClick(e),
		onAlertsOpen: () => bus.emit(EVENTS.ALERTS_OPEN),
		onBackToTop: () => window.scrollTo({ top: 0, behavior: "instant" }),
	});

	ui.backToTopBtn = RawButton({
		ariaLabel: t("backToTop"),
		className:
			"fixed bottom-5 right-5 z-40 w-9 h-9 rounded-full bg-(--surface-3) border border-(--border) text-(--muted) flex items-center justify-center shadow-lg transition-all duration-200 hover:text-(--text) hover:border-(--border-h) opacity-0 pointer-events-none text-[14px]",
		content: "↑",
		onclick: () => window.scrollTo({ top: 0, behavior: "instant" }),
	});

	container.appendChild(
		frag`${productsBar}${ui.loadingState}${ui.emptyState}${ui.welcomeState}${ui.cardsContainer}${ui.sentinel}${ui.loadMoreContainer}${ui.mapViewContainer}`,
	);
	document.body.appendChild(ui.backToTopBtn);

	let isAdminUser = false;
	void import("@/features/auth/api").then(({ isCurrentUserAdmin }) => {
		void isCurrentUserAdmin().then((isAdmin) => {
			if (isAdmin) {
				isAdminUser = true;
				cardCallbacks.onDelete = (p) => {
					void deleteItem(p).then((deleted) => {
						if (deleted) updateSavedBadge();
					});
				};
				render();
			}
		});
	});

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

		const distNodes = TIER_BADGES.filter((b) => tierCounts[b.t]).flatMap(
			(b, i) => {
				const badge = frag`<span style="color:${b.c}">${tierCounts[b.t]} ${tTier(b.t, true)}</span>`;
				return i === 0
					? [" ", badge]
					: [" ", frag`<span style="color:var(--border)">·</span>`, " ", badge];
			},
		);

		const totalNode =
			state.currentTotal > state.allResults.length && !state.showingSaved
				? frag` <span style="color:var(--muted)">· ${fmt(state.currentTotal)} ${t("total")}</span>`
				: "";

		const label = state.showingSaved
			? count !== 1
				? t("savedDeals")
				: t("savedDeal")
			: count !== 1
				? t("results")
				: t("result");

		ui.resultsMeta.replaceChildren(
			frag`<strong>${count}</strong> ${label}${totalNode}${distNodes.length ? frag` <span style="color:var(--border)">·</span>` : ""}${distNodes}`,
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
			render();
			const { initMapView, showMapView } = await import(
				"@/features/map-view/index"
			);
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

		try {
			const res = await fetch("/api/deals/by-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ urls: [...state.bookmarks] }),
			});
			const json = (await res.json()) as { data?: Property[] };
			if (json.data && json.data.length > 0) {
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
		if (state.loading || !state.hasSearched || state.showingSaved) return;

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

			if (result.error) {
				throw new Error(result.error);
			}

			state.allResults = result.data.filter(
				(p) => !state.hidden.has(p.source_url),
			);
			state.currentTotal = result.total;
			state.currentOffset = result.data.length;
			state.renderedSet.clear();
			render();
			toast(
				t("validateDone", {
					deleted: result.validation?.deleted ?? 0,
					total: result.total,
				}),
			);
		} catch (err) {
			toast((err as Error).message, true);
		} finally {
			state.loading = false;
			button.disabled = false;
			button.replaceChildren(frag`${Icons.refresh(12)} ${t("validateBtn")}`);
		}
	}

	type JsonReviewItem = {
		item_id: string | number;
		location?: string;
		why?: string;
		infrastructure_paved?: boolean;
		price?: string;
		area_sqm?: number;
		floor?: string;
		url?: string;
	};

	type JsonReviewEntry = {
		item: JsonReviewItem;
		property: Property | null;
	};

	function openJsonReviewDialog(): void {
		const textarea = html`<textarea
			class="w-full min-h-42 resize-y rounded-(--r) border border-(--border) bg-(--surface-2) text-(--text) text-xs leading-relaxed p-3 outline-none focus:border-(--accent-b) font-mono"
			placeholder="${t("jsonReviewPlaceholder")}"
		></textarea>` as HTMLTextAreaElement;
		const results = html`<div class="flex flex-col gap-3 min-h-0"></div>`;
		const submit = Button({
			content: frag`${Icons.search(12)} ${t("jsonReviewFetch")}`,
			color: "accent",
		});
		const form = html`<div class="flex flex-col gap-3">
			${textarea}
			<div class="flex items-center justify-end">${submit}</div>
		</div>`;

		const dialog = Dialog({
			maxWidth: "1120px",
			showClose: true,
			content: html`<div class="p-4 flex flex-col gap-3 min-h-0">
				${form}
				${results}
			</div>`,
		});

		submit.onclick = () =>
			void fetchJsonReview(textarea, form, results, submit);
		dialog.addEventListener("close", () => dialog.remove(), { once: true });
		document.body.appendChild(dialog);
		dialog.showModal();
		textarea.focus();
	}

	async function fetchJsonReview(
		textarea: HTMLTextAreaElement,
		form: HTMLElement,
		results: HTMLElement,
		submit: HTMLButtonElement,
	): Promise<void> {
		let items: JsonReviewItem[];
		try {
			const parsed = JSON.parse(textarea.value.trim()) as unknown;
			if (!Array.isArray(parsed)) throw new Error(t("jsonReviewArrayError"));
			items = parsed as JsonReviewItem[];
		} catch (err) {
			toast((err as Error).message || t("jsonReviewParseError"), true);
			return;
		}

		submit.disabled = true;
		submit.replaceChildren(
			frag`${Icons.spinner({ size: 12, className: "animate-spin" })} ${t("jsonReviewLoading")}`,
		);
		results.replaceChildren();

		try {
			const response = await fetch("/api/deals/by-json-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items }),
			});
			const json = (await response.json()) as {
				error?: string;
				matched?: number;
				count?: number;
				data?: JsonReviewEntry[];
			};

			if (json.error) throw new Error(json.error);
			const entries = json.data ?? [];
			form.remove();
			renderJsonReviewResults(results, entries);
		} catch (err) {
			toast((err as Error).message, true);
		} finally {
			if (form.isConnected) {
				submit.disabled = false;
				submit.replaceChildren(
					frag`${Icons.search(12)} ${t("jsonReviewFetch")}`,
				);
			}
		}
	}

	function renderJsonReviewResults(
		container: HTMLElement,
		entries: JsonReviewEntry[],
	): void {
		const wrap = html`<div class="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5 overflow-auto pr-1 max-h-[calc(100vh-4rem)]"></div>`;

		for (const entry of entries) {
			if (!entry.property) {
				continue;
			}

			const why = renderJsonReviewWhy(entry.item);
			const card = Product({
				property: entry.property,
				bookmarked: state.bookmarks.has(entry.property.source_url),
				view: "grid",
				callbacks: cardCallbacks,
			});
			wrap.appendChild(
				html`<div class="flex flex-col gap-2">${why}${card}</div>`,
			);
		}

		container.replaceChildren(wrap);
	}

	function renderJsonReviewWhy(item: JsonReviewItem): HTMLElement | string {
		if (!item.why) return "";
		return html`<section
			class="rounded-(--r) border border-(--border) bg-(--surface-2) p-3 text-xs text-(--text-2) leading-relaxed"
		>
			${item.why}
		</section>`;
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
		class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-1001 min-w-24 h-24 px-5 rounded-(--r-lg) border border-(--border) bg-(--surface-3) text-(--text) text-4xl font-bold tabular-nums inline-flex items-center justify-center shadow-[0_14px_40px_rgba(0,0,0,0.45)] opacity-0 pointer-events-none transition-opacity duration-120"
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

	const onScroll = () => {
		const isScrolled = window.scrollY > 450;
		ui.backToTopBtn.style.opacity = isScrolled ? "1" : "0";
		ui.backToTopBtn.style.pointerEvents = isScrolled ? "auto" : "none";
		if (ui.resultsBarInner) {
			const stuck = ui.resultsBarContainer.getBoundingClientRect().top <= 0;
			ui.resultsBarInner.classList.toggle("mb-2", !stuck);
		}
	};
	add(window, "scroll", onScroll);

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
			void deleteItem(p).then((deleted) => {
				if (deleted) {
					updateSavedBadge();
					if (dialog?.open) {
						dialog.close();
					}
				}
			});
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

	// Restore persisted sort
	const savedSort = localStorage.getItem("re-sort");
	if (savedSort) ui.sortSelect.value = savedSort;

	return () => {
		cleanupHandlers();
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
