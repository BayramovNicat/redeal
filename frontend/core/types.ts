export interface PriceHistoryEntry {
	price: string;
	recorded_at: string;
}

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
	price_drop_count?: number;
	price_history?: PriceHistoryEntry[];
	posted_date?: string;
	description?: string;
	image_urls?: string[];
	latitude?: number;
	longitude?: number;
}

export interface MapPin {
	source_url: string;
	lat: number;
	lng: number;
	price: number;
	price_per_sqm: number;
	area_sqm: number | null;
	floor: number | null;
	total_floors: number | null;
	rooms: number | null;
	location_name: string | null;
	image_url: string | null;
	discount_percent: number;
	tier: string;
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
	recent_avg: number | null;
	prior_avg: number | null;
	trend: "up" | "down" | "flat";
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
	onGallery: (urls: string[], index?: number) => void;
	onDetail: (p: Property) => void;
}

declare global {
	interface Window {
		__renderDeals?: () => void;
		__updateChips?: () => void;
	}
}
