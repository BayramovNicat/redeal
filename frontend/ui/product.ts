import { t } from "../core/i18n";
import type { CardCallbacks, Property } from "../core/types";
import { fmt, fmtFloor, frag, html, timeAgo } from "../core/utils";
import { Button } from "./button";
import { Tag } from "./chip";
import { Icons } from "./icons";
import { StatBox } from "./stat-box";
import { ts } from "./tier";

interface ProductProps {
	property: Property;
	bookmarked: boolean;
	view: "grid" | "row";
	callbacks: CardCallbacks;
}

/**
 * Product component handles rendering of property cards and rows,
 * including all action listeners and layout logic.
 */
export function Product({
	property,
	bookmarked,
	view,
	callbacks,
}: ProductProps): HTMLElement {
	const tier = ts(property.tier);
	const floorStr = fmtFloor(property.floor, property.total_floors);

	const { bmarkBtn, hideBtn, descBtn, mapBtn, galleryBtn } = createButtons(
		property,
		bookmarked,
	);

	let element: HTMLElement;

	if (view === "grid") {
		const barW = Math.min(100, Math.max(2, property.discount_percent * 2.5));
		const ago = timeAgo(property.posted_date);

		const dropCount = property.price_drop_count ?? 0;
		const history = property.price_history;
		// Oldest entry = original price (history is DESC sorted, so last = oldest)
		const originalPrice =
			history && history.length > 0
				? Number(history[history.length - 1]?.price)
				: null;
		const dropLabel =
			dropCount > 0
				? originalPrice !== null
					? `▼ ₼${fmt(originalPrice, 0)} → ₼${fmt(property.price, 0)} · ${t("tagPriceDrop", { n: dropCount })}`
					: `▼ ${t("tagPriceDrop", { n: dropCount })}`
				: null;

		const tagList = [
			{
				if: dropCount > 0,
				label: dropLabel || "",
				cls: "text-orange-400 border-orange-500/25 bg-orange-500/10 font-medium",
			},
			{
				if: property.is_urgent,
				icon: "⚡",
				label: t("tagUrgent"),
				cls: "text-red-500 border-red-500/25 bg-red-500/10",
			},
			{
				if: property.has_document,
				label: t("tagDocument"),
				cls: "text-blue-500 border-blue-500/25 bg-blue-500/10",
			},
			{
				if: property.has_repair,
				label: t("tagRepaired"),
				cls: "text-green-500 border-green-500/25 bg-green-500/10",
			},
			{
				if: property.has_mortgage,
				label: t("tagMortgage"),
				cls: "text-slate-400 border-slate-700",
			},
			{
				if: property.has_active_mortgage,
				icon: "⚠",
				label: t("tagActiveMortgage"),
				cls: "text-yellow-500 border-yellow-500/25 bg-yellow-500/10",
			},
			{ if: ago, label: ago, cls: "text-slate-500 border-slate-700" },
		];

		const tags = tagList
			.filter((t) => t.if)
			.map((t) =>
				Tag({
					label: t.label || "",
					icon: t.icon,
					className: t.cls,
				}),
			);

		element = html`<article
      class="bg-(--surface)
      border border-(--border)
      rounded-(--r-lg)
      p-4
      flex flex-col
      gap-3.5
      cursor-pointer
      transition-[border-color,box-shadow,transform]
      duration-200
      hover:border-(--border-h)
      hover:shadow-[0_6px_28px_rgba(0,0,0,0.35)]"
    >
      <div class="flex justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs text-(--muted) mb-0.75 tracking-tight">
            ${property.location_name ?? property.district ?? "—"}
          </div>
          <div class="text-xl font-bold tracking-[-0.5px] leading-[1.1]">
            ₼ ${fmt(property.price)}
          </div>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <span
            class="inline-flex items-center text-[10px] font-semibold tracking-wider px-2 py-0.75 rounded-full border border-current whitespace-nowrap"
            style="color:${tier.c};background:${tier.bg};border-color:${tier.b}"
            >${property.tier}</span
          >
          <div class="flex items-center gap-1">${bmarkBtn}${hideBtn}</div>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1.75">
          <span class="text-xs text-(--muted)"
            >${t("marketAvg")}
            ₼${fmt(property.location_avg_price_per_sqm, 0)}/m²</span
          >
          <span class="text-base font-bold" style="color:${tier.c}"
            >-${property.discount_percent}%</span
          >
        </div>
        <div class="h-1 bg-(--surface-3) rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-in-out"
            style="width:${barW}%;background:${tier.hex}"
          ></div>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        ${StatBox({
					label: t("area"),
					value: `${fmt(property.area_sqm, 1)} m²`,
				})}
        ${StatBox({ label: t("ppsm"), value: fmt(property.price_per_sqm, 0) })}
        ${StatBox({ label: t("rooms"), value: property.rooms ?? "—" })}
        ${StatBox({ label: t("floor"), value: floorStr })}
      </div>
      ${
				tags.length
					? html`<div class="flex flex-wrap gap-1.25">${tags}</div>`
					: ""
			}
      <div class="flex items-center justify-between mt-auto">
        <a
          class="inline-flex items-center gap-1.25 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text)"
          href="${property.source_url}"
          target="_blank"
          rel="noopener"
          >${t("viewListing")} ${Icons.external()}</a
        >
        <div class="flex items-center gap-1">
          ${galleryBtn}${descBtn}${mapBtn}
        </div>
      </div>
    </article>`;
	} else {
		element = html`<div
      class="bg-(--surface)
      border border-(--border)
      rounded-(--r)
      px-4 py-3
      grid items-center
      grid-cols-[68px_1fr_auto_auto]
      gap-3.5
      cursor-pointer
      transition-colors duration-150
      hover:border-(--border-h)
      hover:bg-(--surface-2)"
    >
      <div class="text-center">
        <div class="text-lg font-bold" style="color: ${tier.c}">
          -${property.discount_percent}%
        </div>
        <div class="text-xs text-(--muted) mt-0.5">
          ${property.tier.replace(" Deal", "").replace(" Price", "")}
        </div>
      </div>
      <div class="min-w-0">
        <div class="text-sm font-bold">
          ₼ ${fmt(property.price)}
          <span class="font-normal text-(--muted) text-xs">
            · ${property.location_name ?? property.district ?? "—"}
          </span>
        </div>
        <div class="mt-0.5 text-xs text-(--muted) truncate">
          ${fmt(property.area_sqm, 1)} m² · ${property.rooms ?? "—"}
          ${t("rooms_")} · ${t("floor_")} ${floorStr} ·
          ₼${fmt(property.price_per_sqm, 0)}/m²${
						property.is_urgent ? " · ⚡" : ""
					}
        </div>
      </div>
      <div class="flex items-center gap-1">
        ${bmarkBtn}${hideBtn}${galleryBtn}${mapBtn}${descBtn}
      </div>
      <a
        class="inline-flex items-center gap-1.25 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text)"
        href="${property.source_url}"
        target="_blank"
        rel="noopener"
        style="white-space:nowrap"
        >${t("viewShort")}</a
      >
    </div>`;
	}

	attachActionListeners({ element, property, callbacks });

	return element;
}

function attachActionListeners({
	element,
	property,
	callbacks,
}: {
	element: HTMLElement;
	property: Property;
	callbacks: CardCallbacks;
}) {
	element.addEventListener("click", (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const btn = target.closest("button[data-action]");

		if (btn) {
			const action = btn.getAttribute("data-action");
			switch (action) {
				case "bmark":
					callbacks.onBM(property);
					break;
				case "hide":
					callbacks.onHide(property.source_url);
					break;
				case "desc":
					callbacks.onDesc(property.description || "");
					break;
				case "gallery":
					callbacks.onGallery(property.image_urls ?? [], 0);
					break;
				case "map":
					callbacks.onMap(
						property.latitude || 0,
						property.longitude || 0,
						property.location_name ?? property.district ?? "",
					);
					break;
			}
			return;
		}

		// Click outside buttons/links → open detail modal
		if (!target.closest("a")) {
			callbacks.onDetail(property);
		}
	});
}

function createButtons(property: Property, bookmarked: boolean) {
	const bmarkBtn = Button({
		variant: "square",
		color: "yellow",
		active: bookmarked,
		title: t("btnSave"),
		attrs: { "data-action": "bmark" },
		content: Icons.bookmark(bookmarked),
	});

	const hideBtn = Button({
		variant: "square",
		color: "red",
		title: t("btnHide"),
		attrs: { "data-action": "hide" },
		content: Icons.hide(),
	});

	const descBtn = property.description
		? Button({
				variant: "square",
				color: "green",
				title: t("btnDescription"),
				attrs: { "data-action": "desc" },
				content: frag`${Icons.desc()}`,
			})
		: "";

	const mapBtn =
		property.latitude && property.longitude
			? Button({
					variant: "square",
					color: "indigo",
					title: t("btnMap"),
					attrs: { "data-action": "map" },
					content: frag`${Icons.map()}`,
				})
			: "";

	const galleryBtn =
		(property.image_urls?.length ?? 0) > 0
			? Button({
					variant: "square",
					color: "blue",
					title: t("btnPhotos"),
					attrs: { "data-action": "gallery" },
					content: frag`${Icons.gallery()}`,
				})
			: "";

	return { bmarkBtn, hideBtn, descBtn, mapBtn, galleryBtn };
}
