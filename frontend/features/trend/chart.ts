import { t } from "@/core/i18n";
import type { TrendPoint } from "@/core/types";
import { fmt, frag, getLocale, html } from "@/core/utils";
import type { TrendUI } from "./types";

/**
 * Renders the SVG spline chart and handles tooltip interactions.
 */
export function renderTrendChart(
	ui: TrendUI,
	data: TrendPoint[],
	isUp: boolean,
	isDown: boolean,
): SVGElement | null {
	const vals = data.map((v) => Number(v.avg_ppsm));
	const W = ui.chartEl.clientWidth || 600;
	const H = 80;
	const PAD_Y = 8;

	if (W === 0) return null;

	const min = Math.min(...vals);
	const max = Math.max(...vals);
	const range = max - min || 1;
	const xv = (i: number) => (i / (data.length - 1)) * W;
	const yv = (v: number) => H - PAD_Y - ((v - min) / range) * (H - PAD_Y * 2);
	const pts = vals.map((v, i) => [xv(i), yv(v)] as [number, number]);

	const buildPath = (points: [number, number][]): string => {
		const first = points[0];
		if (!first) return "";
		let d = `M ${first[0]},${first[1]}`;
		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const mx = (prev[0] + curr[0]) / 2;
			d += ` C ${mx},${prev[1]} ${mx},${curr[1]} ${curr[0]},${curr[1]}`;
		}
		return d;
	};

	const color = isUp ? "#fb7185" : isDown ? "#34d399" : "#8294ff";
	const lineD = buildPath(pts);
	const lastPt = pts[pts.length - 1];
	const firstPt = pts[0];
	if (!lastPt || !firstPt) return null;

	const areaD = `${lineD} L ${lastPt[0]},${H} L ${firstPt[0]},${H} Z`;
	const midY = (H / 2).toFixed(1);

	const svg = html`<svg
		viewBox="0 0 ${W} ${H}"
		preserveAspectRatio="none"
		style="width:100%;height:${H}px;display:block;cursor:crosshair"
		xmlns="http://www.w3.org/2000/svg"
	>
		<defs>
			<linearGradient id="spark-g" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="${color}" stop-opacity="0.26" />
				<stop offset="100%" stop-color="${color}" stop-opacity="0" />
			</linearGradient>
		</defs>
		<line
			x1="0"
			y1="${PAD_Y}"
			x2="${W}"
			y2="${PAD_Y}"
			stroke="rgba(255,255,255,0.05)"
			stroke-dasharray="3 4"
			vector-effect="non-scaling-stroke"
		/>
		<line
			x1="0"
			y1="${midY}"
			x2="${W}"
			y2="${midY}"
			stroke="rgba(255,255,255,0.05)"
			stroke-dasharray="3 4"
			vector-effect="non-scaling-stroke"
		/>
		<path
			d="${areaD}"
			fill="url(#spark-g)"
			vector-effect="non-scaling-stroke"
		/>
		<path
			d="${lineD}"
			fill="none"
			stroke="${color}"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
		<circle
			cx="${lastPt[0]}"
			cy="${lastPt[1]}"
			r="7"
			fill="${color}"
			opacity="0.22"
		/>
		<circle
			cx="${lastPt[0]}"
			cy="${lastPt[1]}"
			r="3.5"
			fill="${color}"
			stroke="#0c0e13"
			stroke-width="1.5"
		/>
	</svg>` as unknown as SVGElement;

	svg.onmousemove = (evt: MouseEvent) => {
		const svgW = (svg as SVGSVGElement).clientWidth;
		const normX = evt.offsetX / svgW;
		const idx = Math.max(
			0,
			Math.min(data.length - 1, Math.round(normX * (data.length - 1))),
		);
		const p = data[idx];
		if (!p) return;

		ui.tipEl.replaceChildren(
			frag`<span style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">${dfmt(p.week)}</span><strong class="font-mono-num">₼ ${fmt(Number(p.avg_ppsm), 0)}/m²</strong><span style="font-size:10px;color:var(--muted);margin-left:6px">${p.listing_count} ${t(p.listing_count !== 1 ? "listings" : "listing")}</span>`,
		);

		ui.tipEl.style.display = "block";
		const tipW = ui.tipEl.offsetWidth || 160;
		const left = Math.min(evt.offsetX + 12, svgW - tipW - 4);
		ui.tipEl.style.left = `${left}px`;
		ui.tipEl.style.top = `${Math.max(4, evt.offsetY - ui.tipEl.offsetHeight - 8)}px`;
	};

	svg.onmouseleave = () => {
		ui.tipEl.style.display = "none";
	};

	return svg;
}

export function dfmt(s: string): string {
	return new Date(s).toLocaleDateString(getLocale(), {
		day: "numeric",
		month: "short",
	});
}
