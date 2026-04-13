import { state } from "../core/state";
import type { Property } from "../core/types";
import { ge, hide, html, show, toast } from "../core/utils";
import { render } from "../ui/render";
import { fetchTrend } from "./trend";

function createChip(label: string, onClick: string): HTMLElement {
	return html`<span
    class="inline-flex items-center gap-1 bg-(--surface) border border-(--border) rounded-full pt-0.75 pb-0.75 pr-1.5 pl-2.5 text-[11px] text-(--text-2)"
  >
    ${label}
    <button
      type="button"
      class="bg-none border-none text-(--muted) flex items-center transition-[color] duration-100 px-0.5 hover:text-(--text)"
      onclick="${onClick}"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </span>`;
}

export function updateChips(): void {
	const row = ge("chips-row");
	const chips: HTMLElement[] = [];

	const checks: [string, string][] = [
		["hasRepair", "Repaired"],
		["hasDocument", "Has document"],
		["hasMortgage", "Mortgage"],
		["isUrgent", "Urgent only"],
		["notLastFloor", "Not last floor"],
		["noActiveMortgage", "No active mortgage"],
		["hasActiveMortgage", "Active mortgage only"],
	];
	for (const [id, lbl] of checks) {
		if ((ge(id) as HTMLInputElement).checked) {
			chips.push(
				createChip(
					lbl,
					`document.getElementById('${id}').checked=false;window.__updateChips()`,
				),
			);
		}
	}

	const nums: [string, string][] = [
		["minPrice", "Min ₼"],
		["maxPrice", "Max ₼"],
		["minPriceSqm", "Min ₼/m²"],
		["maxPriceSqm", "Max ₼/m²"],
		["minArea", "Min m²"],
		["maxArea", "Max m²"],
		["minRooms", "Min rooms"],
		["maxRooms", "Max rooms"],
		["minFloor", "Min flr"],
		["maxFloor", "Max flr"],
		["minTotalFloors", "Min bldg flr"],
		["maxTotalFloors", "Max bldg flr"],
	];
	for (const [id, lbl] of nums) {
		const v = (ge(id) as HTMLInputElement).value;
		if (v) {
			chips.push(
				createChip(
					`${lbl}: ${v}`,
					`document.getElementById('${id}').value='';window.__updateChips()`,
				),
			);
		}
	}

	const cat = (ge("category") as HTMLSelectElement).value;
	if (cat) {
		chips.push(
			createChip(
				`Category: ${cat}`,
				"document.getElementById('category').value='';window.__updateChips()",
			),
		);
	}
	row.innerHTML = "";
	row.append(...chips);
	row.style.display = chips.length ? "flex" : "none";
	const cnt = ge("adv-cnt");
	if (chips.length) {
		cnt.textContent = String(chips.length);
		cnt.style.display = "inline-block";
	} else {
		cnt.style.display = "none";
	}
}

function v(id: string): string {
	return (ge(id) as HTMLInputElement).value.trim();
}
function cb(id: string): boolean {
	return (ge(id) as HTMLInputElement).checked;
}

export async function doSearch(more = false): Promise<void> {
	const loc = (ge("loc") as HTMLSelectElement).value;
	if (!loc) {
		ge("loc").focus();
		return;
	}
	const thresh = (ge("thresh") as HTMLInputElement).value;

	if (!more) {
		state.allResults = [];
		state.savedOnlyResults = [];
		state.currentOffset = 0;
		state.currentTotal = 0;
		state.showingSaved = false;
		state.renderedSet.clear();
		ge("saved-btn").classList.remove("on");
		hide("s-welcome");
		hide("s-empty");
		hide("results-bar");
		hide("load-more");
		hide("trend-panel");
		ge("cards").innerHTML = "";
		show("s-loading");
	}
	(ge("search-btn") as HTMLButtonElement).disabled = true;

	try {
		const p = new URLSearchParams({
			location: loc,
			threshold: thresh,
			limit: String(state.PAGE),
			offset: String(state.currentOffset),
		});

		const setParam = (k: string, id: string) => {
			const val = v(id);
			if (val) p.set(k, val);
		};
		setParam("minPrice", "minPrice");
		setParam("maxPrice", "maxPrice");
		setParam("minPriceSqm", "minPriceSqm");
		setParam("maxPriceSqm", "maxPriceSqm");
		setParam("minArea", "minArea");
		setParam("maxArea", "maxArea");
		setParam("minRooms", "minRooms");
		setParam("maxRooms", "maxRooms");
		setParam("minFloor", "minFloor");
		setParam("maxFloor", "maxFloor");
		setParam("minTotalFloors", "minTotalFloors");
		setParam("maxTotalFloors", "maxTotalFloors");
		setParam("category", "category");
		if (cb("hasRepair")) p.set("hasRepair", "true");
		if (cb("hasDocument")) p.set("hasDocument", "true");
		if (cb("hasMortgage")) p.set("hasMortgage", "true");
		if (cb("isUrgent")) p.set("isUrgent", "true");
		if (cb("notLastFloor")) p.set("notLastFloor", "true");
		if (cb("noActiveMortgage")) p.set("hasActiveMortgage", "false");
		else if (cb("hasActiveMortgage")) p.set("hasActiveMortgage", "true");

		const res = await fetch(`/api/deals/undervalued?${p}`);
		const d = (await res.json()) as {
			error?: string;
			data: Property[];
			total: number;
		};
		hide("s-loading");

		if (d.error) {
			toast(d.error, true);
			return;
		}

		state.allResults = [...state.allResults, ...d.data];
		state.currentTotal = d.total;
		state.currentOffset += d.data.length;

		if (!more) updateChips();

		const urlParams = new URLSearchParams(p);
		urlParams.delete("limit");
		urlParams.delete("offset");
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}?${urlParams.toString()}`,
		);

		if (!more && loc !== "__all__") void fetchTrend(loc);

		if (!state.allResults.length) {
			show("s-empty");
			hide("results-bar");
		} else {
			render();
		}
	} catch (e) {
		hide("s-loading");
		toast((e as Error).message, true);
	} finally {
		(ge("search-btn") as HTMLButtonElement).disabled = false;
	}
}
