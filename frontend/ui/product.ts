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
import { ts } from "./tier";

interface ProductProps {
	property: Property;
	bookmarked: boolean;
	view: "grid" | "row";
	callbacks: CardCallbacks;
}

function fmtDiscount(pct: number): string {
	const sign = pct >= 0 ? "-" : "+";
	const abs = Math.abs(pct);
	const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
	return `${sign}${rounded}%`;
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
	const discStr = fmtDiscount(property.discount_percent);

	const { bmarkBtn, hideBtn, galleryBtn, deleteBtn } = createButtons(
		property,
		bookmarked,
		Boolean(callbacks.onDelete),
	);

	let element: HTMLElement;

	if (view === "grid") {
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

		const tierTip =
			property.discount_percent >= 0
				? t("tierTipBelow", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					})
				: t("tierTipAbove", {
						n: String(Math.abs(Math.round(property.discount_percent))),
					});

		// Subtle editorial meta tags (color reserved only for high-signal alerts)
		const tagList = [
			{
				if: dropCount > 0,
				label: dropLabel || "",
				tip: dropTip ?? undefined,
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim) font-medium",
			},
			{
				if: property.has_active_mortgage,
				icon: "⚠",
				label: t("tagActiveMortgage"),
				cls: "text-(--yellow) border-(--yellow-b) bg-(--yellow-dim)",
			},
			{
				if: property.has_document,
				label: t("tagDocument"),
				cls: "text-(--text-2) border-(--border) bg-white/[0.03]",
			},
			{
				if: property.has_repair,
				label: t("tagRepaired"),
				cls: "text-(--text-2) border-(--border) bg-white/[0.03]",
			},
			{
				if: property.has_mortgage,
				label: t("tagMortgage"),
				cls: "text-(--muted) border-(--border-subtle) bg-white/[0.02]",
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

		const thumbUrl = property.image_urls?.[0];
		const imgCount = property.image_urls?.length ?? 0;

		// Single floating Save button on the photo stage (works cleanly on both desktop & mobile)
		const overlaySaveBtn = Button({
			variant: "square",
			color: "yellow",
			active: bookmarked,
			title: t("btnSave"),
			ariaLabel: t("btnSave"),
			className:
				"size-8 rounded-full bg-black/55 border border-white/15 text-white/90 backdrop-blur-md shadow-sm hover:bg-black/80 hover:border-white/30 hover:text-white [&.on]:text-(--yellow) [&.on]:border-(--yellow-b) [&.on]:bg-black/75",
			dataset: { action: "bmark" },
			content: Icons.bookmark({ size: 13, fill: bookmarked }),
		});

		// Interactive Photos pill on the bottom-right of the photo stage
		const overlayPhotosBtn =
			imgCount > 0
				? Button({
						variant: "padded",
						color: "blue",
						title: t("btnPhotos"),
						ariaLabel: t("btnPhotos"),
						className:
							"h-6.5 px-2.25 rounded-full bg-black/60 border border-white/15 text-white/90 text-[11px] font-semibold font-mono-num backdrop-blur-md hover:bg-black/85 hover:border-white/30 hover:text-white",
						dataset: { action: "gallery" },
						content: frag`${Icons.gallery(11)} ${imgCount}`,
					})
				: "";

		const signalBadges = frag`
			<span
				class="inline-flex items-center gap-1.25 px-2.25 py-0.75 rounded-full bg-[#07090d]/82 border backdrop-blur-md text-xs max-[520px]:text-[11px] font-extrabold font-mono-num shadow-sm"
				style="color:${tier.c};border-color:${tier.b}"
				title="${tierTip}"
			>
				<span class="size-1.5 rounded-full shrink-0" style="background:${tier.hex};box-shadow:0 0 8px ${tier.hex}"></span>
				${discStr}
			</span>
			${
				property.is_urgent
					? html`<span class="inline-flex items-center gap-0.75 px-2 py-0.75 rounded-full bg-(--red-solid)/90 text-white text-[10px] font-bold tracking-wide uppercase backdrop-blur-md shadow-sm max-[520px]:hidden">⚡ ${t("tagUrgent")}</span>`
					: ""
			}
			${
				isNew
					? html`<span class="inline-flex items-center px-2 py-0.75 rounded-full bg-(--accent-solid)/90 text-white text-[10px] font-bold tracking-wide uppercase backdrop-blur-md shadow-sm max-[520px]:hidden">${t("tagNew")}</span>`
					: ""
			}
		`;

		const photoStage = html`
			<div
				class="relative overflow-hidden h-48 max-[520px]:h-32 bg-(--surface-2)"
			>
				${
					thumbUrl
						? Image({
								src: toThumbUrl(thumbUrl),
								className: "w-full h-full object-cover thumb-zoom",
							})
						: html`<div class="w-full h-full flex items-center justify-center text-(--muted)/30">${Icons.home(28)}</div>`
				}
				<div
					class="absolute inset-0 bg-linear-to-t from-[#0c0e13] via-transparent to-black/35 pointer-events-none"
				></div>
				<div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-2 flex-wrap pr-11">
					${signalBadges}
				</div>
				<div class="absolute top-2.5 right-2.5 z-2">
					${overlaySaveBtn}
				</div>
				<div class="absolute bottom-2.5 right-2.5 z-2">
					${overlayPhotosBtn}
				</div>
			</div>
		`;

		const spark =
			property.price_history && property.price_history.length >= 2
				? Sparkline(property.price_history, tier.hex)
				: null;

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
      hover:bg-[#0f1218]
      hover:shadow-[var(--shadow-card-h)]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)
      relative
      ${isNew ? "new-deal-anim" : ""}"
		>
			${photoStage}

			<div class="px-4 pt-3 pb-3.5 max-[520px]:px-2.75 max-[520px]:pt-2 max-[520px]:pb-2.75 flex flex-col flex-1 gap-3 max-[520px]:gap-1.75">
				<!-- Hero Price + Deal Tier + Inline Market Comparison -->
				<div class="flex flex-col gap-1">
					<div class="flex items-center justify-between gap-2 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-1">
						<span class="text-[21px] max-[520px]:text-[15px] font-extrabold font-mono-num tracking-[-0.03em] leading-none text-(--text)">
							₼ ${fmt(property.price)}
						</span>
						<span
							class="text-[10.5px] max-[520px]:text-[9.5px] font-semibold tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
							style="color:${tier.c};background:${tier.bg}"
							title="${tierTip}"
						>
							${tTier(property.tier)}
						</span>
					</div>

					<div class="flex items-center justify-between gap-2 text-xs max-[520px]:hidden mt-0.5">
						<div class="flex items-baseline gap-1.5 min-w-0 truncate">
							<span class="font-mono-num font-semibold text-(--text-2)">
								₼${fmt(property.price_per_sqm, 0)}/m²
							</span>
							<span class="text-(--muted) text-[11px] truncate">
								· ${t("marketAvg")}
								<span class="font-mono-num">₼${fmt(property.location_avg_price_per_sqm, 0)}</span>
							</span>
						</div>
						${spark ?? ""}
					</div>
				</div>

				<!-- Clean Hairline 3-Column Spec Strip (No Nested Boxes) -->
				<div class="grid grid-cols-3 divide-x divide-(--border-subtle) py-2 border-y border-(--border-subtle) max-[520px]:hidden">
					<div class="pr-2">
						<div class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1">
							${t("area")}
						</div>
						<div class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight">
							${fmt(property.area_sqm, 1)}<span class="text-[11px] font-normal text-(--muted) ml-0.5">m²</span>
						</div>
					</div>
					<div class="px-2.5">
						<div class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1">
							${t("rooms")}
						</div>
						<div class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight">
							${property.rooms ?? "—"}
						</div>
					</div>
					<div class="pl-2.5">
						<div class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1">
							${t("floor")}
						</div>
						<div class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight">
							${floorStr}
						</div>
					</div>
				</div>

				<!-- Location & Date + Subtle Feature Chips -->
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between gap-2 text-xs max-[520px]:text-[11px]">
						<span class="inline-flex items-center gap-1.25 text-(--text-2) min-w-0 truncate font-medium">
							<span class="text-(--muted) shrink-0 max-[520px]:hidden">${Icons.map(12)}</span>
							<span class="truncate">${property.location_name ?? property.district ?? "—"}</span>
						</span>
						${
							ago
								? html`<span class="text-[11px] font-mono-num text-(--muted) shrink-0 max-[520px]:hidden">${ago}</span>`
								: ""
						}
					</div>

					<!-- Compact Mobile Specs -->
					<div class="hidden max-[520px]:block text-[10.5px] text-(--muted) font-mono-num truncate leading-tight">
						${fmt(property.area_sqm, 1)}m² · ${property.rooms ?? "—"} ${t("rooms_")} · ${floorStr}
					</div>

					${
						tags.length
							? html`<div class="flex flex-wrap gap-1.25 max-[520px]:hidden">${tags}</div>`
							: ""
					}
				</div>

				<!-- Minimal Footer -->
				<div class="flex items-center justify-between pt-2.5 mt-auto border-t border-(--border-subtle) max-[520px]:pt-2 max-[520px]:mt-0.5">
					<a
						class="inline-flex items-center gap-1.5 text-xs max-[520px]:text-[11px] font-medium text-(--muted) transition-colors duration-150 group-hover:text-(--text-2) hover:!text-(--accent)"
						href="${property.source_url}"
						target="_blank"
						rel="noopener noreferrer"
						>${t("viewListing")} ${Icons.external(11)}</a
					>
					<div class="flex items-center gap-1 max-[520px]:hidden">
						${hideBtn}${deleteBtn}
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
				cls: "text-(--text-2) border-(--border) bg-white/[0.03]",
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
					${discStr}
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
					btn.replaceChildren(Icons.bookmark({ size: 13, fill: bookmarked }));
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
		content: Icons.bookmark({ size: 13, fill: bookmarked }),
	});

	const hideBtn = Button({
		variant: "square",
		color: "red",
		title: t("btnHide"),
		ariaLabel: t("btnHide"),
		className:
			"size-7 bg-transparent border-transparent hover:border-(--red-b)",
		dataset: { action: "hide" },
		content: Icons.hide(13),
	});

	const deleteBtn = canDelete
		? Button({
				variant: "square",
				color: "red",
				title: t("btnDelete"),
				ariaLabel: t("btnDelete"),
				className:
					"size-7 bg-transparent border-transparent hover:border-(--red-b)",
				dataset: { action: "delete" },
				content: Icons.trash(13),
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
