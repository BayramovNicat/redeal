import type { PriceHistoryEntry } from "@/core/types";

export function Sparkline(
	history: PriceHistoryEntry[],
	color: string,
): SVGSVGElement | null {
	const prices = history.map((h) => Number(h.price));
	if (prices.length < 2) return null;

	const W = 56,
		H = 18;
	const min = Math.min(...prices);
	const max = Math.max(...prices);
	const range = max - min || 1;

	const points = prices
		.map((p, i) => {
			const x = (i / (prices.length - 1)) * W;
			const y = H - 2 - ((p - min) / range) * (H - 4);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("width", String(W));
	svg.setAttribute("height", String(H));
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	svg.setAttribute("aria-hidden", "true");
	svg.style.flexShrink = "0";

	const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
	pl.setAttribute("points", points);
	pl.setAttribute("fill", "none");
	pl.setAttribute("stroke", color);
	pl.setAttribute("stroke-width", "1.5");
	pl.setAttribute("stroke-linecap", "round");
	pl.setAttribute("stroke-linejoin", "round");
	pl.setAttribute("opacity", "0.7");
	svg.appendChild(pl);

	return svg;
}
