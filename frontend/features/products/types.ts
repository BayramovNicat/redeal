export interface ProductsUI {
	container: HTMLElement;
	resultsMeta: HTMLElement;
	savedBtn: HTMLButtonElement;
	savedBadge: HTMLElement;
	sortSelect: HTMLSelectElement;
	viewGridBtn: HTMLButtonElement;
	viewListBtn: HTMLButtonElement;
	viewMapBtn: HTMLButtonElement;
	resultsBarInner: HTMLElement;
	resultsBarContainer: HTMLElement;
	loadingState: HTMLElement;
	emptyState: HTMLElement;
	welcomeState: HTMLElement;
	cardsContainer: HTMLElement;
	sentinel: HTMLElement;
	loadMoreContainer: HTMLElement;
	mapViewContainer: HTMLElement;
	backToTopBtn: HTMLButtonElement;
}

export interface ProductsCallbacks {
	onSortChange: (val: string) => void;
	onViewChange: (view: "grid" | "list" | "map") => void;
	onExport: () => void;
	onValidate: (button: HTMLButtonElement) => void;
	onSavedClick: (e: MouseEvent) => void;
	onAlertsOpen: () => void;
	onBackToTop: () => void;
}
