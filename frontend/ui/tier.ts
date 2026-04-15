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
			hex: "#4ade80",
		};
	if (tier === "Good Deal")
		return {
			c: "var(--blue)",
			bg: "var(--blue-dim)",
			b: "var(--blue-b)",
			hex: "#60a5fa",
		};
	if (tier === "Fair Price")
		return {
			c: "var(--yellow)",
			bg: "var(--yellow-dim)",
			b: "var(--yellow-b)",
			hex: "#fbbf24",
		};
	return {
		c: "var(--red)",
		bg: "var(--red-dim)",
		b: "var(--red-b)",
		hex: "#f87171",
	};
}
