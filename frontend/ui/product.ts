import { t } from "../core/i18n";
import type { CardCallbacks, Property } from "../core/types";
import { fmt, fmtFloor, frag, html, timeAgo, tTier } from "../core/utils";
import { Button } from "./button";
import { Tag } from "./chip";
import { Icons } from "./icons";
import { LazyThumb } from "./lazy-thumb";
import { Sparkline } from "./sparkline";
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

	const { bmarkBtn, hideBtn, galleryBtn } = createButtons(property, bookmarked);

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
		const dropTip =
			dropCount > 0 && originalPrice !== null
				? `₼${fmt(originalPrice, 0)} → ₼${fmt(property.price, 0)}`
				: null;
		const dropLabel =
			dropCount > 0 ? `▼ ${t("tagPriceDrop", { n: dropCount })}` : null;

		const isNew =
			!!property.posted_date &&
			Date.now() - new Date(property.posted_date).getTime() < 86400000;

		const tagList = [
			{
				if: isNew,
				label: t("tagNew"),
				cls: "text-(--accent) border-[rgba(99,102,241,0.5)] bg-(--accent-dim) font-semibold",
			},
			{
				if: dropCount > 0,
				label: dropLabel || "",
				tip: dropTip ?? undefined,
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim) font-medium",
			},
			{
				if: property.is_urgent,
				icon: "⚡",
				label: t("tagUrgent"),
				cls: "text-(--red) border-(--red-b) bg-(--red-dim)",
			},
			{
				if: property.has_document,
				label: t("tagDocument"),
				cls: "text-(--blue) border-(--blue-b) bg-(--blue-dim)",
			},
			{
				if: property.has_repair,
				label: t("tagRepaired"),
				cls: "text-(--green) border-(--green-b) bg-(--green-dim)",
			},
			{
				if: property.has_mortgage,
				label: t("tagMortgage"),
				cls: "text-(--muted) border-(--border)",
			},
			{
				if: property.has_active_mortgage,
				icon: "⚠",
				label: t("tagActiveMortgage"),
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
			},
			{ if: ago, label: ago, cls: "text-(--muted) border-(--border)" },
		];

		const tags = tagList
			.filter((t) => t.if)
			.map((tag) => {
				const el = Tag({
					label: tag.label || "",
					icon: tag.icon,
					className: tag.cls,
				});
				if ((tag as { tip?: string }).tip) {
					el.setAttribute("data-tip", (tag as { tip: string }).tip);
				}
				return el;
			});

		const thumbUrl = property.image_urls?.[0];
		const imgCount = property.image_urls?.length ?? 0;
		const thumb = thumbUrl
			? LazyThumb({
					src: thumbUrl,
					className:
						"relative rounded-(--r) overflow-hidden -mx-4 -mt-4 mb-0.5 h-40 bg-(--surface-3)",
				})
			: null;
		if (thumb && imgCount > 1) {
			const badge = document.createElement("span");
			badge.className =
				"absolute bottom-1.5 right-1.5 inline-flex items-center gap-0.75 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm tabular-nums pointer-events-none";
			badge.appendChild(Icons.gallery());
			badge.appendChild(document.createTextNode(` ${imgCount}`));
			thumb.appendChild(badge);
		}

		const spark =
			property.price_history && property.price_history.length >= 2
				? Sparkline(property.price_history, tier.hex)
				: null;

		element = html`<article
			class="bg-(--surface)
      border
      rounded-(--r-lg)
      p-4
      flex flex-col
      gap-3.5
      cursor-pointer
      transition-[border-color,box-shadow,transform]
      duration-200
      hover:shadow-[0_6px_28px_rgba(0,0,0,0.35)]
      hover:-translate-y-0.5"
      style="border-color:${property.tier === "Overpriced" ? "var(--red-b)" : "var(--border)"}"
		>
			${thumb}
			<div class="flex justify-between items-start gap-2">
				<div class="min-w-0">
					<div class="text-xs text-(--muted) mb-0.75 tracking-tight">
						${property.location_name ?? property.district ?? "—"}
					</div>
					<div class="text-xl font-bold tracking-[-0.5px] leading-[1.1]">
						₼ ${fmt(property.price)}
					</div>
				</div>
				<span
					class="inline-flex items-center text-[10px] font-semibold tracking-wider px-2 py-0.75 rounded-full border border-current whitespace-nowrap"
					style="color:${tier.c};background:${tier.bg};border-color:${tier.b}"
					>${tTier(property.tier)}</span
				>
			</div>
			<div>
				<div class="flex items-center justify-between mb-1.75">
					<span class="text-xs text-(--muted)"
						>${t("marketAvg")}
						₼${fmt(property.location_avg_price_per_sqm, 0)}/m²</span
					>
					<div class="flex items-center gap-1.5">
						${spark}
						<span class="text-base font-bold" style="color:${tier.c}"
							>${property.discount_percent >= 0 ? "-" : "+"}${Math.abs(
								property.discount_percent,
							)}%</span
						>
					</div>
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
					rel="noopener noreferrer"
					>${t("viewListing")} ${Icons.external()}</a
				>
				<div class="flex items-center gap-1">
					${galleryBtn}${bmarkBtn}${hideBtn}
				</div>
			</div>
		</article>`;
	} else {
		const rowThumbUrl = property.image_urls?.[0];
		const rowThumb = rowThumbUrl
			? LazyThumb({
					src: rowThumbUrl,
					className:
						"w-10 h-10 rounded-(--r-sm) overflow-hidden bg-(--surface-3) shrink-0",
				})
			: html`<div
					class="w-10 h-10 rounded-(--r-sm) bg-(--surface-2) shrink-0"
				></div>`;

		const isNewRow =
			!!property.posted_date &&
			Date.now() - new Date(property.posted_date).getTime() < 86400000;
		const rowTagList = [
			{
				if: isNewRow,
				label: t("tagNew"),
				cls: "text-(--accent) border-[rgba(99,102,241,0.5)] bg-(--accent-dim)",
			},
			{
				if: (property.price_drop_count ?? 0) > 0,
				label: `▼ ${t("tagPriceDrop", { n: property.price_drop_count ?? 0 })}`,
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
			},
			{
				if: property.is_urgent,
				label: `⚡ ${t("tagUrgent")}`,
				cls: "text-(--red) border-(--red-b) bg-(--red-dim)",
			},
			{
				if: property.has_document,
				label: t("tagDocument"),
				cls: "text-(--blue) border-(--blue-b) bg-(--blue-dim)",
			},
		];
		const rowTagEls = rowTagList
			.filter((rt) => rt.if)
			.map((rt) => Tag({ label: rt.label, className: rt.cls }));
		const rowTagsEl = rowTagEls.length
			? html`<div class="flex flex-wrap gap-1 mt-1">${rowTagEls}</div>`
			: null;

		element = html`<div
			class="bg-(--surface)
      border border-(--border)
      rounded-(--r)
      px-4 py-3
      grid items-center
      grid-cols-[40px_68px_1fr_auto_auto]
      gap-3.5
      cursor-pointer
      transition-colors duration-150
      hover:border-(--border-h)
      hover:bg-(--surface-2)"
		>
			${rowThumb}
			<div class="text-center">
				<div class="text-lg font-bold" style="color: ${tier.c}">
					${property.discount_percent >= 0 ? "-" : "+"}${Math.abs(
						property.discount_percent,
					)}%
				</div>
				<div class="text-xs text-(--muted) mt-0.5">
					${tTier(property.tier, true)}
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
					₼${fmt(property.price_per_sqm, 0)}/m²
				</div>
				${rowTagsEl}
			</div>
			<div class="flex items-center gap-1">
				${bmarkBtn}${hideBtn}${galleryBtn}
			</div>
			<a
				class="inline-flex items-center gap-1.25 text-xs text-(--muted) transition-colors duration-150 hover:text-(--text)"
				href="${property.source_url}"
				target="_blank"
				rel="noopener noreferrer"
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
				case "gallery":
					callbacks.onGallery(property.image_urls ?? [], 0);
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
		ariaLabel: t("btnSave"),
		attrs: { "data-action": "bmark" },
		content: Icons.bookmark(bookmarked),
	});

	const hideBtn = Button({
		variant: "square",
		color: "red",
		title: t("btnHide"),
		ariaLabel: t("btnHide"),
		attrs: { "data-action": "hide" },
		content: Icons.hide(),
	});

	const galleryBtn =
		(property.image_urls?.length ?? 0) > 0
			? Button({
					variant: "square",
					color: "blue",
					title: t("btnPhotos"),
					ariaLabel: t("btnPhotos"),
					attrs: { "data-action": "gallery" },
					content: frag`${Icons.gallery()}`,
				})
			: "";

	return { bmarkBtn, hideBtn, galleryBtn };
}
