export interface Property {
	source_url: string;
	price: number;
	area_sqm: number;
	price_per_sqm: number;
	location_avg_price_per_sqm: number;
	discount_percent: number;
	tier: string;
	district?: string;
	location_name?: string;
	rooms?: number;
	floor?: number;
	total_floors?: number;
	is_urgent?: boolean;
	has_document?: boolean;
	has_repair?: boolean;
	has_mortgage?: boolean;
	has_active_mortgage?: boolean;
	posted_date?: string;
	description?: string;
	latitude?: number;
	longitude?: number;
}

export interface TrendPoint {
	week: string;
	avg_ppsm: string | number;
	listing_count: number;
}

export interface HeatmapPoint {
	location_name: string;
	avg_price_per_sqm: number;
	count: number;
	lat: number;
	lng: number;
}

export interface AlertFilters {
	location: string;
	threshold: number;
	minPrice?: number;
	maxPrice?: number;
	minPriceSqm?: number;
	maxPriceSqm?: number;
	minArea?: number;
	maxArea?: number;
	minRooms?: number;
	maxRooms?: number;
	minFloor?: number;
	maxFloor?: number;
	minTotalFloors?: number;
	maxTotalFloors?: number;
	category?: string;
	hasRepair?: boolean;
	hasDocument?: boolean;
	hasMortgage?: boolean;
	isUrgent?: boolean;
	notLastFloor?: boolean;
	hasActiveMortgage?: boolean;
}

export interface Alert {
	token: string;
	label?: string;
	filters?: AlertFilters;
}

export interface CardCallbacks {
	onBM: (p: Property) => void;
	onHide: (url: string) => void;
	onDesc: (text: string) => void;
	onMap: (lat: number, lng: number, label?: string) => void;
}

declare global {
	interface Window {
		__renderDeals?: () => void;
		__updateChips?: () => void;
	}
}
