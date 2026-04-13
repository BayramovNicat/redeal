import { state } from "./core/state";
import { ge } from "./core/utils";
import { initAlertModal } from "./features/alerts";
import { openDesc, openHeatmap, openMap } from "./features/map";
import { doSearch, updateChips } from "./features/search";
import {
	hideItem,
	render,
	setCardCallbacks,
	setLoadMoreFn,
	toggleBM,
} from "./ui/render";

// Expose updateChips globally so chip close buttons can call it from inline onclick
(window as unknown as Record<string, unknown>).__updateChips = updateChips;

// Wire render's load-more callback (avoids render <-> search circular dep)
setLoadMoreFn(() => void doSearch(true));

// Wire card callbacks (avoids cards depending on render/map directly)
setCardCallbacks({
	onBM: toggleBM,
	onHide: hideItem,
	onDesc: openDesc,
	onMap: openMap,
});

// ── Events ────────────────────────────────────────────────────────────────────
ge("search-btn").addEventListener("click", () => void doSearch(false));

function updateThreshBg(): void {
	const t = ge("thresh") as HTMLInputElement;
	const p =
		((Number(t.value) - Number(t.min)) / (Number(t.max) - Number(t.min))) * 100;
	t.style.setProperty("--p", `${p}%`);
}
ge("thresh").addEventListener("input", (e) => {
	ge("tval").textContent = `${(e.target as HTMLInputElement).value}%`;
	updateThreshBg();
});
updateThreshBg();

ge("sort-sel").addEventListener("change", () => {
	state.renderedSet.clear();
	render();
});

ge("vgrid").addEventListener("click", () => {
	state.currentView = "grid";
	ge("vgrid").classList.add("on");
	ge("vlist").classList.remove("on");
	state.renderedSet.clear();
	render();
});
ge("vlist").addEventListener("click", () => {
	state.currentView = "list";
	ge("vlist").classList.add("on");
	ge("vgrid").classList.remove("on");
	state.renderedSet.clear();
	render();
});

ge("saved-btn").addEventListener("click", async () => {
	state.showingSaved = !state.showingSaved;
	ge("saved-btn").classList.toggle("on", state.showingSaved);
	state.renderedSet.clear();
	if (state.showingSaved && state.bookmarks.size > 0) {
		try {
			const res = await fetch("/api/deals/by-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ urls: [...state.bookmarks] }),
			});
			const json = (await res.json()) as {
				data?: typeof state.savedOnlyResults;
			};
			if (json.data) state.savedOnlyResults = json.data;
		} catch (e) {
			console.error("Failed to fetch saved deals", e);
		}
	} else {
		state.savedOnlyResults = [];
	}
	render();
});

ge("adv-toggle").addEventListener("click", () => {
	const panel = ge("adv-panel");
	const open = panel.classList.toggle("open");
	ge("adv-toggle").setAttribute("aria-expanded", String(open));
});

ge("map-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget)
		(e.currentTarget as HTMLDialogElement).close();
});
ge("desc-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget)
		(e.currentTarget as HTMLDialogElement).close();
});
ge("heatmap-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget)
		(e.currentTarget as HTMLDialogElement).close();
});

ge("heatmap-btn").addEventListener("click", () => {
	openHeatmap((locName) => {
		(ge("loc") as HTMLSelectElement).value = locName;
		void doSearch(false);
	});
});

document.addEventListener("keydown", (e) => {
	if (
		e.key === "Enter" &&
		!["BUTTON", "A", "SELECT"].includes((e.target as Element).tagName)
	)
		void doSearch(false);
	if (e.key === "Escape") {
		(ge("map-modal") as HTMLDialogElement).close();
		(ge("desc-modal") as HTMLDialogElement).close();
		(ge("alert-modal") as HTMLDialogElement).close();
	}
});

ge("noActiveMortgage").addEventListener("change", () => {
	if ((ge("noActiveMortgage") as HTMLInputElement).checked)
		(ge("hasActiveMortgage") as HTMLInputElement).checked = false;
	updateChips();
});
ge("hasActiveMortgage").addEventListener("change", () => {
	if ((ge("hasActiveMortgage") as HTMLInputElement).checked)
		(ge("noActiveMortgage") as HTMLInputElement).checked = false;
	updateChips();
});

for (const id of [
	"hasRepair",
	"hasDocument",
	"hasMortgage",
	"isUrgent",
	"notLastFloor",
]) {
	ge(id).addEventListener("change", updateChips);
}
for (const id of [
	"minPrice",
	"maxPrice",
	"minPriceSqm",
	"maxPriceSqm",
	"minArea",
	"maxArea",
	"minRooms",
	"maxRooms",
	"minFloor",
	"maxFloor",
	"minTotalFloors",
	"maxTotalFloors",
	"category",
]) {
	ge(id).addEventListener("input", updateChips);
}

// ── Alert modal ───────────────────────────────────────────────────────────────
initAlertModal();

// ── Restore filters from URL ──────────────────────────────────────────────────
const initParams = new URLSearchParams(window.location.search);

const threshold = initParams.get("threshold");
if (threshold) {
	(ge("thresh") as HTMLInputElement).value = threshold;
	ge("tval").textContent = `${threshold}%`;
	updateThreshBg();
}

const strFields: [string, string][] = [
	["minPrice", "minPrice"],
	["maxPrice", "maxPrice"],
	["minPriceSqm", "minPriceSqm"],
	["maxPriceSqm", "maxPriceSqm"],
	["minArea", "minArea"],
	["maxArea", "maxArea"],
	["minRooms", "minRooms"],
	["maxRooms", "maxRooms"],
	["minFloor", "minFloor"],
	["maxFloor", "maxFloor"],
	["minTotalFloors", "minTotalFloors"],
	["maxTotalFloors", "maxTotalFloors"],
	["category", "category"],
];
for (const [k, id] of strFields) {
	const val = initParams.get(k);
	if (val) (ge(id) as HTMLInputElement).value = val;
}

for (const [k, id] of [
	["hasRepair", "hasRepair"],
	["hasDocument", "hasDocument"],
	["hasMortgage", "hasMortgage"],
	["isUrgent", "isUrgent"],
	["notLastFloor", "notLastFloor"],
] as [string, string][]) {
	if (initParams.has(k) && initParams.get(k) === "true")
		(ge(id) as HTMLInputElement).checked = true;
}

if (initParams.has("hasActiveMortgage")) {
	if (initParams.get("hasActiveMortgage") === "false")
		(ge("noActiveMortgage") as HTMLInputElement).checked = true;
	else if (initParams.get("hasActiveMortgage") === "true")
		(ge("hasActiveMortgage") as HTMLInputElement).checked = true;
}

updateChips();

// ── Init: load locations & health ─────────────────────────────────────────────
(async () => {
	const sel = ge("loc") as HTMLSelectElement;
	try {
		const r = await fetch("/api/deals/locations");
		const d = (await r.json()) as { data: string[] };
		sel.innerHTML = "";
		const allOpt = document.createElement("option");
		allOpt.value = "__all__";
		allOpt.textContent = "All locations";
		sel.appendChild(allOpt);
		for (const loc of d.data) {
			const o = document.createElement("option");
			o.value = o.textContent = loc;
			sel.appendChild(o);
		}
		const loc = initParams.get("location");
		if (loc) {
			sel.value = loc;
			void doSearch(false);
		}
	} catch {
		sel.innerHTML =
			'<option value="" disabled selected>Failed to load</option>';
	}
})();

(async () => {
	try {
		const r = await fetch("/health");
		const d = (await r.json()) as { properties?: number };
		ge("health-txt").textContent =
			`${(d.properties ?? 0).toLocaleString()} listings`;
	} catch {
		ge("health-txt").textContent = "Down";
	}
})();
