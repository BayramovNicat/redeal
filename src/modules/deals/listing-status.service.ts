import { Prisma, type PropertyCategory } from "@prisma/client";
import {
	detectActiveMortgage,
	detectUrgent,
} from "@/scrapers/base.scraper.js";
import {
	type BinaHeaderProfile,
	createBinaHeaderProfile,
} from "@/utils/bina-headers.js";
import { slugToDistrict } from "@/utils/district-normalizer.js";
import { prisma } from "@/utils/prisma.js";
import { normalizePropertyCategory } from "@/utils/property-category.js";

const BINA_GRAPHQL_URL = "https://bina.az/graphql";
const BINA_ITEM_RE = /^https:\/\/(?:www\.)?bina\.az\/items\/(\d+)(?:[/?#].*)?$/;
const ENDED_MARKERS = [
	"Bu elanın müddəti başa çatıb",
	"Bu elanin muddeti basa catib",
	"Müddəti başa çatıb:",
	'"isSoftError":true',
];

export type ListingStatus = {
	url: string;
	ended: boolean;
	deleted: boolean;
	updated: boolean;
	expiresAt: string | null;
	source: "graphql" | "html" | "missing";
};

type BatchListingStatus = {
	checked: number;
	ended: number;
	deleted: number;
	failed: number;
};

const BATCH_GRAPHQL_SIZE = 25;
const BATCH_GRAPHQL_CONCURRENCY = 2;
const CHUNK_DELAY_MIN_MS = 300;
const CHUNK_DELAY_MAX_MS = 800;
const MAX_BATCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const DELETE_CHUNK_SIZE = 1000;

function randomJitterMs(minMs: number, maxMs: number): number {
	return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

type GraphQLResponse<T> = {
	data?: T;
	errors?: Array<{ message: string; path?: unknown[] }>;
};

export type BinaBatchItemStatus = {
	id: string;
	state?: string | null;
	isExpiredManually?: boolean | null;
	expiresAt: string | null;
} | null;

export type BinaFullItem = NonNullable<BinaBatchItemStatus> & {
	title?: string | null;
	description?: string | null;
	updatedAt?: string | null;
	rooms?: number | null;
	floor?: number | null;
	floors?: number | null;
	hasMortgage?: boolean | null;
	hasRepair?: boolean | null;
	hasBillOfSale?: boolean | null;
	price?: { total: number; currency: string } | null;
	area?: { value: number } | null;
	location?: {
		name: string;
		slug: string;
		id: string;
		latitude: number | null;
		longitude: number | null;
	} | null;
	category?: { name: string } | null;
	latitude?: number | null;
	longitude?: number | null;
	photos?: Array<{ full: string }> | null;
};

type BinaItemStatus = {
	item: BinaFullItem | null;
};

export function getBinaItemId(url: string): string | null {
	return url.match(BINA_ITEM_RE)?.[1] ?? null;
}

export function isGraphQLItemEnded(item: BinaBatchItemStatus): boolean {
	if (!item) return true;
	if (item.state && item.state !== "PUBLISHED") return true;
	if (item.isExpiredManually === true) return true;
	if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return true;
	return false;
}

export async function checkAndDeleteEndedListing(
	url: string,
): Promise<ListingStatus> {
	const itemId = getBinaItemId(url);
	if (!itemId) {
		throw new Error("Only bina.az item URLs are supported");
	}

	const canonicalUrl = `https://bina.az/items/${itemId}`;
	const headerProfile = createBinaHeaderProfile();
	const gql = await fetchBinaGraphQLStatus(itemId, headerProfile);
	if (!gql.item) {
		return deleteIfNeeded({
			url: canonicalUrl,
			ended: true,
			deleted: false,
			updated: false,
			expiresAt: null,
			source: "missing",
		});
	}

	if (isGraphQLItemEnded(gql.item)) {
		return deleteIfNeeded({
			url: canonicalUrl,
			ended: true,
			deleted: false,
			updated: false,
			expiresAt: gql.item.expiresAt,
			source: "graphql",
		});
	}

	const htmlEnded = await fetchBinaHtmlEnded(canonicalUrl, headerProfile);
	if (htmlEnded) {
		return deleteIfNeeded({
			url: canonicalUrl,
			ended: true,
			deleted: false,
			updated: false,
			expiresAt: gql.item.expiresAt,
			source: "html",
		});
	}

	const syncResult = await syncListingIfChanged(
		itemId,
		canonicalUrl,
		gql.item,
	);

	return {
		url: syncResult.sourceUrl,
		ended: false,
		deleted: false,
		updated: syncResult.updated,
		expiresAt: gql.item.expiresAt,
		source: "graphql",
	};
}

export async function checkAndDeleteEndedListings(
	urls: string[],
	deleteByUrls: (
		urlBatch: string[],
	) => Promise<number> = deletePropertiesByUrls,
): Promise<BatchListingStatus> {
	const urlsById = new Map<string, string[]>();
	for (const url of urls) {
		const id = getBinaItemId(url);
		if (!id) continue;
		const list = urlsById.get(id);
		if (list) {
			if (!list.includes(url)) list.push(url);
		} else {
			urlsById.set(id, [url]);
		}
	}

	const entries = Array.from(urlsById.entries());
	const chunks = chunk(entries, BATCH_GRAPHQL_SIZE);
	const headerProfile = createBinaHeaderProfile();
	let checked = 0;
	let ended = 0;
	let failed = 0;
	const endedUrls = new Set<string>();
	const activeExpiresUpdates: Array<{ url: string; expiresAt: Date }> = [];
	let index = 0;

	async function worker(): Promise<void> {
		while (index < chunks.length) {
			const batch = chunks[index++];
			if (!batch) continue;
			try {
				const statuses = await fetchBinaGraphQLStatusesWithRetry(
					batch.map(([id]) => id),
					headerProfile,
				);
				for (const [id, itemUrls] of batch) {
					const key = `i${id}`;
					if (!Object.hasOwn(statuses, key)) {
						failed += itemUrls.length;
						continue;
					}
					checked += itemUrls.length;
					const item = statuses[key] ?? null;
					if (isGraphQLItemEnded(item)) {
						ended += itemUrls.length;
						for (const url of itemUrls) endedUrls.add(url);
					} else if (item?.expiresAt) {
						const parsed = Date.parse(item.expiresAt);
						if (!Number.isNaN(parsed)) {
							const expiresAt = new Date(parsed);
							for (const url of itemUrls) {
								activeExpiresUpdates.push({ url, expiresAt });
							}
						}
					}
				}
			} catch (err) {
				for (const [, itemUrls] of batch) failed += itemUrls.length;
				console.warn("[ListingStatus] GraphQL batch check failed:", err);
			}

			if (index < chunks.length) {
				await new Promise((resolve) =>
					setTimeout(
						resolve,
						randomJitterMs(CHUNK_DELAY_MIN_MS, CHUNK_DELAY_MAX_MS),
					),
				);
			}
		}
	}

	await Promise.all(
		Array.from(
			{ length: Math.min(BATCH_GRAPHQL_CONCURRENCY, chunks.length) },
			() => worker(),
		),
	);

	let deletedCount = 0;
	if (endedUrls.size > 0) {
		for (const urlBatch of chunk([...endedUrls], DELETE_CHUNK_SIZE)) {
			deletedCount += await deleteByUrls(urlBatch);
		}
	}

	if (
		activeExpiresUpdates.length > 0 &&
		deleteByUrls === deletePropertiesByUrls
	) {
		await persistExpiresAtUpdates(activeExpiresUpdates);
	}

	return { checked, ended, deleted: deletedCount, failed };
}

export async function deletePropertiesByUrls(
	urlBatch: string[],
): Promise<number> {
	if (urlBatch.length === 0) return 0;
	const deleted = await prisma.property.deleteMany({
		where: { source_url: { in: urlBatch } },
	});
	return deleted.count;
}

async function persistExpiresAtUpdates(
	updates: Array<{ url: string; expiresAt: Date }>,
): Promise<void> {
	for (const batch of chunk(updates, DELETE_CHUNK_SIZE)) {
		const values = batch.map(
			(u) => Prisma.sql`(${u.url}, ${u.expiresAt}::timestamp)`,
		);
		await prisma.$executeRaw`
			UPDATE "Property" AS p
			SET expires_at = v.expires_at
			FROM (VALUES ${Prisma.join(values)}) AS v(source_url, expires_at)
			WHERE p.source_url = v.source_url
		`;
	}
}

type ExistingPropertySnapshot = {
	id: number;
	source_url: string;
	price: Prisma.Decimal | number;
	area_sqm: Prisma.Decimal | number;
	price_per_sqm: Prisma.Decimal | number;
	district: string;
	location_name: string | null;
	latitude: number | null;
	longitude: number | null;
	rooms: number | null;
	floor: number | null;
	total_floors: number | null;
	category: PropertyCategory | null;
	has_document: boolean | null;
	has_mortgage: boolean | null;
	has_repair: boolean | null;
	description: string | null;
	image_urls: string[];
	is_urgent: boolean;
	has_active_mortgage: boolean;
	posted_date: Date | null;
	expires_at: Date | null;
};

function numbersDiffer(
	a: Prisma.Decimal | number | null | undefined,
	b: number | null | undefined,
): boolean {
	if (a == null && b == null) return false;
	if (a == null || b == null) return true;
	return Math.abs(Number(a) - b) > 1e-6;
}

function datesDiffer(
	a: Date | null | undefined,
	b: Date | null | undefined,
): boolean {
	const ta = a ? a.getTime() : null;
	const tb = b ? b.getTime() : null;
	return ta !== tb;
}

function arraysDiffer(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return true;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return true;
	}
	return false;
}

function parseOptionalDate(raw: string | null | undefined): Date | null {
	if (!raw) return null;
	const ms = Date.parse(raw);
	return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Compares live bina.az GraphQL item fields against the stored Property row
 * and returns a Prisma update payload containing only changed fields, or null
 * when everything matches.
 */
export function buildPropertyUpdateData(
	existing: ExistingPropertySnapshot,
	item: BinaFullItem,
): { updateData: Prisma.PropertyUpdateInput; isPriceDrop: boolean } | null {
	const updateData: Prisma.PropertyUpdateInput = {};
	let changed = false;

	const oldPrice = Number(existing.price);
	const oldArea = Number(existing.area_sqm);
	const nextPrice =
		item.price?.total && item.price.total > 0 ? item.price.total : oldPrice;
	const nextArea =
		item.area?.value && item.area.value > 0 ? item.area.value : oldArea;
	const priceChanged = numbersDiffer(oldPrice, nextPrice);
	const areaChanged = numbersDiffer(oldArea, nextArea);

	if (priceChanged) {
		updateData.price = nextPrice;
		changed = true;
	}
	if (areaChanged) {
		updateData.area_sqm = nextArea;
		changed = true;
	}
	if (priceChanged || areaChanged) {
		const nextPpsm =
			nextArea > 0 ? parseFloat((nextPrice / nextArea).toFixed(2)) : 0;
		if (numbersDiffer(existing.price_per_sqm, nextPpsm)) {
			updateData.price_per_sqm = nextPpsm;
			changed = true;
		}
	}

	const isPriceDrop = priceChanged && nextPrice < oldPrice;
	if (isPriceDrop) {
		updateData.price_drop_count = { increment: 1 };
	}

	if (item.location?.slug) {
		const normalized = slugToDistrict(item.location.slug);
		const nextDistrict =
			normalized === "Unknown" ? item.location.name : normalized;
		if (nextDistrict && nextDistrict !== existing.district) {
			updateData.district = nextDistrict;
			changed = true;
		}
		if (item.location.slug !== existing.location_name) {
			updateData.location_name = item.location.slug;
			changed = true;
		}
	}

	const nextLat = item.latitude ?? item.location?.latitude ?? null;
	const nextLng = item.longitude ?? item.location?.longitude ?? null;
	if (nextLat !== null && numbersDiffer(existing.latitude, nextLat)) {
		updateData.latitude = nextLat;
		changed = true;
	}
	if (nextLng !== null && numbersDiffer(existing.longitude, nextLng)) {
		updateData.longitude = nextLng;
		changed = true;
	}

	const nextRooms = item.rooms !== undefined ? item.rooms : existing.rooms;
	if (nextRooms !== existing.rooms) {
		updateData.rooms = nextRooms;
		changed = true;
	}
	const nextFloor = item.floor !== undefined ? item.floor : existing.floor;
	if (nextFloor !== existing.floor) {
		updateData.floor = nextFloor;
		changed = true;
	}
	const nextTotalFloors =
		item.floors !== undefined ? item.floors : existing.total_floors;
	if (nextTotalFloors !== existing.total_floors) {
		updateData.total_floors = nextTotalFloors;
		changed = true;
	}

	if (item.category?.name) {
		const nextCategory = normalizePropertyCategory(item.category.name) ?? null;
		if (nextCategory && nextCategory !== existing.category) {
			updateData.category = nextCategory;
			changed = true;
		}
	}

	if (
		item.hasBillOfSale !== undefined &&
		item.hasBillOfSale !== existing.has_document
	) {
		updateData.has_document = item.hasBillOfSale;
		changed = true;
	}
	if (
		item.hasMortgage !== undefined &&
		item.hasMortgage !== existing.has_mortgage
	) {
		updateData.has_mortgage = item.hasMortgage;
		changed = true;
	}
	if (item.hasRepair !== undefined && item.hasRepair !== existing.has_repair) {
		updateData.has_repair = item.hasRepair;
		changed = true;
	}

	if (item.description !== undefined) {
		const nextDesc = item.description ?? null;
		if (nextDesc !== existing.description) {
			updateData.description = nextDesc;
			changed = true;
		}
		const urgencyText = `${item.title ?? ""} ${item.description ?? ""}`;
		const nextUrgent = detectUrgent(urgencyText);
		if (nextUrgent !== existing.is_urgent) {
			updateData.is_urgent = nextUrgent;
			changed = true;
		}
		const nextActiveMortgage = detectActiveMortgage(item.description ?? "");
		if (nextActiveMortgage !== existing.has_active_mortgage) {
			updateData.has_active_mortgage = nextActiveMortgage;
			changed = true;
		}
	}

	if (item.photos !== undefined) {
		const nextImages = item.photos?.map((p) => p.full) ?? [];
		if (arraysDiffer(existing.image_urls ?? [], nextImages)) {
			updateData.image_urls = nextImages;
			changed = true;
		}
	}

	const nextPosted = parseOptionalDate(item.updatedAt);
	if (nextPosted && datesDiffer(existing.posted_date, nextPosted)) {
		updateData.posted_date = nextPosted;
		changed = true;
	}

	const nextExpires = parseOptionalDate(item.expiresAt);
	if (nextExpires && datesDiffer(existing.expires_at, nextExpires)) {
		updateData.expires_at = nextExpires;
		changed = true;
	}

	return changed ? { updateData, isPriceDrop } : null;
}

async function syncListingIfChanged(
	itemId: string,
	canonicalUrl: string,
	item: BinaFullItem,
): Promise<{ updated: boolean; sourceUrl: string }> {
	const urls = [
		`https://bina.az/items/${itemId}`,
		`https://www.bina.az/items/${itemId}`,
	];
	const existing = await prisma.property.findFirst({
		where: { source_url: { in: urls } },
		select: {
			id: true,
			source_url: true,
			price: true,
			area_sqm: true,
			price_per_sqm: true,
			district: true,
			location_name: true,
			latitude: true,
			longitude: true,
			rooms: true,
			floor: true,
			total_floors: true,
			category: true,
			has_document: true,
			has_mortgage: true,
			has_repair: true,
			description: true,
			image_urls: true,
			is_urgent: true,
			has_active_mortgage: true,
			posted_date: true,
			expires_at: true,
		},
	});

	if (!existing) {
		return { updated: false, sourceUrl: canonicalUrl };
	}

	const diff = buildPropertyUpdateData(existing, item);
	if (!diff) {
		return { updated: false, sourceUrl: existing.source_url };
	}

	await prisma.$transaction(async (tx) => {
		if (diff.isPriceDrop) {
			await tx.priceHistory.create({
				data: {
					property_id: existing.id,
					price: existing.price,
					price_per_sqm: existing.price_per_sqm,
				},
			});
		}
		await tx.property.update({
			where: { id: existing.id },
			data: diff.updateData,
		});
	});

	return { updated: true, sourceUrl: existing.source_url };
}

async function deleteIfNeeded(status: ListingStatus): Promise<ListingStatus> {
	const itemId = getBinaItemId(status.url);
	const urls = itemId
		? [`https://bina.az/items/${itemId}`, `https://www.bina.az/items/${itemId}`]
		: [status.url];
	const deleted = await prisma.property.deleteMany({
		where: { source_url: { in: urls } },
	});
	return { ...status, deleted: deleted.count > 0 };
}

async function fetchBinaGraphQLStatus(
	itemId: string,
	headerProfile: BinaHeaderProfile,
): Promise<BinaItemStatus> {
	const query = /* graphql */ `
		query ItemStatus($id: ID!) {
			item(id: $id) {
				id
				state
				isExpiredManually
				expiresAt
				title
				description
				updatedAt
				rooms
				floor
				floors
				hasMortgage
				hasRepair
				hasBillOfSale
				price { total currency }
				area { value }
				location { name slug id latitude longitude }
				category { name }
				latitude
				longitude
				photos { full }
			}
		}
	`;

	const resp = await fetch(BINA_GRAPHQL_URL, {
		method: "POST",
		headers: headerProfile.graphql(`https://bina.az/items/${itemId}`),
		body: JSON.stringify({ query, variables: { id: itemId } }),
		signal: AbortSignal.timeout(10_000),
	});

	if (!resp.ok) {
		throw new Error(`bina.az GraphQL returned HTTP ${resp.status}`);
	}

	const json = (await resp.json()) as GraphQLResponse<BinaItemStatus>;
	if (json.errors?.length && !json.data?.item) {
		throw new Error(json.errors[0]?.message ?? "bina.az GraphQL error");
	}
	return json.data ?? { item: null };
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

async function fetchBinaGraphQLStatusesWithRetry(
	itemIds: string[],
	headerProfile: BinaHeaderProfile,
): Promise<Record<string, BinaBatchItemStatus>> {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
		try {
			return await fetchBinaGraphQLStatuses(itemIds, headerProfile);
		} catch (err) {
			lastErr = err;
			const retryable =
				!(err instanceof NonRetryableGraphQLError) &&
				attempt < MAX_BATCH_ATTEMPTS;
			if (!retryable) throw err;
			await new Promise((resolve) =>
				setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt),
			);
		}
	}
	throw lastErr;
}

class NonRetryableGraphQLError extends Error {}

async function fetchBinaGraphQLStatuses(
	itemIds: string[],
	headerProfile: BinaHeaderProfile,
): Promise<Record<string, BinaBatchItemStatus>> {
	const fields = itemIds
		.map(
			(id) =>
				`i${id}: item(id: "${id}") { id state isExpiredManually expiresAt }`,
		)
		.join("\n");
	const resp = await fetch(BINA_GRAPHQL_URL, {
		method: "POST",
		headers: headerProfile.graphql("https://bina.az/"),
		body: JSON.stringify({ query: `{ ${fields} }` }),
		signal: AbortSignal.timeout(15_000),
	});

	if (!resp.ok) {
		const message = `bina.az GraphQL returned HTTP ${resp.status}`;
		if (isRetryableStatus(resp.status)) {
			throw new Error(message);
		}
		throw new NonRetryableGraphQLError(message);
	}

	const json = (await resp.json()) as GraphQLResponse<
		Record<string, BinaBatchItemStatus>
	> & { errors?: Array<{ message?: string; path?: Array<string | number> }> };
	if (!json.data || typeof json.data !== "object") {
		throw new Error(
			json.errors?.[0]?.message ?? "bina.az GraphQL returned empty data",
		);
	}
	if (json.errors?.length) {
		const errorKeys = new Set<string>();
		for (const err of json.errors) {
			const fieldKey = err.path?.[0];
			if (typeof fieldKey === "string") errorKeys.add(fieldKey);
		}
		if (errorKeys.size === 0) {
			throw new Error(json.errors[0]?.message ?? "bina.az GraphQL error");
		}
		const filtered: Record<string, BinaBatchItemStatus> = { ...json.data };
		for (const key of errorKeys) {
			if (filtered[key] === null) delete filtered[key];
		}
		return filtered;
	}
	return json.data;
}

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

async function fetchBinaHtmlEnded(
	url: string,
	headerProfile: BinaHeaderProfile,
): Promise<boolean> {
	const resp = await fetch(url, {
		headers: headerProfile.html(),
		signal: AbortSignal.timeout(10_000),
	});

	if (!resp.ok) return resp.status === 404 || resp.status === 410;
	const html = await resp.text();
	return ENDED_MARKERS.some((marker) => html.includes(marker));
}
