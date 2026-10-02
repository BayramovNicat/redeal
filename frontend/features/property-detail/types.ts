import type { map, marker } from "leaflet";
import type { Property } from "@/core/types";
import type { GalleryElement } from "@/ui/gallery";

export interface PropertyDetailUI {
	modal: HTMLElement & { showModal: () => void; close: () => void };
	gallery: GalleryElement;
	locationEl: HTMLElement;
	postedEl: HTMLElement;
	priceEl: HTMLElement;
	tierEl: HTMLElement;
	statsEl: HTMLElement;
	mktAvgEl: HTMLElement;
	discPctEl: HTMLElement;
	discBarEl: HTMLElement;
	tagsEl: HTMLElement;
	historyChartEl: HTMLElement;
	historySecEl: HTMLElement;
	descBodyEl: HTMLElement;
	descSecEl: HTMLElement;
	mapCtEl: HTMLElement;
	mapSecEl: HTMLElement;
	linkEl: HTMLAnchorElement;
	shareBtn: HTMLButtonElement;
	bmarkBtn: HTMLButtonElement;
	hideBtn: HTMLButtonElement;
	deleteBtn: HTMLButtonElement;
	endedBannerEl: HTMLElement;

	// State/Refs
	currentProperty: Property | null;
	lmap: ReturnType<typeof map> | null;
	lmark: ReturnType<typeof marker> | null;
	statusAbort: AbortController | null;
}
