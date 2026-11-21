export interface TierStyle {
	c: string;
	bg: string;
	b: string;
	hex: string;
}

export function ts(tier: string): TierStyle {
	if (tier === "High Value Deal")
		return {
			c: "var(--green)",
			bg: "var(--green-dim)",
			b: "var(--green-b)",
			hex: "#34d399",
		};
	if (tier === "Good Deal")
		return {
			c: "var(--blue)",
			bg: "var(--blue-dim)",
			b: "var(--blue-b)",
			hex: "#38bdf8",
		};
	if (tier === "Fair Price")
		return {
			c: "var(--yellow)",
			bg: "var(--yellow-dim)",
			b: "var(--yellow-b)",
			hex: "#fbbf24",
		};
	if (tier === "Overpriced")
		return {
			c: "var(--red)",
			bg: "var(--red-dim)",
			b: "var(--red-b)",
			hex: "#fb7185",
		};
	// Market Price / unknown → muted
	return {
		c: "var(--muted)",
		bg: "var(--surface-2)",
		b: "var(--border)",
		hex: "#6f788c",
	};
}
