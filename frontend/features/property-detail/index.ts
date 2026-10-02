import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import type { Property } from "@/core/types";
import { makeEventManager, toast } from "@/core/utils";
import { bindPropertyData, initMap } from "@/features/property-detail/logic";
import type { PropertyDetailUI } from "@/features/property-detail/types";
import { renderPropertyDetailLayout } from "@/features/property-detail/ui";

export function initPropertyDetail(root: HTMLElement): () => void {
	const ui: PropertyDetailUI = {
		modal: null as unknown as PropertyDetailUI["modal"],
		gallery: null as unknown as PropertyDetailUI["gallery"],
		locationEl: null as unknown as HTMLElement,
		postedEl: null as unknown as HTMLElement,
		priceEl: null as unknown as HTMLElement,
		tierEl: null as unknown as HTMLElement,
		statsEl: null as unknown as HTMLElement,
		mktAvgEl: null as unknown as HTMLElement,
		discPctEl: null as unknown as HTMLElement,
		discBarEl: null as unknown as HTMLElement,
		tagsEl: null as unknown as HTMLElement,
		historyChartEl: null as unknown as HTMLElement,
		historySecEl: null as unknown as HTMLElement,
		descBodyEl: null as unknown as HTMLElement,
		descSecEl: null as unknown as HTMLElement,
		mapCtEl: null as unknown as HTMLElement,
		mapSecEl: null as unknown as HTMLElement,
		linkEl: null as unknown as HTMLAnchorElement,
		shareBtn: null as unknown as HTMLButtonElement,
		bmarkBtn: null as unknown as HTMLButtonElement,
		hideBtn: null as unknown as HTMLButtonElement,
		deleteBtn: null as unknown as HTMLButtonElement,
		endedBannerEl: null as unknown as HTMLElement,
		currentProperty: null,
		lmap: null,
		lmark: null,
		statusAbort: null,
	};

	const { add, cleanup } = makeEventManager();

	const layout = renderPropertyDetailLayout(ui, {
		onExpand: () => {
			if (ui.currentProperty?.image_urls) {
				bus.emit(EVENTS.GALLERY_OPEN, {
					urls: ui.currentProperty.image_urls,
					index: ui.gallery.getIndex(),
				});
			}
		},
		onShare: () => {
			if (!ui.currentProperty) return;
			const url = ui.currentProperty.source_url;
			const flash = (msg: string) => {
				const prev = ui.shareBtn.title;
				ui.shareBtn.title = msg;
				ui.shareBtn.setAttribute("aria-label", msg);
				setTimeout(() => {
					ui.shareBtn.title = prev;
					ui.shareBtn.setAttribute("aria-label", prev);
				}, 2000);
			};

			if (navigator.share) {
				navigator
					.share({ url, title: ui.currentProperty.location_name ?? "Property" })
					.then(() => flash(t("shareCopied")))
					.catch(() =>
						navigator.clipboard
							.writeText(url)
							.then(() => flash(t("shareCopied"))),
					);
			} else {
				navigator.clipboard.writeText(url).then(() => flash(t("shareCopied")));
			}
		},
		onBookmark: () => {
			if (ui.currentProperty) {
				ui.modal.dispatchEvent(
					new CustomEvent("pd:bmark", {
						bubbles: true,
						detail: ui.currentProperty,
					}),
				);
				bindPropertyData(ui, ui.currentProperty);
			}
		},
		onHide: () => {
			if (ui.currentProperty) {
				ui.modal.dispatchEvent(
					new CustomEvent("pd:hide", {
						bubbles: true,
						detail: ui.currentProperty,
					}),
				);
				ui.modal.close();
			}
		},
		onDelete: () => {
			if (ui.currentProperty) {
				ui.modal.dispatchEvent(
					new CustomEvent("pd:delete", {
						bubbles: true,
						detail: ui.currentProperty,
					}),
				);
			}
		},
	});

	root.appendChild(layout);

	// Check if user is admin to display delete button
	void import("@/features/auth/api").then(({ isCurrentUserAdmin }) => {
		void isCurrentUserAdmin().then((isAdmin) => {
			if (isAdmin) {
				ui.deleteBtn.classList.remove("hidden");
			}
		});
	});

	const onKey = (e: KeyboardEvent) => {
		if (e.key === "ArrowLeft") ui.gallery.navigate(-1);
		if (e.key === "ArrowRight") ui.gallery.navigate(1);
	};
	add(ui.modal, "keydown", onKey);

	const open = async (p: Property) => {
		ui.statusAbort?.abort();
		ui.statusAbort = new AbortController();
		ui.endedBannerEl.classList.add("hidden");
		bindPropertyData(ui, p);
		ui.modal.showModal();
		void checkEnded(ui, p, ui.statusAbort.signal);
		// Reset scroll position after showModal
		const body = ui.modal.querySelector(".overflow-y-auto");
		if (body) setTimeout(() => (body.scrollTop = 0), 0);
		await initMap(ui);
	};

	const offOpen = bus.on(EVENTS.PROPERTY_OPEN, (p) => open(p));

	return () => {
		ui.statusAbort?.abort();
		cleanup();
		offOpen();
		if (ui.lmap) {
			ui.lmap.remove();
			ui.lmap = null;
			ui.lmark = null;
		}
		ui.modal.remove();
	};
}

async function checkEnded(
	ui: PropertyDetailUI,
	p: Property,
	signal: AbortSignal,
): Promise<void> {
	try {
		const res = await fetch("/api/deals/check-ended", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: p.source_url }),
			signal,
		});
		if (!res.ok) return;

		const status = (await res.json()) as { ended?: boolean };
		if (!status.ended || signal.aborted) return;

		ui.endedBannerEl.textContent = t("listingEndedBanner");
		ui.endedBannerEl.classList.remove("hidden");
		ui.modal.dispatchEvent(
			new CustomEvent("pd:hide", {
				bubbles: true,
				detail: p,
			}),
		);
		toast(t("listingEnded"));
	} catch (err) {
		if ((err as Error).name !== "AbortError") {
			console.warn("Failed to check listing status", err);
		}
	}
}

/**
 * Global helper to open the property detail modal.
 */
export function openPropertyDetail(p: Property): void {
	bus.emit(EVENTS.PROPERTY_OPEN, p);
}
