import { bus, EVENTS } from "@/core/events";
import { state } from "@/core/state";
import type { CardCallbacks, Property } from "@/core/types";
import { html } from "@/core/utils";
import { Product } from "@/ui/product";
import { SkeletonList } from "@/ui/skeleton";
import type { ProductsUI } from "./types";

/**
 * Renders the property list with smart appending/diffing.
 */
export function renderList(
	ui: ProductsUI,
	list: Property[],
	callbacks: CardCallbacks,
): void {
	const ct = ui.cardsContainer;
	const viewClass =
		state.currentView === "grid"
			? "grid grid-cols-[repeat(auto-fill,minmax(275px,1fr))] gap-4 max-[520px]:grid-cols-2 max-[520px]:gap-2.5"
			: "flex flex-col gap-2.5";

	const wrap = ct.firstElementChild as HTMLElement;

	// Smart Append: If we have the same container, handle skeletons and add new items.
	if (wrap && wrap.className === viewClass) {
		const skeletons = Array.from(wrap.children).filter((c) =>
			c.classList.contains("re-skeleton"),
		);
		const realCount = wrap.children.length - skeletons.length;

		const existingUrls = Array.from(wrap.children)
			.filter((c) => !c.classList.contains("re-skeleton"))
			.map((c) => (c as HTMLElement).dataset.url);
		const canAppend = existingUrls.every(
			(url, index) => url === list[index]?.source_url,
		);

		if (canAppend && list.length >= realCount) {
			skeletons.forEach((s) => {
				s.remove();
			});
			const newItems = list.slice(realCount);

			if (newItems.length > 0) {
				let newCount = 0;
				for (const property of newItems) {
					const el = Product({
						property,
						bookmarked: state.bookmarks.has(property.source_url),
						view: state.currentView as "grid" | "row",
						callbacks,
					});

					el.style.animationDelay = `${Math.min(newCount, 15) * 22}ms`;
					state.renderedSet.add(property.source_url);
					newCount++;
					wrap.appendChild(el);
				}
			}
			return;
		}
	}

	ct.replaceChildren();
	const newWrap = html`<div class="${viewClass}"></div>`;

	let newCount = 0;
	for (const property of list) {
		const el = Product({
			property,
			bookmarked: state.bookmarks.has(property.source_url),
			view: state.currentView as "grid" | "row",
			callbacks,
		});

		if (state.renderedSet.has(property.source_url)) {
			el.style.animation = "none";
		} else {
			el.style.animationDelay = `${Math.min(newCount, 15) * 22}ms`;
			state.renderedSet.add(property.source_url);
			newCount++;
		}
		newWrap.appendChild(el);
	}
	ct.appendChild(newWrap);
}

/**
 * Updates the infinite scroll observer based on current state.
 */
export function updatePagination(ui: ProductsUI): void {
	if (!state.showingSaved && state.allResults.length < state.currentTotal) {
		setupScrollObserver(ui, () =>
			bus.emit(EVENTS.SEARCH_STARTED, { more: true }),
		);
	} else {
		if (state.scrollObserver) {
			state.scrollObserver.disconnect();
			state.scrollObserver = null;
		}
	}
}

function setupScrollObserver(ui: ProductsUI, loadMoreFn: () => void): void {
	if (state.scrollObserver) state.scrollObserver.disconnect();
	if (!ui.sentinel) return;
	state.scrollObserver = new IntersectionObserver(
		(entries) => {
			if (
				entries[0]?.isIntersecting &&
				!state.showingSaved &&
				!state.loading &&
				state.allResults.length < state.currentTotal &&
				!document.body.hasAttribute("data-dialog-open")
			) {
				loadMoreFn();
			}
		},
		{ rootMargin: "0px 0px 1000px 0px" },
	);
	state.scrollObserver.observe(ui.sentinel);
}

/**
 * Appends skeletons to the current list container.
 */
export function appendSkeletons(ui: ProductsUI): void {
	const wrap = ui.cardsContainer.firstElementChild as HTMLElement;
	if (
		wrap &&
		!Array.from(wrap.children).some((c) => c.classList.contains("re-skeleton"))
	) {
		const skeletons = SkeletonList(3, state.currentView as "grid" | "row");
		Array.from(skeletons.children).forEach((child) => {
			wrap.appendChild(child);
		});
	}
}
