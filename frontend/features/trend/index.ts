import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { state as globalState } from "@/core/state";
import { fmt, frag, hide, makeEventManager, show } from "@/core/utils";
import { getPreloadedTrendData } from "@/features/search/preload";
import { fetchTrendData } from "./api";
import { dfmt, renderTrendChart } from "./chart";
import type { TrendState, TrendUI } from "./types";
import { renderTrendUI } from "./ui";

export function initTrend(container: HTMLElement): () => void {
	const ui: TrendUI = {
		panel: null as unknown as HTMLElement,
		locEl: null as unknown as HTMLElement,
		curEl: null as unknown as HTMLElement,
		chgEl: null as unknown as HTMLElement,
		weeksEl: null as unknown as HTMLElement,
		tipEl: null as unknown as HTMLElement,
		chartEl: null as unknown as HTMLElement,
		datesEl: null as unknown as HTMLElement,
	};

	const state: TrendState = {
		cache: {},
		currentSvg: null,
	};

	const { cleanup } = makeEventManager();
	const layout = renderTrendUI(ui);
	globalState.refs.trendPanel = layout;
	container.appendChild(layout);

	function renderTrend(
		location: string,
		data: import("@/core/types").TrendPoint[] | null,
	): void {
		if (!data) {
			hide(ui.panel);
			return;
		}

		const vals = data.map((p) => Number(p.avg_ppsm));
		const last = vals[vals.length - 1] ?? 0;
		const first = vals[0] ?? 1;
		const changePct = ((last - first) / first) * 100;
		const up = changePct > 2;
		const dn = changePct < -2;

		ui.locEl.textContent = location;
		ui.curEl.textContent = `₼ ${fmt(last, 0)}/m²`;

		const sign = changePct >= 0 ? "+" : "";
		ui.chgEl.textContent = `${sign}${changePct.toFixed(1)}% vs ${data.length}${t("unitWeek")} ${t("ago")}`;
		ui.chgEl.style.color = up
			? "var(--red)"
			: dn
				? "var(--green)"
				: "var(--muted)";
		ui.chgEl.style.background = up
			? "var(--red-dim)"
			: dn
				? "var(--green-dim)"
				: "var(--surface-3)";
		ui.chgEl.style.borderColor = up
			? "var(--red-b)"
			: dn
				? "var(--green-b)"
				: "var(--border)";

		ui.weeksEl.textContent = t(
			data.length !== 1 ? "weeksOfData" : "weekOfData",
			{ n: data.length },
		);

		ui.datesEl.replaceChildren(
			frag`<span>${dfmt(data[0]?.week ?? "")}</span><span>${dfmt(data[data.length - 1]?.week ?? "")}</span>`,
		);

		show(ui.panel);

		if (state.currentSvg) state.currentSvg.remove();
		state.currentSvg = renderTrendChart(ui, data, up, dn);
		if (state.currentSvg) ui.chartEl.insertBefore(state.currentSvg, ui.tipEl);
	}

	async function updateTrend(location: string): Promise<void> {
		if (!location || location === "__all__") {
			hide(ui.panel);
			return;
		}

		const preloaded = getPreloadedTrendData(location);
		if (preloaded !== undefined) {
			if (preloaded) state.cache[location] = { data: preloaded, at: Date.now() };
			renderTrend(location, preloaded);
			return;
		}

		const data = await fetchTrendData(location, state);
		renderTrend(location, data);
	}

	// Render preloaded trend synchronously before initial paint if URL has a single location
	const initialLoc = new URLSearchParams(window.location.search).get("location");
	if (initialLoc && initialLoc !== "__all__" && !initialLoc.includes(",")) {
		const preloaded = getPreloadedTrendData(initialLoc);
		if (preloaded) {
			state.cache[initialLoc] = { data: preloaded, at: Date.now() };
			renderTrend(initialLoc, preloaded);
		}
	}

	const offLoc = bus.on(EVENTS.LOCATION_CHANGED, (loc) => {
		void updateTrend(loc);
	});

	return () => {
		offLoc();
		cleanup();
	};
}
