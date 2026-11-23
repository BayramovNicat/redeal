import { Prisma } from "@prisma/client";
import {
	type BinaHeaderProfile,
	createBinaHeaderProfile,
} from "@/utils/bina-headers.js";
import { prisma } from "@/utils/prisma.js";

const BINA_GRAPHQL_URL = "https://bina.az/graphql";
const BINA_ITEM_RE = /^https:\/\/(?:www\.)?bina\.az\/items\/(\d+)(?:[/?#].*)?$/;
const ENDED_MARKERS = [
	"Bu elanın müddəti başa çatıb",
	"Bu elanin muddeti basa catib",
	"Müddəti başa çatıb:",
	'"isSoftError":true',
];

type ListingStatus = {
	url: string;
	ended: boolean;
	deleted: boolean;
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

type BinaItemStatus = {
	item: BinaBatchItemStatus;
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
			expiresAt: null,
			source: "missing",
		});
	}

	if (isGraphQLItemEnded(gql.item)) {
		return deleteIfNeeded({
			url: canonicalUrl,
			ended: true,
			deleted: false,
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
			expiresAt: gql.item.expiresAt,
			source: "html",
		});
	}

	return {
		url: canonicalUrl,
		ended: false,
		deleted: false,
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
			item(id: $id) { id state isExpiredManually expiresAt }
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
