/**
 * Maximum plausible discount percentage for a deal.
 * Listings with >90% discount are mostly wrongly declared (e.g. price/area typos)
 * and are excluded from deal results.
 */
export const MAX_DEAL_DISCOUNT_PERCENT = 90;

export const DEAL_TIERS = {
	HIGH_VALUE: "High Value Deal",
	GOOD: "Good Deal",
	FAIR: "Fair Price",
	OVERPRICED: "Overpriced",
} as const;

export type DealTier = (typeof DEAL_TIERS)[keyof typeof DEAL_TIERS];

/**
 * Maps a discount percentage to a human-readable deal tier.
 * This is the single place to adjust scoring thresholds.
 */
export function classifyDeal(discountPercent: number): DealTier {
	if (discountPercent >= 20) return DEAL_TIERS.HIGH_VALUE;
	if (discountPercent >= 10) return DEAL_TIERS.GOOD;
	if (discountPercent >= 0) return DEAL_TIERS.FAIR;
	return DEAL_TIERS.OVERPRICED;
}
