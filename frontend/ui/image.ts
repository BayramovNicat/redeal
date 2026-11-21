import { ce, cn, html } from "@/core/utils";

// ─── Concurrency queue ────────────────────────────────────────────────────────

/** Maximum simultaneous image requests. 8 is a good balance for HTTP/2. */
const MAX_CONCURRENT = 8;

let active = 0;
const queue = new Set<HTMLImageElement>();

/** Claims a concurrency slot, marks the image as in-flight, and initiates the request. */
function startLoad(img: HTMLImageElement, src: string): void {
	active++;
	img.dataset.loading = "1";
	img.src = src;
}

/**
 * Releases one concurrency slot and dispatches the next eligible queued image.
 */
function drainQueue(): void {
	active = Math.max(0, active - 1);
	for (const img of queue) {
		queue.delete(img);
		const src = img.dataset.src;
		if (src && !img.dataset.loaded && img.isConnected) {
			startLoad(img, src);
			return;
		}
	}
}

// ─── Intersection observer ────────────────────────────────────────────────────

/**
 * Shared singleton observer for all {@link Image} instances.
 *
 * Checks isConnected to automatically cleanup stale references from the DOM,
 * fixing potential memory leaks in large lists.
 */
const observer = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			const img = entry.target as HTMLImageElement;

			// Cleanup if element was removed from DOM before it could load
			if (!img.isConnected) {
				observer.unobserve(img);
				queue.delete(img);
				continue;
			}

			if (entry.isIntersecting) {
				enqueue(img);
			} else {
				queue.delete(img);
			}
		}
	},
	{ rootMargin: "200px 0px" }, // Increased margin for smoother scrolling
);

/**
 * Schedules an image for loading.
 */
function enqueue(img: HTMLImageElement): void {
	const src = img.dataset.src;
	if (!src || img.dataset.loaded || img.dataset.loading) return;
	if (active < MAX_CONCURRENT) {
		startLoad(img, src);
	} else {
		queue.add(img);
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props accepted by {@link Image}. */
export type ImageProps = {
	/** Source URL of the image. */
	src: string;
} & Partial<Omit<HTMLImageElement, "src">>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Viewport-aware lazy-loading image component.
 *
 * Optimized for large lists:
 * - Limits concurrent network requests to {@link MAX_CONCURRENT}.
 * - Uses IntersectionObserver for lazy loading.
 * - Uses .decode() to prevent main-thread jank during image decoding.
 * - Automatically cleans up memory when elements are removed from DOM.
 */
export function Image({
	src,
	className = "",
	...props
}: ImageProps): HTMLImageElement {
	const img = ce<HTMLImageElement>(
		html`<img
			alt=""
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			class="${cn("opacity-0 transition-[opacity,transform,scale] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", className)}"
		/>`,
		props,
	);

	if (!src) {
		img.style.display = "none";
		return img;
	}

	img.dataset.src = src;

	const handleLoad = () => {
		img.dataset.loaded = "1";
		delete img.dataset.loading;

		// Move decoding off the critical path for smoother animations
		img
			.decode()
			.then(() => {
				if (img.isConnected) {
					img.classList.replace("opacity-0", "opacity-100");
				}
			})
			.catch(() => {
				if (img.isConnected) {
					img.classList.replace("opacity-0", "opacity-100");
				}
			})
			.finally(() => {
				observer.unobserve(img);
				drainQueue();
			});
	};

	const handleError = () => {
		delete img.dataset.loading;
		img.style.display = "none";
		observer.unobserve(img);
		drainQueue();
	};

	img.addEventListener("load", handleLoad, { once: true });
	img.addEventListener("error", handleError, { once: true });

	// Register with observer
	observer.observe(img);

	return img;
}
