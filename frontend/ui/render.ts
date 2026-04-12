import { state } from "../core/state";
import type { CardCallbacks, Property } from "../core/types";
import { fmt, ge, hide, html, show, toast } from "../core/utils";
import { buildCard, buildRow } from "./cards";

// Injected by main.ts to avoid circular dep (render -> search -> render)
let _loadMoreFn: (() => void) | null = null;
export function setLoadMoreFn(fn: () => void): void {
	_loadMoreFn = fn;
}

// Card callbacks injected by main.ts (render -> map/desc avoids circular)
let _cardCb: CardCallbacks | null = null;
export function setCardCallbacks(cb: CardCallbacks): void {
	_cardCb = cb;
}

export function saveBM(): void {
	localStorage.setItem("re-bm", JSON.stringify([...state.bookmarks]));
}

export function saveHidden(): void {
	localStorage.setItem("re-hidden", JSON.stringify([...state.hidden]));
}

export function hideItem(url: string): void {
	state.hidden.add(url);
	state.bookmarks.delete(url);
	saveBM();
	saveHidden();
	toast("Item hidden");
	render();
}

export function toggleBM(p: Property): void {
	if (state.bookmarks.has(p.source_url)) {
		state.bookmarks.delete(p.source_url);
		toast("Removed from saved");
	} else {
		state.bookmarks.add(p.source_url);
		toast("★ Deal saved");
	}
	saveBM();
	render();
}

function sorted(arr: Property[]): Property[] {
	const by = (ge("sort-sel") as HTMLSelectElement).value;
	return [...arr].sort((a, b) => {
		if (by === "disc") return b.discount_percent - a.discount_percent;
		if (by === "price-asc") return a.price - b.price;
		if (by === "price-desc") return b.price - a.price;
		if (by === "area") return b.area_sqm - a.area_sqm;
		if (by === "ppsm") return a.price_per_sqm - b.price_per_sqm;
		return 0;
	});
}

function setupScrollObserver(): void {
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
				_loadMoreFn?.();
			}
		},
		{ rootMargin: "600px" },
	);
	state.scrollObserver.observe(sentinel);
}

export function render(): void {
	const ct = ge("cards");
	ct.innerHTML = "";

	let list = state.showingSaved
		? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
		: state.allResults.filter((p) => !state.hidden.has(p.source_url));
	list = sorted(list);

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

	const callbacks = _cardCb;
	if (!callbacks) {
		throw new Error("Card callbacks not set");
	}
	let newCount = 0;
	for (const property of list) {
		const bookmarked = state.bookmarks.has(property.source_url);
		const el =
			state.currentView === "grid"
				? buildCard({ property, bookmarked, callbacks })
				: buildRow({ property, bookmarked, callbacks });
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
		setupScrollObserver();
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
