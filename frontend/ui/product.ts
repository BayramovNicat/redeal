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
	eager?: boolean;
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
	eager = false,
}: ProductProps): HTMLElement {
	const tier = ts(property.tier);
	const floorStr = fmtFloor(property.floor, property.total_floors);
	const discStr = fmtDiscount(property.discount_percent);

	const { hideBtn, deleteBtn } = createButtons(Boolean(callbacks.onDelete));

	let element: HTMLElement;

	if (view === "grid") {
		const ago = timeAgo(property.posted_date);
		const dropCount = property.price_drop_count ?? 0;
		const history = property.price_history;
		const originalPrice =
			history && history.length > 0 ? Number(history[0]?.price) : null;
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
						title: `${imgCount} ${t("btnPhotos")}`,
						ariaLabel: `${imgCount} ${t("btnPhotos")}`,
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
					? html`<span
							class="inline-flex items-center gap-0.75 px-2 py-0.75 rounded-full bg-(--red-solid)/90 text-white text-[10px] font-bold tracking-wide uppercase backdrop-blur-md shadow-sm max-[520px]:hidden"
							>⚡ ${t("tagUrgent")}</span
						>`
					: ""
			}
			${
				isNew
					? html`<span
							class="inline-flex items-center px-2 py-0.75 rounded-full bg-(--accent-solid)/90 text-white text-[10px] font-bold tracking-wide uppercase backdrop-blur-md shadow-sm max-[520px]:hidden"
							>${t("tagNew")}</span
						>`
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
								eager,
								className: "w-full h-full object-cover thumb-zoom",
							})
						: html`<div
							class="w-full h-full flex items-center justify-center text-(--muted)/30"
						>
							${Icons.home(28)}
						</div>`
				}
				<div
					class="absolute inset-0 bg-linear-to-t from-[#0c0e13] via-transparent to-black/35 pointer-events-none"
				></div>
				<div
					class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-2 flex-wrap pr-11"
				>
					${signalBadges}
				</div>
				<div class="absolute top-2.5 right-2.5 z-2">${overlaySaveBtn}</div>
				<div class="absolute bottom-2.5 right-2.5 z-2">${overlayPhotosBtn}</div>
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
      hover:shadow-(--shadow-card-h)
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)
      relative
      ${isNew ? "new-deal-anim" : ""}"
		>
			${photoStage}

			<div
				class="px-4 pt-3 pb-3.5 max-[520px]:px-2.75 max-[520px]:pt-2 max-[520px]:pb-2.75 flex flex-col flex-1 gap-3 max-[520px]:gap-1.75"
			>
				<!-- Hero Price + Deal Tier + Inline Market Comparison -->
				<div class="flex flex-col gap-1">
					<div
						class="flex items-center justify-between gap-2 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-1"
					>
						<span
							class="text-[21px] max-[520px]:text-[15px] font-extrabold font-mono-num tracking-[-0.03em] leading-none text-(--text)"
						>
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

					<div
						class="flex items-center justify-between gap-2 text-xs max-[520px]:hidden mt-0.5"
					>
						<div class="flex items-baseline gap-1.5 min-w-0 truncate">
							<span class="font-mono-num font-semibold text-(--text-2)">
								₼${fmt(property.price_per_sqm, 0)}/m²
							</span>
							<span class="text-(--muted) text-[11px] truncate">
								· ${t("marketAvg")}
								<span class="font-mono-num"
									>₼${fmt(property.location_avg_price_per_sqm, 0)}</span
								>
							</span>
						</div>
						${spark ?? ""}
					</div>
				</div>

				<!-- Clean Hairline 3-Column Spec Strip (No Nested Boxes) -->
				<div
					class="grid grid-cols-3 divide-x divide-(--border-subtle) py-2 border-y border-(--border-subtle) max-[520px]:hidden"
				>
					<div class="pr-2">
						<div
							class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
						>
							${t("area")}
						</div>
						<div
							class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
						>
							${fmt(property.area_sqm, 1)}<span
								class="text-[11px] font-normal text-(--muted) ml-0.5"
								>m²</span
							>
						</div>
					</div>
					<div class="px-2.5">
						<div
							class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
						>
							${t("rooms")}
						</div>
						<div
							class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
						>
							${property.rooms ?? "—"}
						</div>
					</div>
					<div class="pl-2.5">
						<div
							class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
						>
							${t("floor")}
						</div>
						<div
							class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
						>
							${floorStr}
						</div>
					</div>
				</div>

				<!-- Location & Date + Subtle Feature Chips -->
				<div class="flex flex-col gap-2">
					<div
						class="flex items-center justify-between gap-2 text-xs max-[520px]:text-[11px]"
					>
						<span
							class="inline-flex items-center gap-1.25 text-(--text-2) min-w-0 truncate font-medium"
						>
							<span class="text-(--muted) shrink-0 max-[520px]:hidden"
								>${Icons.map(12)}</span
							>
							<span class="truncate"
								>${property.location_name ?? property.district ?? "—"}</span
							>
						</span>
						${
							ago
								? html`<span
									class="text-[11px] font-mono-num text-(--muted) shrink-0 max-[520px]:hidden"
									>${ago}</span
								>`
								: ""
						}
					</div>

					<!-- Compact Mobile Specs -->
					<div
						class="hidden max-[520px]:block text-[10.5px] text-(--muted) font-mono-num truncate leading-tight"
					>
						${fmt(property.area_sqm, 1)}m² · ${property.rooms ?? "—"}
						${t("rooms_")} · ${floorStr}
					</div>

					<div class="flex flex-wrap gap-1.25 min-h-5.5 max-[520px]:hidden">
						${tags}
					</div>
				</div>

				<!-- Minimal Footer -->
				<div
					class="flex items-center justify-between pt-2.5 mt-auto border-t border-(--border-subtle) max-[520px]:pt-2 max-[520px]:mt-0.5"
				>
					<a
						class="inline-flex items-center gap-1.5 text-xs max-[520px]:text-[11px] font-medium text-(--muted) transition-colors duration-150 group-hover:text-(--text-2) hover:text-(--accent)!"
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
		const rowAgo = timeAgo(property.posted_date);
		const rowDropCount = property.price_drop_count ?? 0;
		const rowHistory = property.price_history;
		const rowOriginalPrice =
			rowHistory && rowHistory.length > 0 ? Number(rowHistory[0]?.price) : null;
		const rowDropTip =
			rowDropCount > 0 && rowOriginalPrice !== null
				? `₼${fmt(rowOriginalPrice, 0)} → ₼${fmt(property.price, 0)}`
				: null;

		const rowPhotosBtn =
			rowImgCount > 0
				? Button({
						variant: "padded",
						color: "blue",
						title: `${rowImgCount} ${t("btnPhotos")}`,
						ariaLabel: `${rowImgCount} ${t("btnPhotos")}`,
						className:
							"h-5.5 px-1.75 rounded-full bg-black/70 border border-white/15 text-white/90 text-[10px] font-semibold font-mono-num backdrop-blur-md hover:bg-black/90 hover:border-white/30 hover:text-white",
						dataset: { action: "gallery" },
						content: frag`${Icons.gallery(10)} ${rowImgCount}`,
					})
				: "";

		const rowThumb = html`
			<div
				class="relative w-23 h-16.5 rounded-(--r-sm) overflow-hidden bg-(--surface-2) border border-(--border-subtle) shrink-0"
			>
				${
					rowThumbUrl
						? Image({
								src: toThumbUrl(rowThumbUrl),
								eager,
								className: "w-full h-full object-cover thumb-zoom",
							})
						: html`<div
							class="w-full h-full flex items-center justify-center text-(--muted)/35"
						>
							${Icons.home(18)}
						</div>`
				}
				<div class="absolute bottom-1 right-1 z-2">${rowPhotosBtn}</div>
			</div>
		`;

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
				cls: "text-(--accent) border-(--accent-b) bg-(--accent-dim) font-semibold",
			},
			{
				if: property.is_urgent,
				icon: "⚡",
				label: t("tagUrgent"),
				cls: "text-(--red) border-(--red-b) bg-(--red-dim) font-semibold",
			},
			{
				if: rowDropCount > 0,
				label: `▼ ${t("tagPriceDrop", { n: rowDropCount })}`,
				tip: rowDropTip ?? undefined,
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

		const rowTagEls = rowTagList
			.filter((rt) => rt.if)
			.map((rt) => {
				const tagEl = Tag({
					label: rt.label,
					icon: rt.icon,
					className: rt.cls,
				});
				if ((rt as { tip?: string }).tip) {
					tagEl.setAttribute("data-tip", (rt as { tip: string }).tip);
				}
				return tagEl;
			});

		const rowTagsEl = rowTagEls.length
			? html`<div class="flex flex-wrap gap-1.25 mt-1.5">${rowTagEls}</div>`
			: null;

		const rowSpark =
			property.price_history && property.price_history.length >= 2
				? Sparkline(property.price_history, tier.hex)
				: null;

		const rowSaveBtn = Button({
			variant: "square",
			color: "yellow",
			active: bookmarked,
			title: t("btnSave"),
			ariaLabel: t("btnSave"),
			className:
				"size-7.5 bg-transparent border-transparent hover:border-(--yellow-b) [&.on]:border-(--yellow-b)",
			dataset: { action: "bmark" },
			content: Icons.bookmark({ size: 13, fill: bookmarked }),
		});

		element = html`<div
			data-url="${property.source_url}"
			class="product-card group bg-(--surface)
      border
      ${
				property.tier === "Overpriced"
					? "border-(--red-b) hover:border-(--red)/60"
					: "border-(--border) hover:border-(--border-h)"
			}
      rounded-(--r)
      px-3.5 py-2.75
      grid items-center
      grid-cols-[92px_minmax(200px,1.5fr)_148px_76px_auto]
      lg:grid-cols-[92px_minmax(220px,1.4fr)_228px_156px_80px_auto]
      gap-4
      cursor-pointer
      surface-specular
      transition-[background-color,border-color,box-shadow] duration-200 ease-out
      hover:bg-[#0f1218]
      hover:shadow-(--shadow-card-h)
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-1 focus-visible:ring-offset-(--bg)
      ${isNewRow ? "new-deal-anim" : ""}"
		>
			<!-- Photo -->
			${rowThumb}

			<!-- Price, Location, Date & Tags -->
			<div class="min-w-0 flex flex-col justify-center">
				<div class="flex items-baseline gap-2.5 flex-wrap">
					<span
						class="text-[17px] font-extrabold font-mono-num tracking-[-0.02em] text-(--text) leading-tight"
					>
						₼ ${fmt(property.price)}
					</span>
					<span
						class="inline-flex items-center gap-1 text-xs font-medium text-(--text-2) truncate max-w-52"
					>
						<span class="text-(--muted) shrink-0">${Icons.map(11)}</span>
						<span class="truncate"
							>${property.location_name ?? property.district ?? "—"}</span
						>
					</span>
					${
						rowAgo
							? html`<span
								class="text-[11px] font-mono-num text-(--muted) shrink-0"
								>· ${rowAgo}</span
							>`
							: ""
					}
				</div>
				<div
					class="lg:hidden mt-1 text-xs text-(--muted) font-mono-num truncate"
				>
					${fmt(property.area_sqm, 1)}m² · ${property.rooms ?? "—"}
					${t("rooms_")} · ${t("floor_")} ${floorStr}
				</div>
				${rowTagsEl}
			</div>

			<!-- Aligned 3-Column Specs (Desktop) -->
			<div
				class="hidden lg:grid grid-cols-3 divide-x divide-(--border-subtle) items-center"
			>
				<div class="pr-2.5">
					<div
						class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
					>
						${t("area")}
					</div>
					<div
						class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
					>
						${fmt(property.area_sqm, 1)}<span
							class="text-[10.5px] font-normal text-(--muted) ml-0.5"
							>m²</span
						>
					</div>
				</div>
				<div class="px-2.5">
					<div
						class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
					>
						${t("rooms")}
					</div>
					<div
						class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
					>
						${property.rooms ?? "—"}
					</div>
				</div>
				<div class="pl-2.5">
					<div
						class="text-[10px] font-medium text-(--muted) uppercase tracking-wider leading-none mb-1"
					>
						${t("floor")}
					</div>
					<div
						class="text-[13px] font-semibold font-mono-num text-(--text) leading-tight"
					>
						${floorStr}
					</div>
				</div>
			</div>

			<!-- Price/m² vs Market Avg + Sparkline -->
			<div class="flex flex-col items-end justify-center gap-0.75 min-w-0">
				<div class="flex items-center gap-2">
					${rowSpark ?? ""}
					<span class="text-[13.5px] font-bold font-mono-num text-(--text)">
						₼${fmt(property.price_per_sqm, 0)}<span
							class="text-[11px] font-normal text-(--muted)"
							>/m²</span
						>
					</span>
				</div>
				<div class="text-[11px] font-mono-num text-(--muted) truncate">
					${t("marketAvg")} ₼${fmt(property.location_avg_price_per_sqm, 0)}
				</div>
			</div>

			<!-- Compact Deal Signal -->
			<div
				class="flex flex-col items-end justify-center gap-0.75"
				title="${rowTierTip}"
			>
				<span
					class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold font-mono-num leading-tight"
					style="color:${tier.c};background:${tier.bg}"
				>
					<span
						class="size-1.5 rounded-full shrink-0"
						style="background:${tier.hex}"
					></span>
					${discStr}
				</span>
				<span
					class="text-[10px] font-medium opacity-80 pr-0.5 truncate max-w-full"
					style="color:${tier.c}"
				>
					${tTier(property.tier, true)}
				</span>
			</div>

			<!-- Unified Action Cluster -->
			<div class="flex items-center gap-1">
				${rowSaveBtn}${hideBtn}${deleteBtn}
				<div class="w-px h-5 bg-(--border) mx-1"></div>
				<a
					class="inline-flex items-center gap-1 text-xs font-semibold text-(--text-2) px-3 py-1.75 rounded-(--r-sm) border border-(--border) bg-(--surface-2)/75 transition-colors duration-150 hover:text-(--accent) hover:border-(--accent-b) hover:bg-(--accent-dim)"
					href="${property.source_url}"
					target="_blank"
					rel="noopener noreferrer"
					style="white-space:nowrap"
					>${t("viewShort")}</a
				>
			</div>
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
			const target = e.target as HTMLElement | null;
			if (
				target &&
				target !== element &&
				target.closest("button, a, input, select, textarea")
			) {
				return;
			}
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

function createButtons(canDelete = false) {
	const hideBtn = Button({
		variant: "square",
		color: "red",
		title: t("btnHide"),
		ariaLabel: t("btnHide"),
		className:
			"size-7.5 bg-transparent border-transparent hover:border-(--red-b)",
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
					"size-7.5 bg-transparent border-transparent hover:border-(--red-b)",
				dataset: { action: "delete" },
				content: Icons.trash(13),
			})
		: "";

	return { hideBtn, deleteBtn };
}
