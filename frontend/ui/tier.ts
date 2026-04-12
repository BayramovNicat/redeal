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
			hex: "#22c55e",
		};
	if (tier === "Good Deal")
		return {
			c: "var(--blue)",
			bg: "var(--blue-dim)",
			b: "var(--blue-b)",
			hex: "#3b82f6",
		};
	if (tier === "Fair Price")
		return {
			c: "var(--yellow)",
			bg: "var(--yellow-dim)",
			b: "var(--yellow-b)",
			hex: "#f59e0b",
		};
	return {
		c: "var(--red)",
		bg: "var(--red-dim)",
		b: "var(--red-b)",
		hex: "#ef4444",
	};
}
