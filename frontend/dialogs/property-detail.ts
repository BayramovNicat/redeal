import { divIcon, type map, marker } from "leaflet";
import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import type { Property } from "../core/types";
import { fmt, fmtFloor, html, timeAgo } from "../core/utils";
import { Tag } from "../ui/chip";
import { GalleryView } from "../ui/gallery-view";
import { Icons } from "../ui/icons";
import { initLeaflet } from "../ui/map-base";
import { StatBox } from "../ui/stat-box";
import { ts } from "../ui/tier";
import { openGallery } from "./gallery";

/**
 * Unified property detail modal — images, map, description, all info.
 */
export function initPropertyDetail(root: HTMLElement): () => void {
	let currentProperty: Property | null = null;
	let lmap: ReturnType<typeof map> | null = null;
	let lmark: ReturnType<typeof marker> | null = null;

	// ── DOM scaffold ────────────────────────────────────────────────────────
	const modal = html`
    <dialog
      id="prop-detail-modal"
      class="bg-transparent border-none p-0 max-w-screen max-h-screen w-full h-full backdrop:bg-black/80 backdrop:backdrop-blur-sm focus:outline-none"
    >
      <div
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
               flex flex-col overflow-hidden
               bg-(--surface) border border-(--border) rounded-(--r-lg) text-(--text)
               shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style="width:calc(100vw - 2rem);max-width:900px;max-height:calc(100vh - 2rem)"
      >
        <!-- Close button (fixed) -->
        <button
          id="pd-close"
          class="absolute top-3 right-3 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95"
        >
          ${Icons.close(16)}
        </button>

        <!-- Scrollable body -->
        <div class="overflow-y-auto flex-1 min-h-0">
          <!-- Gallery placeholder -->
          <div id="pd-gallery-ct"></div>

          <!-- Header -->
          <div class="px-5 pt-4 pb-3 border-b border-(--border)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div
                  id="pd-location"
                  class="text-xs text-(--muted) mb-0.5 truncate"
                ></div>
                <div class="flex items-baseline gap-2.5 flex-wrap">
                  <span
                    id="pd-price"
                    class="text-2xl font-bold tracking-tight"
                  ></span>
                  <span
                    id="pd-tier"
                    class="inline-flex items-center text-[10px] font-semibold tracking-wider px-2 py-0.75 rounded-full border border-current whitespace-nowrap"
                  ></span>
                </div>
              </div>
              <div
                id="pd-posted"
                class="text-xs text-(--muted) shrink-0 pt-0.5"
              ></div>
            </div>
          </div>

          <!-- Stats grid -->
          <div class="px-5 py-4 border-b border-(--border)">
            <div id="pd-stats" class="grid grid-cols-4 gap-2 mb-3"></div>
            <!-- Discount bar -->
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-(--muted)"
                >${t("propMarketAvg")}
                <span id="pd-mkt-avg" class="text-(--text-2) font-medium"></span
              ></span>
              <span id="pd-disc-pct" class="text-sm font-bold"></span>
            </div>
            <div class="h-1.5 bg-(--surface-3) rounded-full overflow-hidden">
              <div
                id="pd-disc-bar"
                class="h-full rounded-full transition-[width] duration-500 ease-out"
                style="width:0%"
              ></div>
            </div>
            <!-- Tags -->
            <div
              id="pd-tags"
              class="flex-wrap gap-1.25 mt-3 empty:hidden"
            ></div>
          </div>

          <!-- Description -->
          <div
            id="pd-desc-section"
            class="px-5 py-4 border-b border-(--border) hidden"
          >
            <div
              class="text-xs font-semibold text-(--muted) uppercase tracking-wider mb-2"
            >
              ${t("btnDescription")}
            </div>
            <p
              id="pd-desc-body"
              class="text-sm text-(--text-2) leading-[1.75] whitespace-pre-wrap"
            ></p>
          </div>

          <!-- Map -->
          <div id="pd-map-section" class="border-b border-(--border) hidden">
            <div id="pd-map-ct" class="w-full" style="height:260px"></div>
          </div>
        </div>

        <!-- Footer — fixed to bottom -->
        <div
          class="px-5 py-3 flex items-center justify-between gap-3 border-t border-(--border) bg-(--surface) shrink-0"
        >
          <a
            id="pd-link"
            href="#"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.25 text-xs text-(--muted) transition-colors hover:text-(--text)"
          >
            ${t("viewListing")} ${Icons.external()}
          </a>
          <div class="flex items-center gap-1.5">
            <button
              id="pd-bmark-btn"
              class="inline-flex items-center gap-1.25 text-xs px-2.5 py-1.5 rounded-(--r-sm) border border-(--border) text-(--muted) hover:text-(--text) transition-colors"
            >
              ${Icons.bookmark(false)} <span>${t("btnSave")}</span>
            </button>
            <button
              id="pd-hide-btn"
              class="inline-flex items-center gap-1.25 text-xs px-2.5 py-1.5 rounded-(--r-sm) border border-(--border) text-(--muted) hover:text-red-400 transition-colors"
            >
              ${Icons.hide()} <span>${t("btnHide")}</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  ` as HTMLDialogElement;

	// ── Refs ─────────────────────────────────────────────────────────────────
	const $ = <T extends HTMLElement>(id: string): T => {
		const el = modal.querySelector<T>(`#${id}`);
		if (!el) throw new Error(`Element #${id} not found`);
		return el;
	};
	const gallery = GalleryView({
		onExpand: () => {
			if (currentProperty?.image_urls) {
				openGallery(currentProperty.image_urls, gallery.getIndex());
			}
		},
	});
	$("pd-gallery-ct").appendChild(gallery.el);

	// Ensure hidden elements have their layout class for when they are shown
	const $location = $("pd-location");
	const $price = $("pd-price");
	const $tier = $("pd-tier");
	const $posted = $("pd-posted");
	const $stats = $("pd-stats");
	const $mktAvg = $("pd-mkt-avg");
	const $discPct = $("pd-disc-pct");
	const $discBar = $("pd-disc-bar");
	const $tags = $("pd-tags");
	const $mapSec = $("pd-map-section");
	const $descSec = $("pd-desc-section");
	const $descBody = $("pd-desc-body");
	const $link = $<HTMLAnchorElement>("pd-link");
	const $bmarkBtn = $("pd-bmark-btn");
	const $hideBtn = $("pd-hide-btn");
	$tags.classList.add("flex");

	// ── Open ─────────────────────────────────────────────────────────────────
	function open(p: Property): void {
		currentProperty = p;
		const tier = ts(p.tier);

		// Gallery
		gallery.setUrls(p.image_urls ?? []);

		// Header
		$location.textContent = p.location_name ?? p.district ?? "—";
		$price.textContent = `₼ ${fmt(p.price)}`;
		$tier.textContent = p.tier;
		$tier.style.cssText = `color:${tier.c};background:${tier.bg};border-color:${tier.b}`;

		const ago = p.posted_date ? timeAgo(p.posted_date) : "";
		$posted.textContent = ago ? `${t("propPosted")} ${ago}` : "";

		// Stats
		$stats.replaceChildren();

		const floorStr = fmtFloor(p.floor, p.total_floors);
		for (const box of [
			StatBox({ label: t("area"), value: `${fmt(p.area_sqm, 1)} m²` }),
			StatBox({ label: t("ppsm"), value: `₼${fmt(p.price_per_sqm, 0)}` }),
			StatBox({ label: t("rooms"), value: p.rooms ?? "—" }),
			StatBox({ label: t("floor"), value: floorStr }),
		]) {
			$stats.appendChild(box);
		}

		// Discount bar
		$mktAvg.textContent = `₼${fmt(p.location_avg_price_per_sqm, 0)}/m²`;
		$discPct.textContent = `-${p.discount_percent}%`;
		$discPct.style.color = tier.c;
		const barW = Math.min(100, Math.max(2, p.discount_percent * 2.5));
		$discBar.style.width = `${barW}%`;
		$discBar.style.background = tier.hex;

		// Tags
		$tags.replaceChildren();

		const tagList = [
			{
				if: p.is_urgent,
				icon: "⚡",
				label: t("tagUrgent"),
				cls: "text-(--red) border-(--red-b) bg-(--red-dim)",
			},
			{
				if: p.has_document,
				label: t("tagDocument"),
				cls: "text-(--blue) border-(--blue-b) bg-(--blue-dim)",
			},
			{
				if: p.has_repair,
				label: t("tagRepaired"),
				cls: "text-(--green) border-(--green-b) bg-(--green-dim)",
			},
			{
				if: p.has_mortgage,
				label: t("tagMortgage"),
				cls: "text-(--muted) border-(--border)",
			},
			{
				if: p.has_active_mortgage,
				icon: "⚠",
				label: t("tagActiveMortgage"),
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
			},
		];
		for (const tag of tagList.filter((tag) => tag.if)) {
			$tags.appendChild(
				Tag({ label: tag.label, icon: tag.icon, className: tag.cls }),
			);
		}

		// Map
		if (p.latitude && p.longitude) {
			const lat = p.latitude;
			const lng = p.longitude;
			$mapSec.classList.remove("hidden");
			requestAnimationFrame(() => {
				if (lmap && lmark) {
					lmap.invalidateSize();
					lmark.setLatLng([lat, lng]);
					lmap.setView([lat, lng], 15, { animate: false });
				}
			});
		} else {
			$mapSec.classList.add("hidden");
		}

		// Description
		if (p.description) {
			$descSec.classList.remove("hidden");
			$descBody.textContent = p.description;
		} else {
			$descSec.classList.add("hidden");
		}

		// Link
		$link.href = p.source_url;

		modal.showModal();
	}

	// ── Event listeners ──────────────────────────────────────────────────────
	const handlers: [HTMLElement | Window, string, EventListener][] = [
		[$("pd-close"), "click", () => modal.close()],
		[
			modal,
			"click",
			(e: Event) => {
				if (e.target === modal) modal.close();
			},
		],
		[
			modal,
			"keydown",
			(e: Event) => {
				const key = (e as KeyboardEvent).key;
				if (key === "ArrowLeft") gallery.go(-1);
				if (key === "ArrowRight") gallery.go(1);
				if (key === "Escape") modal.close();
			},
		],
	];

	for (const [el, ev, fn] of handlers) {
		el.addEventListener(ev, fn);
	}

	// bookmark / hide wire-up — emit custom DOM events the products feature can catch
	$bmarkBtn.addEventListener("click", () => {
		if (currentProperty) {
			modal.dispatchEvent(
				new CustomEvent("pd:bmark", { bubbles: true, detail: currentProperty }),
			);
		}
	});
	$hideBtn.addEventListener("click", () => {
		if (currentProperty) {
			modal.dispatchEvent(
				new CustomEvent("pd:hide", { bubbles: true, detail: currentProperty }),
			);
			modal.close();
		}
	});

	root.appendChild(modal);

	// Eagerly init map once — show container briefly so Leaflet gets real dimensions
	$mapSec.classList.remove("hidden");
	$mapSec.style.visibility = "hidden";
	lmap = initLeaflet("pd-map-ct");
	const icon = divIcon({
		className: "",
		html: `<div class="w-3 h-3 rounded-full bg-(--green) border-2 border-(--bg) animate-[mpulse_2s_ease-out_infinite]"></div>`,
		iconSize: [12, 12],
		iconAnchor: [6, 6],
	});
	lmark = marker([0, 0], { icon }).addTo(lmap);
	$mapSec.classList.add("hidden");
	$mapSec.style.visibility = "";

	const offOpen = bus.on(EVENTS.PROPERTY_OPEN, (p) => open(p));

	return () => {
		for (const [el, ev, fn] of handlers) {
			el.removeEventListener(ev, fn);
		}
		offOpen();
		if (lmap) {
			lmap.remove();
			lmap = null;
			lmark = null;
		}
		modal.remove();
	};
}

export function openPropertyDetail(p: import("../core/types").Property): void {
	bus.emit(EVENTS.PROPERTY_OPEN, p);
}
