import type { DealTier } from "@/utils/deals.js";

export type PropertyFilters = {
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
	hasDocument?: boolean;
	hasMortgage?: boolean;
	hasRepair?: boolean;
	isUrgent?: boolean;
	notLastFloor?: boolean;
	hasActiveMortgage?: boolean;
	category?: string;
	since?: Date;
	descriptionSearch?: string;
};

export type PaginationOptions = {
	limit?: number;
	offset?: number;
};

export type PropertyRow = {
	id: number;
	source_url: string;
	price: number;
	area_sqm: number;
	price_per_sqm: number;
	district: string;
	location_name: string | null;
	latitude: number | null;
	longitude: number | null;
	rooms: number | null;
	floor: number | null;
	total_floors: number | null;
	category: string | null;
	has_document: boolean | null;
	has_mortgage: boolean | null;
	has_repair: boolean | null;
	description: string | null;
	is_urgent: boolean;
	has_active_mortgage: boolean;
	price_drop_count: number;
	image_urls: string[];
	posted_date: Date | null;
	created_at: Date;
	updated_at: Date;
	location_avg_price_per_sqm: number;
	discount_percent: number;
};

export type PriceHistoryEntry = {
	price: string;
	recorded_at: string;
};

export type PropertyRowWithCount = PropertyRow & {
	total_count: bigint;
};

export type MapPinRow = {
	source_url: string;
	latitude: number;
	longitude: number;
	price: number;
	price_per_sqm: number;
	rooms: number | null;
	location_name: string | null;
	image_urls: string[];
	discount_percent: number;
};

/** Shape of the filters JSON stored in Alert.filters — subset of PropertyFilters + alert-specific fields */
export type AlertFilters = Omit<
	PropertyFilters,
	"minPriceSqm" | "maxPriceSqm" | "since"
> & {
	location?: string;
	threshold?: number;
};

export type TrendPoint = {
	week: Date;
	avg_ppsm: number;
	listing_count: number;
};

export type HeatmapPoint = {
	location_name: string;
	avg_price_per_sqm: number;
	count: number;
	lat: number;
	lng: number;
	recent_avg: number | null;
	prior_avg: number | null;
	trend: "up" | "down" | "flat";
};

export type MapPin = {
	source_url: string;
	lat: number;
	lng: number;
	price: number;
	price_per_sqm: number;
	rooms: number | null;
	location_name: string | null;
	image_url: string | null;
	discount_percent: number;
	tier: DealTier;
};

export type PropertyRowWithHistory = PropertyRowWithCount & {
	price_history: PriceHistoryEntry[] | null;
};
