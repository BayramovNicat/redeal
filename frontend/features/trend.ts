import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import type { TrendPoint } from "../core/types";
import { fmt, ge, getLocale, hide, html, show } from "../core/utils";

/**
 * Trend feature manages the property price trend chart above search results.
 */
export function initTrend(container: HTMLElement): () => void {
	container.appendChild(
		html`<div id="trend-panel" class="hidden">
      <div
        class="bg-(--surface) border border-(--border) rounded-(--r) pt-4 px-5 pb-3 mb-4 animate-[fadeUp_0.2s_ease_both]"
      >
        <div class="flex items-start justify-between mb-3.5 gap-3">
          <div>
            <div class="text-xs text-(--muted) mb-1.25 tracking-[0.02em]">
              ${t("avgTrend")} · <span id="trend-loc"></span>
            </div>
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-[20px] font-bold tracking-[-0.5px]" id="trend-cur"></span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full border" id="trend-chg"></span>
            </div>
          </div>
          <div class="text-xs text-(--muted) text-right pt-0.5 whitespace-nowrap" id="trend-weeks"></div>
        </div>
        <div class="relative -mx-0.5" id="trend-chart">
          <div
            class="absolute hidden bg-(--surface-3) border border-(--border-h) rounded-(--r-sm) px-2.75 py-1.75 text-xs pointer-events-none z-10 whitespace-nowrap leading-normal top-0 left-0"
            id="trend-tip"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-(--muted) mt-1.25 px-0.5" id="trend-dates"></div>
      </div>
    </div>`,
	);

	const cache: Record<string, { data: TrendPoint[]; at: number }> = {};

	async function fetchTrend(location: string): Promise<void> {
		const hit = cache[location];
		if (hit && Date.now() - hit.at < 30 * 60_000) {
			show("trend-panel");
			renderTrend(hit.data, location);
			return;
		}
		try {
			const r = await fetch(
				`/api/deals/trend?location=${encodeURIComponent(location)}`,
			);
			const d = (await r.json()) as { data?: TrendPoint[] };
			if (!d.data || d.data.length < 2) {
				hide("trend-panel");
				return;
			}
			cache[location] = { data: d.data, at: Date.now() };
			show("trend-panel");
			renderTrend(d.data, location);
		} catch {
			hide("trend-panel");
		}
	}

	function renderTrend(data: TrendPoint[], location: string): void {
		const vals = data.map((p) => Number(p.avg_ppsm));
		const last = vals[vals.length - 1] ?? 0;
		const first = vals[0] ?? 1;
		const changePct = ((last - first) / first) * 100;
		const up = changePct > 2;
		const dn = changePct < -2;

		ge("trend-loc").textContent = location;
		ge("trend-cur").textContent = `₼ ${fmt(last, 0)}/m²`;

		const chgEl = ge("trend-chg");
		const sign = changePct >= 0 ? "+" : "";
		chgEl.textContent = `${sign}${changePct.toFixed(1)}% vs ${data.length}${t("unitWeek")} ${t("ago")}`;
		chgEl.style.color = up
			? "var(--red)"
			: dn
				? "var(--green)"
				: "var(--muted)";
		chgEl.style.background = up
			? "var(--red-dim)"
			: dn
				? "var(--green-dim)"
				: "var(--surface-3)";
		chgEl.style.borderColor = up
			? "var(--red-b)"
			: dn
				? "var(--green-b)"
				: "var(--border)";
		ge("trend-weeks").textContent = t(
			data.length !== 1 ? "weeksOfData" : "weekOfData",
			{ n: data.length },
		);

		ge("trend-dates").innerHTML =
			`<span>${dfmt(data[0]?.week ?? "")}</span><span>${dfmt(data[data.length - 1]?.week ?? "")}</span>`;

		const ct = ge("trend-chart");
		const tip = ge("trend-tip");
		const old = ct.querySelector("svg");
		if (old) old.remove();

		const W = ct.clientWidth || 600,
			H = 68,
			PAD = 6;
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min || 1;
		const xv = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
		const yv = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
		const pts = vals.map((v, i) => [xv(i), yv(v)] as [number, number]);

		function buildPath(points: [number, number][]): string {
			const first = points[0];
			if (!first) return "";
			let d = `M ${first[0]},${first[1]}`;
			for (let i = 1; i < points.length; i++) {
				const prev = points[i - 1];
				const curr = points[i];
				if (!prev || !curr) continue;
				const mx = (prev[0] + curr[0]) / 2;
				d += ` C ${mx},${prev[1]} ${mx},${curr[1]} ${curr[0]},${curr[1]}`;
			}
			return d;
		}

		const color = up ? "#ef4444" : dn ? "#22c55e" : "#6366f1";
		const lineD = buildPath(pts);
		const lastPt = pts[pts.length - 1];
		const firstPt = pts[0];
		if (!lastPt || !firstPt) return;

		const areaD = `${lineD} L ${lastPt[0]},${H} L ${firstPt[0]},${H} Z`;
		const lp = lastPt;

		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
		svg.style.cssText = `width:100%;height:${H}px;display:block;cursor:crosshair`;
		svg.innerHTML = `
			<defs>
				<linearGradient id="spark-g" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
					<stop offset="100%" stop-color="${color}" stop-opacity="0"/>
				</linearGradient>
			</defs>
			<path d="${areaD}" fill="url(#spark-g)" vector-effect="non-scaling-stroke"/>
			<path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
			<circle cx="${lp[0]}" cy="${lp[1]}" r="6" fill="${color}" opacity="0.2"/>
			<circle cx="${lp[0]}" cy="${lp[1]}" r="3.5" fill="${color}"/>`;
		ct.insertBefore(svg, tip);

		svg.addEventListener("mousemove", (e: MouseEvent) => {
			const svgW = svg.clientWidth;
			const normX = e.offsetX / svgW;
			const idx = Math.max(
				0,
				Math.min(data.length - 1, Math.round(normX * (data.length - 1))),
			);
			const p = data[idx];
			if (!p) return;
			tip.innerHTML = `<span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">${dfmt(p.week)}</span><strong>₼ ${fmt(Number(p.avg_ppsm), 0)}/m²</strong><span style="font-size:10px;color:var(--muted);margin-left:5px">${p.listing_count} ${t(p.listing_count !== 1 ? "listings" : "listing")}</span>`;
			tip.style.display = "block";
			const tipW = tip.offsetWidth || 160;
			const left = Math.min(e.offsetX + 12, svgW - tipW - 4);
			tip.style.left = `${left}px`;
			tip.style.top = `${Math.max(4, e.offsetY - tip.offsetHeight - 8)}px`;
		});
		svg.addEventListener("mouseleave", () => {
			tip.style.display = "none";
		});
	}

	function dfmt(s: string): string {
		return new Date(s).toLocaleDateString(getLocale(), {
			day: "numeric",
			month: "short",
		});
	}

	const offLoc = bus.on(EVENTS.LOCATION_CHANGED, (loc) => {
		void fetchTrend(loc);
	});

	return () => {
		offLoc();
	};
}
