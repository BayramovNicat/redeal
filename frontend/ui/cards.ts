import type { CardCallbacks, Property } from "../core/types";
import { fmt, fmtFloor, timeAgo } from "../core/utils";
import { html } from "../util/html";
import { Icons } from "./icons";
import { ts } from "./tier";

export function buildCard({
	property,
	bookmarked,
	callbacks,
}: {
	property: Property;
	bookmarked: boolean;
	callbacks: CardCallbacks;
}): HTMLElement {
	const t = ts(property.tier);
	const barW = Math.min(100, Math.max(2, property.discount_percent * 2.5));
	const floorStr = fmtFloor(property.floor, property.total_floors);
	const ago = timeAgo(property.posted_date);

	const { bmarkBtn, hideBtn, descBtn, mapBtn } = createButtons(bookmarked);

	const tagList = [
		{
			if: property.is_urgent,
			icon: "⚡",
			label: "Urgent",
			cls: "text-red-500 border-red-500/25 bg-red-500/10",
		},
		{
			if: property.has_document,
			label: "Document",
			cls: "text-blue-500 border-blue-500/25 bg-blue-500/10",
		},
		{
			if: property.has_repair,
			label: "Repaired",
			cls: "text-green-500 border-green-500/25 bg-green-500/10",
		},
		{
			if: property.has_mortgage,
			label: "Mortgage",
			cls: "text-slate-400 border-slate-700",
		},
		{
			if: property.has_active_mortgage,
			icon: "⚠",
			label: "Active mortgage",
			cls: "text-yellow-500 border-yellow-500/25 bg-yellow-500/10",
		},
		{ if: ago, label: ago, cls: "text-slate-500 border-slate-700" },
	];

	const tags = tagList
		.filter((t) => t.if)
		.map(
			(t) =>
				html`<span
          class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.75 rounded-full border border-current whitespace-nowrap ${t.cls}"
          >${t.icon ? `${t.icon} ` : ""}${t.label}</span
        >`,
		);

	const element = html`<article
    class="bg-(--surface) 
    border border-(--border) 
    rounded-(--r-lg) 
    p-4 
    flex flex-col 
    gap-3.5 
    transition-[border-color,box-shadow,transform] 
    duration-200 
    animate-[fadeUp_0.3s_ease_both]
    hover:border-(--border-h) 
    hover:shadow-[0_6px_28px_rgba(0,0,0,0.35)] 
    hover:-translate-y-0.5"
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
          class="inline-flex items-center text-xs font-semibold tracking-wider px-2 py-0.75 rounded-full border border-current whitespace-nowrap"
          style="color:${t.c};background:${t.bg};border-color:${t.b}"
          >${property.tier}</span
        >
        <div class="flex items-center gap-1">${bmarkBtn}${hideBtn}</div>
      </div>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1.75">
        <span class="text-xs text-(--muted)"
          >Market avg ₼${fmt(property.location_avg_price_per_sqm, 0)}/m²</span
        >
        <span class="text-base font-bold" style="color:${t.c}"
          >-${property.discount_percent}%</span
        >
      </div>
      <div class="h-1 bg-(--surface-3) rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-[width] duration-500 ease-in-out"
          style="width:${barW}%;background:${t.hex}"
        ></div>
      </div>
    </div>
    <div class="grid grid-cols-4 gap-1.5">
      <div class="bg-(--surface-2) rounded-(--r-sm) py-2 px-1.5 text-center">
        <div class="text-xs text-(--muted) mb-0.75">Area</div>
        <div class="text-xs font-semibold">${fmt(property.area_sqm, 1)} m²</div>
      </div>
      <div class="bg-(--surface-2) rounded-(--r-sm) py-2 px-1.5 text-center">
        <div class="text-xs text-(--muted) mb-0.75">₼/m²</div>
        <div class="text-xs font-semibold">
          ${fmt(property.price_per_sqm, 0)}
        </div>
      </div>
      <div class="bg-(--surface-2) rounded-(--r-sm) py-2 px-1.5 text-center">
        <div class="text-xs text-(--muted) mb-0.75">Rooms</div>
        <div class="text-xs font-semibold">${property.rooms ?? "—"}</div>
      </div>
      <div class="bg-(--surface-2) rounded-(--r-sm) py-2 px-1.5 text-center">
        <div class="text-xs text-(--muted) mb-0.75">Floor</div>
        <div class="text-xs font-semibold">${floorStr}</div>
      </div>
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
        >View listing ${Icons.external()}</a
      >
      <div class="flex items-center gap-2.5">${descBtn}${mapBtn}</div>
    </div>
  </article>`;

	attachActionListeners({ element, property, callbacks });

	return element;
}

export function buildRow({
	property,
	bookmarked,
	callbacks,
}: {
	property: Property;
	bookmarked: boolean;
	callbacks: CardCallbacks;
}): HTMLElement {
	const t = ts(property.tier);
	const floorStr = fmtFloor(property.floor, property.total_floors);

	const { bmarkBtn, hideBtn, mapBtn } = createButtons(bookmarked);

	const element = html`<div
    class="bg-(--surface) 
    border border-(--border) 
    rounded-(--r) 
    px-4 py-3 
    grid items-center 
    grid-cols-[68px_1fr_auto_auto] 
    gap-3.5 
    transition-colors duration-150 
    animate-[fadeUp_0.25s_ease_both] 
    hover:border-(--border-h) 
    hover:bg-(--surface-2)"
  >
    <div class="text-center">
      <div class="text-lg font-bold" style="color: ${t.c}">
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
        ${fmt(property.area_sqm, 1)} m² · ${property.rooms ?? "—"} rooms · floor
        ${floorStr} ·
        ₼${fmt(property.price_per_sqm, 0)}/m²${
					property.is_urgent ? " · ⚡" : ""
				}
      </div>
    </div>
    <div class="flex items-center gap-2">${bmarkBtn}${hideBtn}${mapBtn}</div>
    <a
      class="inline-flex items-center gap-1.25 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text)"
      href="${property.source_url}"
      target="_blank"
      rel="noopener"
      style="white-space:nowrap"
      >View ↗</a
    >
  </div>`;

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

		if (!btn) return;

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
			case "map":
				callbacks.onMap(
					property.latitude || 0,
					property.longitude || 0,
					property.location_name ?? property.district ?? "",
				);
				break;
		}
	});
}

function createButtons(bookmarked: boolean) {
	const bmarkBtn = html`<button
    data-action="bmark"
    class="w-7 h-7 flex items-center justify-center bg-transparent border border-(--border) rounded-(--r-sm) text-(--muted) transition-all duration-150 hover:text-(--yellow) hover:border-(--yellow-b) hover:bg-(--yellow-dim) ${
			bookmarked ? "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)" : ""
		}"
    data-action="bmark"
    title="Save"
  >
    ${Icons.bookmark(bookmarked)}
  </button>`;

	const hideBtn = html`<button
    class="w-7 h-7 flex items-center justify-center bg-transparent border border-(--border) rounded-(--r-sm) text-(--muted) transition-all duration-150 hover:text-(--red) hover:border-(--red-b) hover:bg-(--red-dim)"
    data-action="hide"
    title="Hide"
  >
    ${Icons.hide()}
  </button>`;

	const descBtn = html`<button
    class="inline-flex items-center gap-1 bg-transparent border-none p-0 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text) desc-btn"
    data-action="desc"
    title="Description"
  >
    ${Icons.desc()}
  </button>`;

	const mapBtn = html`<button
    class="inline-flex items-center gap-1 bg-transparent border-none p-0 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text)"
    data-action="map"
    title="Map"
  >
    ${Icons.map()}
  </button>`;

	return { bmarkBtn, hideBtn, descBtn, mapBtn };
}
