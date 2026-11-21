import { t } from "@/core/i18n";
import { ce, cn, html, makeEventManager, toThumbUrl } from "@/core/utils";
import { RawButton } from "./button";
import { Icons } from "./icons";

/** Props accepted by {@link Gallery}. */
export type GalleryProps = {
	fullscreen?: boolean;
	onExpand?: () => void;
	onIndexChange?: (index: number) => void;
	style?: string | Partial<CSSStyleDeclaration>;
} & Omit<Partial<HTMLDivElement>, "style">;

/** Extended element returned by {@link Gallery}. */
export interface GalleryElement extends HTMLDivElement {
	setUrls: (urls: string[], initialIndex?: number) => void;
	navigate: (dir: 1 | -1) => void;
	getUrls: () => string[];
	getIndex: () => number;
	destroy: () => void;
}

/**
 * Simple gallery component with button/keyboard navigation and neighbor preloading.
 * Renders a direct `<img>` with no pointer-blocking overlays so native image actions
 * (like right-click copy/save) work normally.
 */
export function Gallery({
	fullscreen = false,
	onExpand,
	onIndexChange,
	className = "",
	...props
}: GalleryProps): GalleryElement {
	let currentIndex = 0;
	let count = 0;
	let imageUrls: string[] = [];
	const preloaded = new Set<string>();
	const eventManager = makeEventManager();

	const imgElm = html`<img
		referrerpolicy="no-referrer"
		alt=""
		class="${cn(
			"h-full w-full object-contain select-none hidden",
			fullscreen && "shadow-2xl rounded-sm",
		)}"
	/>` as HTMLImageElement;

	const emptyElm = html`
		<div
			class="absolute inset-0 flex-col items-center justify-center gap-2 text-(--muted) text-sm hidden"
		>
			${Icons.gallery(24)}
			<span>${t("propNoImages")}</span>
		</div>
	`;

	const prevBtn = RawButton({
		ariaLabel: t("galleryPrev"),
		className: cn(
			"absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-90 select-none",
			fullscreen ? "left-6 w-12 h-12" : "left-3 w-9 h-9",
			"hidden",
		),
		content: Icons.chevronLeft(fullscreen ? 24 : 18),
		onmousedown: (e) => {
			if (e.detail > 1) e.preventDefault();
		},
		onclick: (e) => {
			e.stopPropagation();
			_navigate(-1);
		},
	});

	const nextBtn = RawButton({
		ariaLabel: t("galleryNext"),
		className: cn(
			"absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-90 select-none",
			fullscreen ? "right-6 w-12 h-12" : "right-3 w-9 h-9",
			"hidden",
		),
		content: Icons.chevronRight(fullscreen ? 24 : 18),
		onmousedown: (e) => {
			if (e.detail > 1) e.preventDefault();
		},
		onclick: (e) => {
			e.stopPropagation();
			_navigate(1);
		},
	});

	const counterElm = html`
		<span
			aria-live="polite"
			class="${cn(
				"absolute left-1/2 -translate-x-1/2 z-10 text-white/80 text-xs font-medium tabular-nums bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md select-none",
				fullscreen ? "bottom-10" : "bottom-3",
				"hidden",
			)}"
		></span>
	`;

	const expandBtn = onExpand
		? RawButton({
				ariaLabel: t("galleryExpand"),
				className:
					"absolute bottom-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95",
				content: Icons.expand(14),
				onclick: (e) => {
					e.stopPropagation();
					onExpand();
				},
			})
		: null;

	const rootElm = ce(
		html`
			<div
				class="${cn(
					"relative flex items-center justify-center bg-black overflow-hidden outline-none select-none",
					fullscreen ? "h-full w-full" : "h-full",
					className,
				)}"
				tabindex="0"
				role="region"
				aria-label="${t("gallery")}"
			>
				${imgElm} ${emptyElm} ${prevBtn} ${nextBtn} ${counterElm}
				${expandBtn || ""}
			</div>
		`,
		props,
	) as GalleryElement;

	const _resolveUrl = (idx: number): string => {
		const raw = imageUrls[(idx + count) % count];
		if (!raw) return "";
		return fullscreen ? raw : toThumbUrl(raw);
	};

	const _preload = (idx: number): void => {
		if (count <= 1) return;
		const url = _resolveUrl(idx);
		if (!url || preloaded.has(url)) return;
		preloaded.add(url);
		const pre = new window.Image();
		pre.referrerPolicy = "no-referrer";
		pre.src = url;
	};

	const _sync = (): void => {
		if (count > 0) {
			const url = _resolveUrl(currentIndex);
			if (imgElm.getAttribute("src") !== url) {
				imgElm.src = url;
			}
			imgElm.alt = t("propPhotoAlt", { n: currentIndex + 1, total: count });
			imgElm.classList.remove("hidden");
			_preload(currentIndex + 1);
			_preload(currentIndex - 1);
		} else {
			imgElm.removeAttribute("src");
			imgElm.alt = "";
			imgElm.classList.add("hidden");
		}

		const showNav = count > 1;
		prevBtn.classList.toggle("hidden", !showNav);
		prevBtn.classList.toggle("flex", showNav);
		nextBtn.classList.toggle("hidden", !showNav);
		nextBtn.classList.toggle("flex", showNav);
		counterElm.classList.toggle("hidden", !showNav);

		if (showNav) {
			counterElm.textContent = `${currentIndex + 1} / ${count}`;
		}

		emptyElm.classList.toggle("hidden", count > 0);
		emptyElm.classList.toggle("flex", count === 0);
		if (expandBtn) expandBtn.classList.toggle("hidden", count === 0);
	};

	const _navigate = (dir: 1 | -1): void => {
		if (count <= 1) return;
		currentIndex = (currentIndex + dir + count) % count;
		_sync();
		onIndexChange?.(currentIndex);
	};

	eventManager.add<KeyboardEvent>(rootElm, "keydown", (e) => {
		if (e.key === "ArrowLeft") {
			e.stopPropagation();
			_navigate(-1);
		} else if (e.key === "ArrowRight" || e.key === " ") {
			e.stopPropagation();
			_navigate(1);
		}
	});

	return Object.assign(rootElm, {
		setUrls(newUrls: string[], initialIndex = 0) {
			imageUrls = newUrls;
			count = imageUrls.length;
			currentIndex = count > 0 ? ((initialIndex % count) + count) % count : 0;
			_sync();
		},
		navigate: _navigate,
		getUrls: () => imageUrls,
		getIndex: () => currentIndex,
		destroy: () => eventManager.cleanup(),
	});
}
