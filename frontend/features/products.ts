import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import { state } from "../core/state";
import type { CardCallbacks, Property } from "../core/types";
import { fmt, frag, ge, hide, html, show, toast } from "../core/utils";
import { openDesc } from "../dialogs/description";
import { openGallery } from "../dialogs/gallery";
import { openMap } from "../dialogs/map";
import { openPropertyDetail } from "../dialogs/property-detail";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Icons } from "../ui/icons";
import { Product } from "../ui/product";
import { Select } from "../ui/select";
import { hideMapView, initMapView, showMapView } from "./map-view";

/**
 * Products feature manages the results area, including sorting,
 * view toggles, saved deals, and the infinite scroll list.
 */
export function initProducts(container: HTMLElement): () => void {
	// 1. Initial State Area
	const resultsBar = html`
    <div id="results-bar-container">
      <div
        class="flex items-center justify-between mb-4 gap-2.5 flex-wrap"
        id="results-bar"
        style="display: none"
      >
        <div
          class="text-sm text-(--text-2) [&_strong]:text-(--text) [&_strong]:font-semibold"
          id="results-meta"
        ></div>
        <div class="flex items-center gap-1.75">
          ${Button({
						id: "alert-btn",
						title: t("telegramAlerts"),
						content: frag`${Icons.bell()} ${t("alertMe")}`,
					})}
          ${Button({
						id: "saved-btn",
						className: "hidden",
						content: frag`${Icons.bookmark(false)} ${t("saved")} <span id="saved-badge"></span>`,
					})}
          ${Select({
						id: "sort-sel",
						variant: "xs",
						options: [
							{ value: "disc", label: t("sortDisc") },
							{ value: "drops", label: t("sortDrops") },
							{ value: "price-asc", label: t("sortPriceAsc") },
							{ value: "price-desc", label: t("sortPriceDesc") },
							{ value: "area", label: t("sortArea") },
							{ value: "ppsm", label: t("sortPpsm") },
						],
					})}
          ${Button({
						id: "vgrid",
						variant: "square",
						color: "indigo",
						active: state.currentView === "grid",
						title: t("gridView"),
						content: Icons.grid(),
					})}
          ${Button({
						id: "vlist",
						variant: "square",
						color: "indigo",
						active: state.currentView === "list",
						title: t("listView"),
						content: Icons.list(),
					})}
          ${Button({
						id: "vmapview",
						variant: "square",
						color: "indigo",
						active: state.currentView === "map",
						title: t("mapView"),
						content: Icons.mapPins(),
					})}
        </div>
      </div>
    </div>
  `;
	const loading = EmptyState({
		id: "s-loading",
		icon: Icons.spinnerLg(),
		title: t("searching"),
	});
	const empty = EmptyState({
		id: "s-empty",
		icon: Icons.noResults(),
		title: t("noResults"),
		subtitle: t("noResultsSub"),
	});
	const welcome = EmptyState({
		id: "s-welcome",
		icon: Icons.homeLg(),
		title: t("welcome"),
		subtitle: t("welcomeSub"),
		hidden: false,
		padTop: true,
	});
	// frag used (not html) so all 3 siblings reach the DOM
	const cards = frag`
    <div id="cards"></div>
    <div id="scroll-sentinel"></div>
    <div id="load-more" class="hidden">
      <p class="text-xs text-(--muted) mt-2" id="load-info"></p>
    </div>
    <div
      id="map-view-ct"
      style="display:none;height:calc(100vh - 280px);min-height:420px"
      class="rounded-(--r-lg) overflow-hidden border border-(--border)"
    ></div>
  `;

	const nodes = frag`${resultsBar}${loading}${empty}${welcome}${cards}`;
	container.appendChild(nodes);

	const cleanupMapView = initMapView(ge("map-view-ct"));

	// 3. Setup Callbacks
	const cardCallbacks: CardCallbacks = {
		onBM: toggleBM,
		onHide: hideItem,
		onDesc: openDesc,
		onGallery: openGallery,
		onMap: openMap,
		onDetail: openPropertyDetail,
	};

	/**
	 * Core rendering logic for the products list
	 */
	function render(): void {
		const ct = ge("cards");
		if (!ct) return;

		// Map view handles its own rendering; just keep results-bar visible
		if (state.currentView === "map") {
			show("results-bar");
			return;
		}

		ct.innerHTML = "";

		let list = state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url));

		const sortBy = (ge("sort-sel") as HTMLSelectElement)?.value || "disc";
		list = [...list].sort((a, b) => {
			if (sortBy === "disc") return b.discount_percent - a.discount_percent;
			if (sortBy === "drops")
				return (b.price_drop_count ?? 0) - (a.price_drop_count ?? 0);
			if (sortBy === "price-asc") return a.price - b.price;
			if (sortBy === "price-desc") return b.price - a.price;
			if (sortBy === "area") return b.area_sqm - a.area_sqm;
			if (sortBy === "ppsm") return a.price_per_sqm - b.price_per_sqm;
			return 0;
		});

		if (!list.length) {
			hide("results-bar");
			show("s-empty");
			return;
		}

		show("results-bar");
		hide("s-empty");

		const wrap = html`<div
      class="${
				state.currentView === "grid"
					? "grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-2 max-[580px]:grid-cols-1"
					: "flex flex-col gap-2"
			}"
    ></div>`;

		let newCount = 0;
		for (const property of list) {
			const bookmarked = state.bookmarks.has(property.source_url);
			const el = Product({
				property,
				bookmarked,
				view: state.currentView as "grid" | "row",
				callbacks: cardCallbacks,
			});
			if (state.renderedSet.has(property.source_url)) {
				el.style.animation = "none";
			} else {
				el.style.animationDelay = `${Math.min(newCount, 15) * 22}ms`;
				state.renderedSet.add(property.source_url);
				newCount++;
			}
			wrap.appendChild(el);
		}
		ct.appendChild(wrap);

		const showing = list.length;
		ge("results-meta").innerHTML = state.showingSaved
			? `<strong>${showing}</strong> ${showing !== 1 ? t("savedDeals") : t("savedDeal")}`
			: `<strong>${showing}</strong> ${showing !== 1 ? t("results") : t("result")}${state.currentTotal > state.allResults.length ? ` <span style="color:var(--muted)">· ${fmt(state.currentTotal)} ${t("total")}</span>` : ""}`;

		if (!state.showingSaved && state.allResults.length < state.currentTotal) {
			show("load-more");
			ge("load-info").textContent =
				`${t("showing")} ${state.allResults.length} ${t("of")} ${fmt(state.currentTotal)}`;
			setupScrollObserver(() =>
				bus.emit(EVENTS.SEARCH_STARTED, { more: true }),
			);
		} else {
			hide("load-more");
			if (state.scrollObserver) {
				state.scrollObserver.disconnect();
				state.scrollObserver = null;
			}
		}

		if (state.bookmarks.size > 0) {
			show("saved-btn", "inline-flex");
			ge("saved-badge").textContent = String(state.bookmarks.size);
		} else {
			hide("saved-btn");
		}
	}

	function setupScrollObserver(loadMoreFn: () => void): void {
		if (state.scrollObserver) state.scrollObserver.disconnect();
		const sentinel = ge("scroll-sentinel");
		if (!sentinel) return;
		state.scrollObserver = new IntersectionObserver(
			(entries) => {
				if (
					entries[0]?.isIntersecting &&
					!state.showingSaved &&
					state.allResults.length < state.currentTotal
				) {
					loadMoreFn();
				}
			},
			{ rootMargin: "600px" },
		);
		state.scrollObserver.observe(sentinel);
	}

	function persistBookmarkData(): void {
		const obj: Record<string, Property> = {};
		for (const [url, prop] of state.bookmarkData) {
			obj[url] = prop;
		}
		localStorage.setItem("re-bm-data", JSON.stringify(obj));
	}

	function toggleBM(p: Property): void {
		if (state.bookmarks.has(p.source_url)) {
			state.bookmarks.delete(p.source_url);
			state.bookmarkData.delete(p.source_url);
			toast(t("toastRemoved"));
		} else {
			state.bookmarks.add(p.source_url);
			state.bookmarkData.set(p.source_url, p);
			toast(t("toastSaved"));
		}
		localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
		persistBookmarkData();
		render();
	}

	function hideItem(url: string): void {
		state.hidden.add(url);
		state.bookmarks.delete(url);
		state.bookmarkData.delete(url);
		localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
		localStorage.setItem("re-hidden", JSON.stringify([...state.hidden]));
		persistBookmarkData();
		toast(t("toastHidden"));
		render();
	}

	// 4. Event Handlers
	const handlers: [HTMLElement, string, EventListener][] = [];
	const add = <T extends Event>(
		el: HTMLElement,
		ev: string,
		fn: (e: T) => void,
	) => {
		const listener = fn as EventListener;
		el.addEventListener(ev, listener);
		handlers.push([el, ev, listener]);
	};

	add(ge("sort-sel"), "change", () => {
		state.renderedSet.clear();
		render();
	});

	const setView = (view: "grid" | "list" | "map") => {
		const wasMap = state.currentView === "map";
		state.currentView = view;
		ge("vgrid").classList.toggle("on", view === "grid");
		ge("vlist").classList.toggle("on", view === "list");
		ge("vmapview").classList.toggle("on", view === "map");

		if (view === "map") {
			ge("cards").style.display = "none";
			ge("scroll-sentinel").style.display = "none";
			hide("load-more");
			showMapView();
		} else {
			if (wasMap) {
				hideMapView();
				ge("cards").style.display = "";
				ge("scroll-sentinel").style.display = "";
			}
			state.renderedSet.clear();
			render();
		}
	};

	add(ge("vgrid"), "click", () => setView("grid"));
	add(ge("vlist"), "click", () => setView("list"));
	add(ge("vmapview"), "click", () => setView("map"));

	add(ge("saved-btn"), "click", async () => {
		state.showingSaved = !state.showingSaved;
		ge("saved-btn").classList.toggle("on", state.showingSaved);
		state.renderedSet.clear();

		if (!state.showingSaved || state.bookmarks.size === 0) {
			state.savedOnlyResults = [];
			render();
			return;
		}

		// Show cached data immediately — no network needed
		const cached = [...state.bookmarkData.values()].filter((p) =>
			state.bookmarks.has(p.source_url),
		);
		state.savedOnlyResults = cached;
		render();

		// Refresh from backend for up-to-date prices
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
				persistBookmarkData();
				state.renderedSet.clear();
				render();
			}
		} catch {
			// Cached data already shown — silent fail is fine
		}
	});

	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => render());

	// Detail modal bookmark / hide events (bubble up from the dialog)
	const onPdBmark = (e: Event) => {
		const p = (e as CustomEvent<Property>).detail;
		if (p) toggleBM(p);
	};
	const onPdHide = (e: Event) => {
		const p = (e as CustomEvent<Property>).detail;
		if (p) hideItem(p.source_url);
	};
	document.addEventListener("pd:bmark", onPdBmark);
	document.addEventListener("pd:hide", onPdHide);

	// 5. Cleanup
	return () => {
		handlers.forEach(([el, ev, fn]) => {
			el.removeEventListener(ev, fn);
		});
		if (state.scrollObserver) {
			state.scrollObserver.disconnect();
			state.scrollObserver = null;
		}
		offDeals();
		document.removeEventListener("pd:bmark", onPdBmark);
		document.removeEventListener("pd:hide", onPdHide);
		cleanupMapView();
	};
}
