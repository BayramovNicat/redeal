import { bus, EVENTS } from "../core/events";
import { html } from "../core/utils";
import { GalleryView } from "../ui/gallery-view";
import { Icons } from "../ui/icons";

/**
 * Gallery feature encapsulates its state and DOM references within initGallery.
 * It listens for bus EVENTS.GALLERY_OPEN to trigger the modal.
 */
export function initGallery(root: HTMLElement): () => void {
	const gallery = GalleryView({ fullscreen: true });

	function open(data: { urls: string[]; index?: number }): void {
		const { urls, index = 0 } = data;
		gallery.setUrls(urls, index);
		modal.showModal();
	}

	// 1. Initial Render
	const modal = html`
    <dialog
      id="gallery-modal"
      class="bg-transparent border-none p-0 max-w-none max-h-none w-screen h-screen backdrop:bg-black/95 focus:outline-none"
    >
      <div class="fixed inset-0 select-none overflow-hidden">
        <div id="gallery-backdrop" class="absolute inset-0"></div>

        <div id="gallery-content" class="h-full w-full"></div>

        <button
          id="gallery-close"
          class="absolute top-6 right-6 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all active:scale-95"
          aria-label="Close"
        >
          ${Icons.close(20)}
        </button>
      </div>
    </dialog>
  ` as HTMLDialogElement;

	modal.querySelector("#gallery-content")?.appendChild(gallery.el);

	// 2. Event Listeners
	const handlers: [HTMLElement | Window, string, EventListener][] = [
		[
			modal.querySelector(".fixed") as HTMLElement,
			"click",
			(e: Event) => {
				const target = e.target as HTMLElement;
				if (target.closest("#gallery-content")) return;
				modal.close();
			},
		],
		[
			modal.querySelector("#gallery-close") as HTMLElement,
			"click",
			() => modal.close(),
		],
		[
			modal,
			"keydown",
			(e: Event) => {
				const key = (e as KeyboardEvent).key;
				if (key === "ArrowLeft" || key === "ArrowUp") gallery.go(-1);
				if (key === "ArrowRight" || key === "ArrowDown" || key === " ")
					gallery.go(1);
				if (key === "Escape") modal.close();
			},
		],
	];

	handlers.forEach(([el, ev, fn]) => {
		el.addEventListener(ev, fn);
	});

	root.appendChild(modal);

	const offGallery = bus.on(EVENTS.GALLERY_OPEN, (data) => open(data));

	// 3. Cleanup
	return () => {
		handlers.forEach(([el, ev, fn]) => {
			el.removeEventListener(ev, fn);
		});
		offGallery();
		modal.remove();
	};
}

/**
 * Convenience wrapper to trigger the gallery via the event bus.
 */
export function openGallery(urls: string[], index = 0): void {
	bus.emit(EVENTS.GALLERY_OPEN, { urls, index });
}
