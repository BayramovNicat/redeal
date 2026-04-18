import { t } from "../core/i18n";
import { html } from "../core/utils";
import { Icons } from "./icons";

interface GalleryConfig {
	fullscreen?: boolean;
	onExpand?: () => void;
}

export interface GalleryViewInstance {
	el: HTMLElement;
	setUrls: (urls: string[], initialIndex?: number) => void;
	go: (dir: 1 | -1) => void;
	getUrls: () => string[];
	getIndex: () => number;
}

/**
 * Reusable gallery component with lazy loading and preloading.
 */
export function GalleryView(config: GalleryConfig = {}): GalleryViewInstance {
	const { fullscreen = false, onExpand } = config;
	let index = 0;
	let total = 0;
	let urls: string[] = [];

	const el = html`
    <div
      class="relative bg-black overflow-hidden ${
				fullscreen ? "h-full w-full" : ""
			}"
      style="${fullscreen ? "" : "height:320px"}"
    >
      <div
        id="gv-slider"
        class="relative w-full h-full ${fullscreen ? "pointer-events-none" : ""}"
      ></div>

      <div
        id="gv-no-img"
        class="absolute inset-0 flex-col items-center justify-center gap-2 text-(--muted) text-sm hidden"
      >
        ${Icons.gallery()}
        <span>${t("propNoImages")}</span>
      </div>

      <!-- Nav buttons -->
      <button
        id="gv-prev"
        aria-label="${t("galleryPrev")}"
        class="absolute ${
					fullscreen ? "left-6 w-12 h-12" : "left-3 w-9 h-9"
				} top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-90 hidden"
      >
        ${Icons.chevronLeft(fullscreen ? 24 : 18)}
      </button>
      <button
        id="gv-next"
        aria-label="${t("galleryNext")}"
        class="absolute ${
					fullscreen ? "right-6 w-12 h-12" : "right-3 w-9 h-9"
				} top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-90 hidden"
      >
        ${Icons.chevronRight(fullscreen ? 24 : 18)}
      </button>

      <span
        id="gv-counter"
        class="absolute ${
					fullscreen ? "bottom-10" : "bottom-3"
				} left-1/2 -translate-x-1/2 z-10 text-white/80 text-xs font-medium tabular-nums bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md select-none hidden"
      ></span>

      ${
				onExpand
					? html`
            <button
              id="gv-expand"
              aria-label="${t("galleryExpand")}"
              class="absolute bottom-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95"
            >
              ${Icons.expand(14)}
            </button>
          `
					: ""
			}
    </div>
  ` as HTMLElement;

	const $slider = el.querySelector("#gv-slider") as HTMLElement;
	const $noImg = el.querySelector("#gv-no-img") as HTMLElement;
	const $prev = el.querySelector("#gv-prev") as HTMLElement;
	const $next = el.querySelector("#gv-next") as HTMLElement;
	const $counter = el.querySelector("#gv-counter") as HTMLElement;
	const $expand = el.querySelector("#gv-expand") as HTMLElement | null;

	function loadImage(idx: number): void {
		if (total === 0) return;
		const i = (idx + total) % total;
		const slide = $slider.children[i] as HTMLElement | undefined;
		if (!slide) return;
		const img = slide.querySelector("img");
		if (img && !img.src && urls[i]) {
			img.src = urls[i];
		}
	}

	function update(): void {
		const slides = Array.from($slider.children) as HTMLElement[];
		slides.forEach((s, i) => {
			s.style.opacity = i === index ? "1" : "0";
			s.style.visibility = i === index ? "visible" : "hidden";
		});

		const showNav = total > 1;
		$prev.classList.toggle("hidden", !showNav);
		$prev.classList.toggle("flex", showNav);
		$next.classList.toggle("hidden", !showNav);
		$next.classList.toggle("flex", showNav);
		$counter.classList.toggle("hidden", !showNav);

		if (showNav) {
			$counter.textContent = `${index + 1} / ${total}`;
		}

		$noImg.classList.toggle("hidden", total > 0);
		$noImg.classList.toggle("flex", total === 0);
		if ($expand) $expand.classList.toggle("hidden", total === 0);

		// Lazy load current + preload neighbors
		loadImage(index);
		loadImage(index + 1);
		loadImage(index - 1);
	}

	function go(dir: 1 | -1): void {
		if (total <= 1) return;
		index = (index + dir + total) % total;
		update();
	}

	$prev.addEventListener("click", (e) => {
		e.stopPropagation();
		go(-1);
	});
	$next.addEventListener("click", (e) => {
		e.stopPropagation();
		go(1);
	});
	if ($expand && onExpand) {
		$expand.addEventListener("click", (e) => {
			e.stopPropagation();
			onExpand();
		});
	}

	// Touch / pointer swipe
	let swipeStartX = 0;
	el.addEventListener(
		"pointerdown",
		(e: PointerEvent) => {
			swipeStartX = e.clientX;
		},
		{ passive: true },
	);
	el.addEventListener(
		"pointerup",
		(e: PointerEvent) => {
			const dx = e.clientX - swipeStartX;
			if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
		},
		{ passive: true },
	);

	return {
		el,
		setUrls(newUrls: string[], initialIndex = 0) {
			urls = newUrls;
			total = urls.length;
			index = initialIndex;
			$slider.replaceChildren();

			for (let i = 0; i < total; i++) {
				const slide = document.createElement("div");
				slide.className = `absolute inset-0 flex items-center justify-center transition-opacity ${
					fullscreen ? "duration-400 p-4" : "duration-300"
				}`;
				slide.style.opacity = "0";
				slide.style.visibility = "hidden";

				const img = document.createElement("img");
				img.referrerPolicy = "no-referrer";
				img.alt = t("propPhotoAlt", { n: i + 1, total });
				img.className = "max-h-full max-w-full object-contain";
				if (fullscreen) {
					img.classList.add("shadow-2xl", "rounded-sm");
				}

				slide.appendChild(img);
				$slider.appendChild(slide);
			}
			update();
		},
		go,
		getUrls: () => urls,
		getIndex: () => index,
	};
}
