import { bus, EVENTS } from "../core/events";
import { state } from "../core/state";
import type { CardCallbacks, Property } from "../core/types";
import { fmt, frag, ge, hide, html, show, toast } from "../core/utils";
import { openDesc } from "../dialogs/description";
import { openMap } from "../dialogs/map";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";
import { Product } from "../ui/product";
import { Select } from "../ui/select";

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
						title: "Get Telegram alerts for new matches",
						content: frag`${Icons.bell()} Alert me`,
					})}
          ${Button({
						id: "saved-btn",
						className: "hidden",
						content: frag`${Icons.bookmark(false)} Saved <span id="saved-badge"></span>`,
					})}
          ${Select({
						id: "sort-sel",
						variant: "xs",
						options: [
							{ value: "disc", label: "Most discounted" },
							{ value: "price-asc", label: "Price: low → high" },
							{ value: "price-desc", label: "Price: high → low" },
							{ value: "area", label: "Largest first" },
							{ value: "ppsm", label: "Cheapest ₼/m²" },
						],
					})}
          ${Button({
						id: "vgrid",
						variant: "square",
						color: "indigo",
						active: state.currentView === "grid",
						title: "Grid view",
						content: Icons.grid(),
					})}
          ${Button({
						id: "vlist",
						variant: "square",
						color: "indigo",
						active: state.currentView === "list",
						title: "List view",
						content: Icons.list(),
					})}
        </div>
      </div>
    </div>
  `;
	const loading = html`
    <div id="s-loading" class="hidden">
      <div
        class="flex flex-col items-center justify-center py-20 px-5 gap-2.5 text-center"
      >
        <svg
          class="animate-spin text-(--muted) opacity-40 mb-1"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p class="text-base font-medium text-(--text-2)">
          Searching for deals…
        </p>
      </div>
    </div>
  `;
	const empty = html`
    <div id="s-empty" class="hidden">
      <div
        class="flex flex-col items-center justify-center py-20 px-5 gap-2.5 text-center"
      >
        <svg
          class="text-(--muted) opacity-40 mb-1"
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v3M11 15h.01" stroke-width="2" />
        </svg>
        <p class="text-base font-medium text-(--text-2)">No results found</p>
        <p class="text-sm text-(--muted) max-w-75 leading-[1.6]">
          Try lowering the discount threshold or removing some filters.
        </p>
      </div>
    </div>
  `;
	const welcome = html`
    <div id="s-welcome">
      <div
        class="flex flex-col items-center justify-center py-20 px-5 gap-2.5 text-center pt-25"
      >
        <svg
          class="text-(--muted) opacity-40 mb-1"
          width="52"
          height="52"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.1"
          aria-hidden="true"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <p class="text-base font-medium text-(--text-2)">
          Discover undervalued properties
        </p>
        <p class="text-sm text-(--muted) max-w-75 leading-[1.6]">
          Pick a location and discount threshold to find listings priced below
          the local market average.
        </p>
      </div>
    </div>
  `;
	const cards = html`
    <div id="cards"></div>
    <div id="scroll-sentinel"></div>
    <div id="load-more" class="hidden">
      <p class="text-xs text-(--muted) mt-2" id="load-info"></p>
    </div>
  `;

	const nodes = frag`${resultsBar}${loading}${empty}${welcome}${cards}`;
	container.appendChild(nodes);

	// 3. Setup Callbacks
	const cardCallbacks: CardCallbacks = {
		onBM: toggleBM,
		onHide: hideItem,
		onDesc: openDesc,
		onMap: openMap,
	};

	/**
	 * Core rendering logic for the products list
	 */
	function render(): void {
		const ct = ge("cards");
		if (!ct) return;
		ct.innerHTML = "";

		let list = state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url));

		const sortBy = (ge("sort-sel") as HTMLSelectElement)?.value || "disc";
		list = [...list].sort((a, b) => {
			if (sortBy === "disc") return b.discount_percent - a.discount_percent;
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
			? `<strong>${showing}</strong> saved deal${showing !== 1 ? "s" : ""}`
			: `<strong>${showing}</strong> result${showing !== 1 ? "s" : ""}${state.currentTotal > state.allResults.length ? ` <span style="color:var(--muted)">· ${fmt(state.currentTotal)} total</span>` : ""}`;

		if (!state.showingSaved && state.allResults.length < state.currentTotal) {
			show("load-more");
			ge("load-info").textContent =
				`Showing ${state.allResults.length} of ${fmt(state.currentTotal)}`;
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

	function toggleBM(p: Property): void {
		if (state.bookmarks.has(p.source_url)) {
			state.bookmarks.delete(p.source_url);
			toast("Removed from saved");
		} else {
			state.bookmarks.add(p.source_url);
			toast("★ Deal saved");
		}
		localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
		render();
	}

	function hideItem(url: string): void {
		state.hidden.add(url);
		state.bookmarks.delete(url);
		localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
		localStorage.setItem("re-hidden", JSON.stringify([...state.hidden]));
		toast("Item hidden");
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

	const setView = (view: "grid" | "list") => {
		state.currentView = view;
		ge("vgrid").classList.toggle("on", view === "grid");
		ge("vlist").classList.toggle("on", view === "list");
		state.renderedSet.clear();
		render();
	};

	add(ge("vgrid"), "click", () => setView("grid"));
	add(ge("vlist"), "click", () => setView("list"));

	add(ge("saved-btn"), "click", async () => {
		state.showingSaved = !state.showingSaved;
		ge("saved-btn").classList.toggle("on", state.showingSaved);
		state.renderedSet.clear();
		if (state.showingSaved && state.bookmarks.size > 0) {
			try {
				const res = await fetch("/api/deals/by-urls", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ urls: [...state.bookmarks] }),
				});
				const json = (await res.json()) as {
					data?: typeof state.savedOnlyResults;
				};
				if (json.data) state.savedOnlyResults = json.data;
			} catch (e) {
				console.error("Failed to fetch saved deals", e);
			}
		} else {
			state.savedOnlyResults = [];
		}
		render();
	});

	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => render());

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
	};
}
