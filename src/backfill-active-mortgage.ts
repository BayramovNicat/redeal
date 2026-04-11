/**
 * Backfill script: compute has_active_mortgage for all existing Property rows.
 *
 * Reads each property's description in batches, applies the same regex used
 * by the scraper, and updates the column. Safe to re-run: already-correct
 * rows are updated to the same value.
 *
 * Run:
 *   bun run backfill:active-mortgage
 */

import { prisma } from "./utils/prisma.js";

/** Must match BaseScraper.ACTIVE_MORTGAGE_RE */
const ACTIVE_MORTGAGE_RE =
	/haz[ıi]r\s+ipoteka|ipoteka\s+borcu|bank\s+borcu|kredit\s+borcu|üzərində\s+borc|borclu|girov/i;

const BATCH_SIZE = 500;

async function main() {
	console.log("[backfill] Starting has_active_mortgage backfill...");

	const total = await prisma.property.count();
	console.log(`[backfill] Total properties: ${total}`);

	let offset = 0;
	let updated = 0;
	let processed = 0;

	while (offset < total) {
		const rows = await prisma.property.findMany({
			select: { id: true, description: true },
			skip: offset,
			take: BATCH_SIZE,
			orderBy: { id: "asc" },
		});

		if (rows.length === 0) break;

		// Separate rows into two groups to avoid updating every row
		const toSetTrue: number[] = [];
		const toSetFalse: number[] = [];

		for (const row of rows) {
			const matches = row.description
				? ACTIVE_MORTGAGE_RE.test(row.description)
				: false;
			(matches ? toSetTrue : toSetFalse).push(row.id);
		}

		// Batch update each group in a single query
		if (toSetTrue.length > 0) {
			await prisma.property.updateMany({
				where: { id: { in: toSetTrue } },
				data: { has_active_mortgage: true },
			});
			updated += toSetTrue.length;
		}
		if (toSetFalse.length > 0) {
			await prisma.property.updateMany({
				where: { id: { in: toSetFalse } },
				data: { has_active_mortgage: false },
			});
		}

		processed += rows.length;
		offset += BATCH_SIZE;

		console.log(
			`[backfill] ${processed}/${total} processed, ${updated} flagged as active mortgage`,
		);
	}

	console.log(
		`[backfill] Done. ${updated} / ${total} properties have has_active_mortgage = true.`,
	);
	await prisma.$disconnect();
}

main().catch((err) => {
	console.error("[backfill] Fatal error:", err);
	process.exit(1);
});
