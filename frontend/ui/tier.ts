export interface TierStyle {
	c: string;
	solid: string;
	bg: string;
	b: string;
	glow: string;
	hex: string;
}

export function ts(tier: string): TierStyle {
	if (tier === "High Value Deal")
		return {
			c: "var(--green)",
			solid: "var(--green-solid)",
			bg: "var(--green-dim)",
			b: "var(--green-b)",
			glow: "rgba(52, 211, 153, 0.24)",
			hex: "#34d399",
		};
	if (tier === "Good Deal")
		return {
			c: "var(--blue)",
			solid: "var(--blue-solid)",
			bg: "var(--blue-dim)",
			b: "var(--blue-b)",
			glow: "rgba(56, 189, 248, 0.24)",
			hex: "#38bdf8",
		};
	if (tier === "Fair Price")
		return {
			c: "var(--yellow)",
			solid: "var(--yellow-solid)",
			bg: "var(--yellow-dim)",
			b: "var(--yellow-b)",
			glow: "rgba(251, 191, 36, 0.24)",
			hex: "#fbbf24",
		};
	if (tier === "Overpriced")
		return {
			c: "var(--red)",
			solid: "var(--red-solid)",
			bg: "var(--red-dim)",
			b: "var(--red-b)",
			glow: "rgba(251, 113, 133, 0.24)",
			hex: "#fb7185",
		};
	// Market Price / unknown → muted
	return {
		c: "var(--muted)",
		solid: "var(--muted)",
		bg: "var(--surface-2)",
		b: "var(--border)",
		glow: "rgba(111, 120, 140, 0.22)",
		hex: "#6f788c",
	};
}

/**
 * Maps a discount threshold percentage to the matching deal tier style.
 * Uses a neutral generic palette at 0 ("All") when no minimum discount is applied.
 */
export function thresholdStyle(threshold: number): TierStyle {
	if (threshold >= 20) return ts("High Value Deal");
	if (threshold >= 10) return ts("Good Deal");
	if (threshold > 0) return ts("Fair Price");
	if (threshold < 0) return ts("Overpriced");
	return {
		c: "var(--text-2)",
		solid: "var(--muted)",
		bg: "var(--surface-2)",
		b: "var(--border-h)",
		glow: "rgba(165, 174, 192, 0.2)",
		hex: "#a5aec0",
	};
}
