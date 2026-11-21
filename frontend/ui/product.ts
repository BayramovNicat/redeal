import { t } from "@/core/i18n";
import type { CardCallbacks, Property } from "@/core/types";
import {
	fmt,
	fmtFloor,
	frag,
	html,
	timeAgo,
	toThumbUrl,
	tTier,
} from "../core/utils";
import { Button } from "./button";
import { Tag } from "./chip";
import { Icons } from "./icons";
import { Image } from "./image";
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

	const { bmarkBtn, hideBtn, galleryBtn, deleteBtn } = createButtons(
		property,
		bookmarked,
		Boolean(callbacks.onDelete),
	);

	let element: HTMLElement;

	if (view === "grid") {
		const bmarkBtnMob = Button({
			variant: "square",
			color: "yellow",
			active: bookmarked,
			title: t("btnSave"),
			ariaLabel: t("btnSave"),
			className:
				"rounded-full bg-black/60 border border-white/15 text-white backdrop-blur-md shadow-sm size-7.5 hover:bg-black/80 !text-white [&.on]:!text-(--yellow) [&.on]:!border-(--yellow-b)",
			dataset: { action: "bmark" },
			content: Icons.bookmark({ size: 12, fill: bookmarked }),
		});

		const barW = Math.min(100, Math.max(4, property.discount_percent * 2.5));
		const ago = timeAgo(property.posted_date);

		const dropCount = property.price_drop_count ?? 0;
		const history = property.price_history;
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
				cls: "text-(--accent) border-(--accent-b) bg-(--accent-dim) font-semibold",
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
				cls: "text-(--text-2) border-(--border) bg-(--surface-2)",
			},
			{
				if: property.has_active_mortgage,
				icon: "⚠",
				label: t("tagActiveMortgage"),
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
			},
		];

		const tags = tagList
			.filter((item) => item.if)
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

		const tierTip =
			property.discount_percent >= 0
				? t("tierTipBelow", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					})
				: t("tierTipAbove", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					});

		const thumbUrl = property.image_urls?.[0];
		const imgCount = property.image_urls?.length ?? 0;
		const thumb = thumbUrl
			? html`<div
					class="relative overflow-hidden h-44 max-[520px]:h-30 bg-(--surface-2) border-b border-(--border-subtle)"
				>
					${Image({
						src: toThumbUrl(thumbUrl),
						className: "w-full h-full object-cover thumb-zoom",
					})}
					<div
						class="absolute inset-0 bg-linear-to-t from-[#0c0e13]/75 via-transparent to-black/25 pointer-events-none"
					></div>
					<div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-2 min-[521px]:hidden">
						${bmarkBtnMob}
					</div>
				</div>`
			: html`<div class="relative min-[521px]:hidden h-2">
					<div class="absolute top-2 right-2 flex items-center gap-1.5 z-2">
						${bmarkBtnMob}
					</div>
				</div>`;

		if (thumbUrl && imgCount > 1) {
			const badge = html`<span
				class="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-black/65 border border-white/15 text-white/90 text-[10px] font-semibold font-mono-num px-2 py-0.5 rounded-full backdrop-blur-md pointer-events-none"
			>
				${Icons.gallery(11)} ${imgCount}
			</span>`;
			thumb.appendChild(badge);
		}

		const spark =
			property.price_history && property.price_history.length >= 2
				? Sparkline(property.price_history, tier.hex)
				: null;

		const discStr = `${property.discount_percent >= 0 ? "-" : "+"}${Math.abs(
			property.discount_percent,
		)}%`;

		element = html`<article
			data-url="${property.source_url}"
			class="product-card group bg-(--surface)
      border
      ${
				property.tier === "Overpriced"
					? "border-(--red-b) hover:border-(--red)/60"
					: "border-(--border) hover:border-(--border-h)"
			}
      rounded-(--r-lg)
      overflow-hidden
      flex flex-col
      cursor-pointer
      surface-specular
      transition-[background-color,border-color,box-shadow]
      duration-200
      ease-out
      hover:bg-(--surface-2)/35
      hover:shadow-[var(--shadow-card-h)]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)
      relative
      ${isNew ? "new-deal-anim" : ""}"
		>
			${thumb}
			<div class="p-4 max-[520px]:p-2.75 flex flex-col flex-1 gap-3.5 max-[520px]:gap-2">
				<!-- Location & Price Header -->
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between gap-2 text-[11px] text-(--muted)">
						<span class="inline-flex items-center gap-1 min-w-0 truncate font-medium">
							<span class="shrink-0 opacity-70 max-[520px]:hidden">${Icons.map(11)}</span>
							<span class="truncate">${property.location_name ?? property.district ?? "—"}</span>
						</span>
						${
							ago
								? html`<span class="shrink-0 text-[10px] font-mono-num opacity-80 max-[520px]:hidden">${ago}</span>`
								: ""
						}
					</div>
					<div class="flex items-start justify-between gap-2 max-[520px]:flex-col max-[520px]:gap-1">
						<div class="flex items-baseline gap-1.5 min-w-0">
							<span class="text-[20px] max-[520px]:text-[15px] font-extrabold font-mono-num tracking-[-0.03em] leading-tight text-(--text)">
								₼ ${fmt(property.price)}
							</span>
							<span class="text-[11px] font-bold font-mono-num max-[520px]:inline hidden" style="color:${tier.c}">
								${discStr}
							</span>
						</div>
						<span
							class="inline-flex items-center gap-1.25 text-[10px] font-semibold tracking-wide px-2 py-0.75 rounded-full border whitespace-nowrap max-[520px]:text-[9px] max-[520px]:px-1.75 max-[520px]:py-0.5"
							style="color:${tier.c};background:${tier.bg};border-color:${tier.b}"
							title="${tierTip}"
						>
							<span class="size-1.5 rounded-full shrink-0" style="background:${tier.hex}"></span>
							${tTier(property.tier)}
						</span>
					</div>
				</div>

				<!-- Market Benchmark Strip -->
				<div class="max-[520px]:hidden rounded-(--r-sm) bg-(--surface-2)/60 border border-(--border-subtle) px-3 py-2.25">
					<div class="flex items-center justify-between gap-2 mb-1.75">
						<span class="text-[11px] text-(--muted) truncate">
							${t("marketAvg")}
							<span class="text-(--text-2) font-mono-num font-medium">₼${fmt(property.location_avg_price_per_sqm, 0)}/m²</span>
						</span>
						<div class="flex items-center gap-1.5 shrink-0">
							${spark}
							<span class="text-sm font-bold font-mono-num" style="color:${tier.c}">
								${discStr}
							</span>
						</div>
					</div>
					<div class="h-1.25 bg-white/6 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full transition-[width] duration-500 ease-out"
							style="width:${barW}%;background:${tier.hex};box-shadow:0 0 10px ${tier.hex}66"
						></div>
					</div>
				</div>

				<!-- Specs Grid -->
				<div class="grid grid-cols-4 gap-1.5 max-[520px]:hidden">
					${StatBox({
						label: t("area"),
						value: fmt(property.area_sqm, 1),
					})}
					${StatBox({ label: t("ppsm"), value: fmt(property.price_per_sqm, 0) })}
					${StatBox({ label: t("rooms"), value: property.rooms ?? "—" })}
					${StatBox({ label: t("floor"), value: floorStr })}
				</div>

				<!-- Compact Mobile Specs -->
				<div class="hidden max-[520px]:block text-[11px] text-(--muted) font-mono-num truncate leading-tight">
					${fmt(property.area_sqm, 1)}m² · ${property.rooms ?? "—"} ${t("rooms_")} · ${floorStr}
				</div>

				<!-- Feature Tags -->
				${
					tags.length
						? html`<div class="flex flex-wrap gap-1.25 max-[520px]:hidden">${tags}</div>`
						: ""
				}

				<!-- Footer Actions -->
				<div class="flex items-center justify-between pt-2.5 mt-auto border-t border-(--border-subtle) max-[520px]:pt-2 max-[520px]:mt-0.5">
					<a
						class="inline-flex items-center gap-1.5 text-xs max-[520px]:text-[11px] font-medium text-(--text-2) transition-colors duration-150 hover:text-(--accent)"
						href="${property.source_url}"
						target="_blank"
						rel="noopener noreferrer"
						>${t("viewListing")} ${Icons.external(11)}</a
					>
					<div class="flex items-center gap-1 max-[520px]:hidden">
						${galleryBtn}${bmarkBtn}${hideBtn}${deleteBtn}
					</div>
				</div>
			</div>
		</article>`;
	} else {
		const rowThumbUrl = property.image_urls?.[0];
		const rowImgCount = property.image_urls?.length ?? 0;
		const rowThumb = rowThumbUrl
			? html`<div
					class="relative size-13 rounded-(--r-sm) overflow-hidden bg-(--surface-2) border border-(--border-subtle) shrink-0"
				>
					${Image({
						src: toThumbUrl(rowThumbUrl),
						className: "w-full h-full object-cover thumb-zoom",
					})}
				</div>`
			: html`<div
					class="size-13 rounded-(--r-sm) bg-(--surface-2) border border-(--border-subtle) shrink-0 flex items-center justify-center text-(--muted)/40"
				>${Icons.home(18)}</div>`;

		if (rowThumbUrl && rowImgCount > 1) {
			const badge = html`<span
				class="absolute bottom-1 right-1 bg-black/75 border border-white/15 text-white text-[9px] font-semibold font-mono-num px-1.25 py-px rounded-full pointer-events-none leading-tight"
			>
				${rowImgCount}
			</span>`;
			rowThumb.appendChild(badge);
		}

		const rowTierTip =
			property.discount_percent >= 0
				? t("tierTipBelow", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					})
				: t("tierTipAbove", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					});

		const isNewRow =
			!!property.posted_date &&
			Date.now() - new Date(property.posted_date).getTime() < 86400000;
		const rowTagList = [
			{
				if: isNewRow,
				label: t("tagNew"),
				cls: "text-(--accent) border-(--accent-b) bg-(--accent-dim)",
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
			? html`<div class="flex flex-wrap gap-1 mt-1.25">${rowTagEls}</div>`
			: null;

		element = html`<div
			data-url="${property.source_url}"
			class="product-card group bg-(--surface)
      border border-(--border)
      rounded-(--r)
      px-4 py-3
      grid items-center
      grid-cols-[52px_84px_1fr_auto_auto]
      gap-4
      cursor-pointer
      surface-specular
      transition-[background-color,border-color,box-shadow] duration-200 ease-out
      hover:border-(--border-h)
      hover:bg-(--surface-2)/75
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-1 focus-visible:ring-offset-(--bg)
      ${isNewRow ? "new-deal-anim" : ""}"
		>
			${rowThumb}
			<div
				class="flex flex-col items-center justify-center rounded-(--r-sm) py-1.5 px-2 border"
				style="background:${tier.bg};border-color:${tier.b}"
				title="${rowTierTip}"
			>
				<div class="text-[15px] font-extrabold font-mono-num leading-tight" style="color:${tier.c}">
					${property.discount_percent >= 0 ? "-" : "+"}${Math.abs(
						property.discount_percent,
					)}%
				</div>
				<div class="text-[10px] font-semibold opacity-90 mt-0.5 truncate max-w-full" style="color:${tier.c}">
					${tTier(property.tier, true)}
				</div>
			</div>
			<div class="min-w-0">
				<div class="flex items-baseline gap-2 flex-wrap">
					<span class="text-[15px] font-bold font-mono-num text-(--text)">
						₼ ${fmt(property.price)}
					</span>
					<span class="font-medium text-(--text-2) text-xs truncate">
						· ${property.location_name ?? property.district ?? "—"}
					</span>
				</div>
				<div class="mt-0.75 text-xs text-(--muted) font-mono-num truncate">
					${fmt(property.area_sqm, 1)}m² · ${property.rooms ?? "—"} ${t("rooms_")}
					· ${t("floor_")} ${floorStr} · ₼${fmt(property.price_per_sqm, 0)}/m²
				</div>
				${rowTagsEl}
			</div>
			<div class="flex items-center gap-1">
				${bmarkBtn}${hideBtn}${deleteBtn}${galleryBtn}
			</div>
			<a
				class="inline-flex items-center gap-1.25 text-xs font-medium text-(--text-2) px-2.5 py-1.5 rounded-(--r-sm) border border-(--border) bg-(--surface-2)/60 transition-colors duration-150 hover:text-(--text) hover:border-(--border-h)"
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
	element.setAttribute("tabindex", "0");
	element.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			callbacks.onDetail(property);
		}
	});
	element.addEventListener("click", (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const btn = target.closest("button[data-action]");

		if (btn) {
			const action = btn.getAttribute("data-action");
			switch (action) {
				case "bmark": {
					const bookmarked = callbacks.onBM(property);
					btn.classList.toggle("on", bookmarked);
					btn.replaceChildren(Icons.bookmark({ size: 12, fill: bookmarked }));
					break;
				}
				case "hide":
					callbacks.onHide(property.source_url);
					break;
				case "delete":
					callbacks.onDelete?.(property);
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

function createButtons(
	property: Property,
	bookmarked: boolean,
	canDelete = false,
) {
	const bmarkBtn = Button({
		variant: "square",
		color: "yellow",
		active: bookmarked,
		title: t("btnSave"),
		ariaLabel: t("btnSave"),
		className: "size-7.5",
		dataset: { action: "bmark" },
		content: Icons.bookmark({ size: 12, fill: bookmarked }),
	});

	const hideBtn = Button({
		variant: "square",
		color: "red",
		title: t("btnHide"),
		ariaLabel: t("btnHide"),
		className: "size-7.5",
		dataset: { action: "hide" },
		content: Icons.hide(12),
	});

	const deleteBtn = canDelete
		? Button({
				variant: "square",
				color: "red",
				title: t("btnDelete"),
				ariaLabel: t("btnDelete"),
				className: "size-7.5",
				dataset: { action: "delete" },
				content: Icons.trash(12),
			})
		: "";

	const galleryBtn =
		(property.image_urls?.length ?? 0) > 0
			? Button({
					variant: "square",
					color: "blue",
					title: t("btnPhotos"),
					ariaLabel: t("btnPhotos"),
					className: "size-7.5",
					dataset: { action: "gallery" },
					content: frag`${Icons.gallery(12)}`,
				})
			: "";

	return { bmarkBtn, hideBtn, galleryBtn, deleteBtn };
}
