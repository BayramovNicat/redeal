import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { CardCallbacks, Property } from "@/core/types";
import { fmt, hide, html, show } from "@/core/utils";
import { buildGoogleLoginHref } from "@/features/auth/api";
import { Icons } from "@/ui/icons";
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
			for (const child of Array.from(wrap.children)) {
				const url = (child as HTMLElement).dataset.url;
				if (!url) continue;
				const bmarkBtn = child.querySelector<HTMLButtonElement>(
					'button[data-action="bmark"]',
				);
				if (bmarkBtn) {
					const bookmarked = state.bookmarks.has(url);
					bmarkBtn.classList.toggle("on", bookmarked);
					bmarkBtn.replaceChildren(
						Icons.bookmark({ size: 13, fill: bookmarked }),
					);
				}
			}
			const newItems = list.slice(realCount);

			if (newItems.length > 0) {
				let newCount = 0;
				for (let i = 0; i < newItems.length; i++) {
					const property = newItems[i];
					const el = Product({
						property,
						bookmarked: state.bookmarks.has(property.source_url),
						view: state.currentView as "grid" | "row",
						callbacks,
						eager: realCount + i < 4,
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
	for (let i = 0; i < list.length; i++) {
		const property = list[i];
		const el = Product({
			property,
			bookmarked: state.bookmarks.has(property.source_url),
			view: state.currentView as "grid" | "row",
			callbacks,
			eager: i < 4,
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

function renderPreviewLimitCard(): HTMLElement {
	return html`
		<div
			id="guest-preview-limit-card"
			class="mx-auto max-w-xl rounded-(--r-xl) border border-(--border-h) glass-panel bg-(--surface-glass-strong) p-6 sm:p-8 text-center flex flex-col items-center gap-4 shadow-(--shadow-card)"
		>
			<div
				class="size-11 rounded-2xl bg-linear-to-br from-(--accent-solid)/30 via-(--accent-dim) to-(--blue-dim) border border-(--accent-b) flex items-center justify-center text-(--accent)"
			>
				${Icons.lock(19)}
			</div>
			<div class="space-y-1.5">
				<h3 class="text-base sm:text-lg font-extrabold tracking-[-0.02em] text-(--text)">
					${t("previewLimitTitle", { limit: state.previewLimit })}
				</h3>
				<p class="text-xs sm:text-[13px] text-(--text-2) leading-relaxed max-w-md mx-auto">
					${t("previewLimitSub", { total: fmt(state.currentTotal) })}
				</p>
			</div>
			<a
				href="${buildGoogleLoginHref()}"
				class="h-10.5 inline-flex items-center justify-center gap-2.5 rounded-full bg-(--text) text-[#060709] hover:bg-white px-6 text-xs sm:text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-6px_rgba(255,255,255,0.2)] transition-all duration-180 active:scale-[0.98]"
			>
				${Icons.logIn(14)}
				<span>${t("signInWithGoogle")}</span>
			</a>
			<p class="text-[11px] text-(--muted)">${t("loginWhitelistNote")}</p>
		</div>
	`;
}

/**
 * Updates the infinite scroll observer based on current state.
 */
export function updatePagination(ui: ProductsUI): void {
	if (
		!state.showingSaved &&
		state.isPreviewLimited &&
		state.currentTotal > state.allResults.length
	) {
		if (state.scrollObserver) {
			state.scrollObserver.disconnect();
			state.scrollObserver = null;
		}
		ui.loadMoreContainer.className = "mt-8";
		ui.loadMoreContainer.replaceChildren(renderPreviewLimitCard());
		show(ui.loadMoreContainer);
		return;
	}

	ui.loadMoreContainer.className = "hidden";
	ui.loadMoreContainer.replaceChildren();
	hide(ui.loadMoreContainer);

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
		const skeletons = SkeletonList(state.currentView as "grid" | "row", 3);
		Array.from(skeletons.children).forEach((child) => {
			wrap.appendChild(child);
		});
	}
}
