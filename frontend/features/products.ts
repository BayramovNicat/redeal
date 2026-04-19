import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import { state } from "../core/state";
import type { CardCallbacks, Property } from "../core/types";
import {
	fmt,
	frag,
	ge,
	hide,
	html,
	show,
	toast,
	trust,
	tTier,
} from "../core/utils";

import { openGallery } from "../dialogs/gallery";
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
		<div id="results-bar-container" class="sticky top-0 z-10 pb-2" style="background:var(--bg)">
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
						id: "export-btn",
						title: t("exportBtn"),
						content: frag`${Icons.download()} ${t("exportBtn")}`,
					})}
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
						ariaLabel: t("sortBy"),
						title: t("sortBy"),
						options: [
							{ value: "disc", label: t("sortDisc") },
							{ value: "drops", label: t("sortDrops") },
							{ value: "new", label: t("sortNew") },
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

	// Back-to-top button
	const backToTopBtn = html`<button
		type="button"
		id="back-to-top"
		aria-label="${t("backToTop")}"
		class="fixed bottom-5 right-5 z-40 w-9 h-9 rounded-full bg-(--surface-3) border border-(--border) text-(--muted) flex items-center justify-center shadow-lg transition-all duration-200 hover:text-(--text) hover:border-(--border-h) opacity-0 pointer-events-none"
		style="font-size:14px"
	>
		↑
	</button>`;
	document.body.appendChild(backToTopBtn);
	const onScroll = () => {
		const show = window.scrollY > 450;
		backToTopBtn.style.opacity = show ? "1" : "0";
		backToTopBtn.style.pointerEvents = show ? "auto" : "none";
	};
	window.addEventListener("scroll", onScroll, { passive: true });
	backToTopBtn.addEventListener("click", () =>
		window.scrollTo({ top: 0, behavior: "instant" }),
	);

	// Restore persisted sort
	const savedSort = localStorage.getItem("re-sort");
	if (savedSort) (ge("sort-sel") as HTMLSelectElement).value = savedSort;

	// 3. Setup Callbacks
	const cardCallbacks: CardCallbacks = {
		onBM: toggleBM,
		onHide: hideItem,
		onGallery: openGallery,
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

		ct.replaceChildren();

		let list = state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url));

		const sortBy = (ge("sort-sel") as HTMLSelectElement)?.value || "disc";
		const tierSel =
			(document.querySelector("#tier-filter") as HTMLSelectElement)?.value ||
			"";
		if (tierSel) list = list.filter((p) => p.tier === tierSel);

		list = [...list].sort((a, b) => {
			if (sortBy === "disc") return b.discount_percent - a.discount_percent;
			if (sortBy === "drops")
				return (b.price_drop_count ?? 0) - (a.price_drop_count ?? 0);
			if (sortBy === "new")
				return (
					new Date(b.posted_date ?? 0).getTime() -
					new Date(a.posted_date ?? 0).getTime()
				);
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
		const tierCounts = list.reduce<Record<string, number>>((acc, p) => {
			acc[p.tier] = (acc[p.tier] ?? 0) + 1;
			return acc;
		}, {});
		const tierBadges: { tier: string; color: string }[] = [
			{ tier: "High Value Deal", color: "var(--green)" },
			{ tier: "Good Deal", color: "var(--blue)" },
			{ tier: "Fair Price", color: "var(--yellow)" },
			{ tier: "Overpriced", color: "var(--red)" },
		];
		const distStr = tierBadges
			.filter((tb) => tierCounts[tb.tier])
			.map(
				(tb) =>
					`<span style="color:${tb.color}">${tierCounts[tb.tier]} ${tTier(tb.tier, true)}</span>`,
			)
			.join(' <span style="color:var(--border)">·</span> ');

		ge("results-meta").innerHTML = trust(
			state.showingSaved
				? `<strong>${showing}</strong> ${showing !== 1 ? t("savedDeals") : t("savedDeal")}`
				: `<strong>${showing}</strong> ${showing !== 1 ? t("results") : t("result")}${state.currentTotal > state.allResults.length ? ` <span style="color:var(--muted)">· ${fmt(state.currentTotal)} ${t("total")}</span>` : ""}${distStr ? ` <span style="color:var(--border)">·</span> ${distStr}` : ""}`,
		) as string;

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

	function handleExport(): void {
		const sortBy = (ge("sort-sel") as HTMLSelectElement)?.value || "disc";
		let list = state.showingSaved
			? state.savedOnlyResults.filter((p) => state.bookmarks.has(p.source_url))
			: state.allResults.filter((p) => !state.hidden.has(p.source_url));

		list = [...list].sort((a, b) => {
			if (sortBy === "disc") return b.discount_percent - a.discount_percent;
			if (sortBy === "drops")
				return (b.price_drop_count ?? 0) - (a.price_drop_count ?? 0);
			if (sortBy === "new")
				return (
					new Date(b.posted_date ?? 0).getTime() -
					new Date(a.posted_date ?? 0).getTime()
				);
			if (sortBy === "price-asc") return a.price - b.price;
			if (sortBy === "price-desc") return b.price - a.price;
			if (sortBy === "area") return b.area_sqm - a.area_sqm;
			if (sortBy === "ppsm") return a.price_per_sqm - b.price_per_sqm;
			return 0;
		});

		if (!list.length) return;

		const lines: string[] = [
			`REDEAL PROPERTY EXPORT — ${list.length} listings`,
			`Exported: ${new Date().toISOString()}`,
			``,
		];

		list.forEach((p, i) => {
			const tags: string[] = [];
			if (p.is_urgent) tags.push("Urgent");
			if (p.has_document) tags.push("Document");
			if (p.has_repair) tags.push("Repaired");
			if (p.has_mortgage) tags.push("Mortgage eligible");
			if (p.has_active_mortgage) tags.push("Active mortgage");
			if (p.price_drop_count && p.price_drop_count > 0)
				tags.push(`Price dropped ${p.price_drop_count}×`);

			lines.push(`--- [${i + 1}] ---`);
			lines.push(
				`Location: ${p.location_name ?? "Unknown"}${p.district && p.district !== p.location_name ? ` (${p.district})` : ""}`,
			);
			lines.push(
				`Price: ₼${fmt(p.price)} | Area: ${p.area_sqm}m² | ₼/m²: ${fmt(p.price_per_sqm)}`,
			);
			lines.push(
				`Market avg ₼/m²: ${fmt(p.location_avg_price_per_sqm)} | Discount: ${Number(p.discount_percent).toFixed(1)}% (${p.tier})`,
			);
			if (p.rooms !== undefined || p.floor !== undefined) {
				const parts: string[] = [];
				if (p.rooms !== undefined) parts.push(`${p.rooms} rooms`);
				if (p.floor !== undefined)
					parts.push(
						`Floor ${p.floor}${p.total_floors ? `/${p.total_floors}` : ""}`,
					);
				lines.push(`Details: ${parts.join(" | ")}`);
			}
			if (tags.length) lines.push(`Tags: ${tags.join(", ")}`);
			if (p.posted_date)
				lines.push(`Posted: ${new Date(p.posted_date).toLocaleDateString()}`);
			if (p.description?.trim())
				lines.push(`Description: ${p.description.trim()}`);
			lines.push(`URL: ${p.source_url}`);
			lines.push(``);
		});

		const text = lines.join("\n");
		navigator.clipboard
			.writeText(text)
			.then(() => {
				toast(t("exportCopied"));
			})
			.catch(() => {
				// Fallback: trigger file download
				const blob = new Blob([text], { type: "text/plain" });
				const a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = `redeal-export-${Date.now()}.txt`;
				a.click();
			});
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

	add(ge("export-btn"), "click", () => handleExport());

	add(ge("sort-sel"), "change", () => {
		localStorage.setItem(
			"re-sort",
			(ge("sort-sel") as HTMLSelectElement).value,
		);
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

	// Scroll restore: save position before detail opens, restore on close
	let savedScrollY = 0;
	const offPropOpen = bus.on(EVENTS.PROPERTY_OPEN, () => {
		savedScrollY = window.scrollY;
	});
	const onDialogClose = (e: Event) => {
		const el = e.target as HTMLElement;
		if (el.id === "prop-detail-modal" && savedScrollY > 0) {
			requestAnimationFrame(() =>
				window.scrollTo({ top: savedScrollY, behavior: "instant" }),
			);
		}
	};
	document.addEventListener("close", onDialogClose, true);

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
		offPropOpen();
		document.removeEventListener("pd:bmark", onPdBmark);
		document.removeEventListener("pd:hide", onPdHide);
		document.removeEventListener("close", onDialogClose, true);
		window.removeEventListener("scroll", onScroll);
		backToTopBtn.remove();
		cleanupMapView();
	};
}
