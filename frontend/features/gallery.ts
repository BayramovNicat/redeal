import { bus, EVENTS } from "@/core/events";
import { html, makeEventManager } from "@/core/utils";
import { Dialog } from "@/ui/dialog";
import { Gallery } from "@/ui/gallery";

/**
 * Gallery feature controller.
 * Manages the full-screen photo viewer and handles focus restoration.
 */
export function initGallery(root: HTMLElement): () => void {
	const gallery = Gallery({ fullscreen: true });
	const { add, cleanup } = makeEventManager();

	// Use Dialog with overrides for a seamless full-screen experience
	const modal = Dialog({
		maxWidth: "none",
		showClose: true,
		className:
			"fixed inset-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none max-h-none rounded-none border-none shadow-none bg-black/95",
		content: html`<div class="flex-1 flex flex-col min-h-0">${gallery}</div>`,
	});

	let lastTrigger: HTMLElement | null = null;

	function open(data: { urls: string[]; index?: number }): void {
		lastTrigger = document.activeElement as HTMLElement;
		const { urls, index = 0 } = data;
		gallery.setUrls(urls, index);
		modal.showModal();
	}

	// ── Interaction Handlers ───────────────────────────────────────────────────

	add(modal, "close", () => {
		gallery.setUrls([]);
		if (lastTrigger) {
			lastTrigger.focus({ preventScroll: true });
			lastTrigger = null;
		}
	});

	add(modal, "keydown", (e: Event) => {
		const evt = e as KeyboardEvent;
		if (evt.key === "ArrowLeft" || evt.key === "ArrowUp") {
			evt.preventDefault();
			gallery.navigate(-1);
		} else if (
			evt.key === "ArrowRight" ||
			evt.key === "ArrowDown" ||
			evt.key === " "
		) {
			evt.preventDefault();
			gallery.navigate(1);
		}
	});

	root.appendChild(modal);

	const offGallery = bus.on(EVENTS.GALLERY_OPEN, (data) => open(data));

	return () => {
		cleanup();
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
