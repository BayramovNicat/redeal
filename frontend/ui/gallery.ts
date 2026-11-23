import { t } from "@/core/i18n";
import { ce, cn, html, makeEventManager } from "@/core/utils";
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
	let loadToken = 0;
	let revealedToken = 0;
	const preloaded = new Set<string>();
	const eventManager = makeEventManager();

	const imgElm = html`<img
		referrerpolicy="no-referrer"
		alt=""
		class="${cn(
			"h-full w-full object-contain select-none hidden opacity-0 transition-opacity duration-150 ease-out",
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
			"absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all active:scale-90 select-none",
			fullscreen ? "left-6 w-12 h-12" : "left-3 w-9 h-9",
			"hidden",
		),
		content: Icons.chevronLeft(fullscreen ? 22 : 17),
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
			"absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all active:scale-90 select-none",
			fullscreen ? "right-6 w-12 h-12" : "right-3 w-9 h-9",
			"hidden",
		),
		content: Icons.chevronRight(fullscreen ? 22 : 17),
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
				"absolute left-1/2 -translate-x-1/2 z-10 text-white/90 text-[11px] font-semibold font-mono-num bg-black/60 px-3 py-1 rounded-full border border-white/15 backdrop-blur-md select-none",
				fullscreen ? "bottom-10" : "bottom-3",
				"hidden",
			)}"
		></span>
	`;

	const expandBtn = onExpand
		? RawButton({
				ariaLabel: t("galleryExpand"),
				className:
					"absolute bottom-3 right-3 z-10 flex items-center justify-center w-8.5 h-8.5 rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/15 backdrop-blur-md shadow-lg transition-all active:scale-95",
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
		return imageUrls[(idx + count) % count] || "";
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

	const _reveal = (token: number): void => {
		if (token !== loadToken || token === revealedToken) return;
		revealedToken = token;
		imgElm.classList.remove("opacity-0");
	};

	eventManager.add(imgElm, "load", () => {
		const token = loadToken;
		if (!imgElm.getAttribute("src")) return;
		imgElm
			.decode()
			.catch(() => {})
			.finally(() => _reveal(token));
	});

	eventManager.add(imgElm, "error", () => {
		const token = loadToken;
		if (token !== loadToken || !imgElm.getAttribute("src")) return;
		imgElm.classList.remove("opacity-0");
	});

	const _sync = (): void => {
		const token = ++loadToken;

		if (count > 0) {
			const url = _resolveUrl(currentIndex);
			if (imgElm.getAttribute("src") !== url) {
				imgElm.classList.add("opacity-0");
				imgElm.removeAttribute("src");
				imgElm.src = url;
				if (imgElm.complete && imgElm.naturalWidth > 0) {
					_reveal(token);
				}
			} else {
				_reveal(token);
			}
			imgElm.alt = t("propPhotoAlt", { n: currentIndex + 1, total: count });
			imgElm.classList.remove("hidden");
			_preload(currentIndex + 1);
			_preload(currentIndex - 1);
		} else {
			imgElm.classList.add("opacity-0");
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
			e.preventDefault();
			e.stopPropagation();
			_navigate(-1);
		} else if (e.key === "ArrowRight" || e.key === " ") {
			e.preventDefault();
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
