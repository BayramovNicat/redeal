import { bus, EVENTS } from "../core/events";
import { state } from "../core/state";
import type { Property } from "../core/types";
import { ge, hide, html, show, toast } from "../core/utils";
import { Chip, CloseableChip } from "../ui/chip";
import { Icons } from "../ui/icons";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Range, setRangeProgress } from "../ui/range";
import { Select } from "../ui/select";

const NUM_FILTERS = [
	{
		id: "minPrice",
		label: "Min price (₼)",
		placeholder: "30 000",
		chipLabel: "Min ₼",
	},
	{
		id: "maxPrice",
		label: "Max price (₼)",
		placeholder: "150 000",
		chipLabel: "Max ₼",
	},
	{
		id: "minPriceSqm",
		label: "Min ₼/m²",
		placeholder: "500",
		chipLabel: "Min ₼/m²",
	},
	{
		id: "maxPriceSqm",
		label: "Max ₼/m²",
		placeholder: "2000",
		chipLabel: "Max ₼/m²",
	},
	{
		id: "minArea",
		label: "Min area (m²)",
		placeholder: "40",
		chipLabel: "Min m²",
	},
	{
		id: "maxArea",
		label: "Max area (m²)",
		placeholder: "120",
		chipLabel: "Max m²",
	},
	{
		id: "minRooms",
		label: "Min rooms",
		placeholder: "2",
		chipLabel: "Min rooms",
	},
	{
		id: "maxRooms",
		label: "Max rooms",
		placeholder: "4",
		chipLabel: "Max rooms",
	},
	{
		id: "minFloor",
		label: "Min floor",
		placeholder: "2",
		chipLabel: "Min flr",
	},
	{
		id: "maxFloor",
		label: "Max floor",
		placeholder: "15",
		chipLabel: "Max flr",
	},
	{
		id: "minTotalFloors",
		label: "Min building floors",
		placeholder: "2",
		chipLabel: "Min bldg flr",
	},
	{
		id: "maxTotalFloors",
		label: "Max building floors",
		placeholder: "5",
		chipLabel: "Max bldg flr",
	},
];

const CHECK_FILTERS = [
	{ id: "hasRepair", label: "Repaired" },
	{ id: "hasDocument", label: "Has document" },
	{ id: "hasMortgage", label: "Mortgage eligible" },
	{ id: "isUrgent", label: "Urgent only" },
	{ id: "notLastFloor", label: "Not last floor" },
	{ id: "noActiveMortgage", label: "No active mortgage" },
	{ id: "hasActiveMortgage", label: "Active mortgage only" },
];

export function initSearch(container: HTMLElement): () => void {
	const v = (id: string) => (ge(id) as HTMLInputElement).value.trim();
	const cb = (id: string) => (ge(id) as HTMLInputElement).checked;

	function updateChips(): void {
		const row = ge("chips-row");
		const chips: HTMLElement[] = [];

		for (const f of CHECK_FILTERS) {
			if (cb(f.id)) {
				chips.push(
					CloseableChip({
						label: f.label,
						onClose: () => {
							(ge(f.id) as HTMLInputElement).checked = false;
							if (f.id === "noActiveMortgage" || f.id === "hasActiveMortgage") {
								// Reset the paired filter if needed, though they already have change listeners
							}
							updateChips();
						},
					}),
				);
			}
		}

		for (const f of NUM_FILTERS) {
			const val = v(f.id);
			if (val) {
				chips.push(
					CloseableChip({
						label: `${f.chipLabel}: ${val}`,
						onClose: () => {
							(ge(f.id) as HTMLInputElement).value = "";
							updateChips();
						},
					}),
				);
			}
		}

		const cat = (ge("category") as HTMLSelectElement).value;
		if (cat) {
			chips.push(
				CloseableChip({
					label: `Category: ${cat}`,
					onClose: () => {
						(ge("category") as HTMLSelectElement).value = "";
						updateChips();
					},
				}),
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

	async function doSearch(more = false): Promise<void> {
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
			ge("saved-btn")?.classList.remove("on");
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

			for (const f of NUM_FILTERS) {
				const val = v(f.id);
				if (val) p.set(f.id, val);
			}
			const cat = v("category");
			if (cat) p.set("category", cat);
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

			if (!more && loc !== "__all__") {
				bus.emit(EVENTS.LOCATION_CHANGED, loc);
			}

			if (!state.allResults.length) {
				show("s-empty");
				hide("results-bar");
			} else {
				bus.emit(EVENTS.DEALS_UPDATED);
			}
		} catch (e) {
			hide("s-loading");
			toast((e as Error).message, true);
		} finally {
			(ge("search-btn") as HTMLButtonElement).disabled = false;
		}
	}

	// 1. Render Structure
	const root = html`
		<div class="bg-(--surface) border border-(--border) rounded-(--r-lg) p-5 mb-3.5">
			<div class="grid grid-cols-[1fr_260px_120px] gap-3 items-end max-[680px]:grid-cols-1">
				<div class="flex flex-col gap-1.5">
					${Label({ htmlFor: "loc", text: "Location" })}
					${Select({ id: "loc", options: [{ value: "", label: "Loading locations..." }], className: "w-full" })}
				</div>
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between">
						${Label({ htmlFor: "thresh", text: "Discount threshold" })}
						<span id="tval" class="text-xs font-bold text-(--accent) bg-(--accent-dim) px-2 py-0.5 rounded-full tracking-[0.02em]">10%</span>
					</div>
					${Range({ id: "thresh", min: 1, max: 50, value: 10 })}
				</div>
				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-medium text-(--muted) tracking-[0.06em] uppercase invisible" aria-hidden="true">Go</span>
					<button type="button" id="search-btn" class="inline-flex items-center justify-center gap-1.5 bg-(--text) text-(--bg) border-none rounded-(--r) px-4 py-2.25 font-semibold text-sm h-10 transition-all hover:bg-[#d0d0e0] active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed">
						${Icons.search()} Search
					</button>
				</div>
			</div>

			<button type="button" id="adv-toggle" aria-expanded="false" class="group inline-flex items-center gap-1.25 bg-transparent border border-(--border) rounded-(--r-sm) px-3 py-1.5 text-(--text-2) text-xs font-medium mt-3.5 transition-all hover:border-(--border-h) hover:text-(--text) hover:bg-(--surface-2) aria-expanded:text-(--accent) aria-expanded:border-[rgba(99,102,241,0.4)] aria-expanded:bg-(--accent-dim)">
				${Icons.chevron(12, "transition-transform duration-200 group-aria-expanded:rotate-180")}
				Advanced filters
				<span id="adv-cnt" class="bg-(--accent) text-white rounded-full px-1.5 py-px text-xs font-semibold" style="display:none"></span>
			</button>

			<div id="adv-panel" class="overflow-hidden max-h-0 opacity-0 transition-all ease-in-out duration-300 [&.open]:max-h-150 [&.open]:opacity-100">
				<div class="grid grid-cols-4 gap-2.5 pt-4 border-t border-(--border) mt-3.5 max-[680px]:grid-cols-2">
					${NUM_FILTERS.map(
						(f) => html`
						<div class="flex flex-col gap-1.5">
							${Label({ htmlFor: f.id, text: f.label })}
							${Input({ id: f.id, type: "number", placeholder: f.placeholder, className: "w-full" })}
						</div>
					`,
					)}
					<div class="flex flex-col gap-1.5">
						${Label({ htmlFor: "category", text: "Category" })}
						${Select({
							id: "category",
							className: "w-full",
							options: [
								{ value: "", label: "Any" },
								{ value: "Yeni tikili", label: "New build" },
								{ value: "Köhnə tikili", label: "Secondary" },
							],
						})}
					</div>
				</div>
				<div class="flex flex-wrap gap-1.75 pt-3.5">
					${CHECK_FILTERS.map((f) => Chip({ id: f.id, label: f.label }))}
				</div>
			</div>
		</div>
		<div id="chips-row" class="flex flex-wrap gap-1.5 mb-3.5" style="display:none"></div>
	`;
	container.appendChild(root);

	// 2. State & Restoration
	const params = new URLSearchParams(window.location.search);
	const threshVal = params.get("threshold");
	if (threshVal) {
		(ge("thresh") as HTMLInputElement).value = threshVal;
		ge("tval").textContent = `${threshVal}%`;
		setRangeProgress(ge("thresh") as HTMLInputElement);
	}
	for (const f of NUM_FILTERS) {
		const val = params.get(f.id);
		if (val) (ge(f.id) as HTMLInputElement).value = val;
	}
	const catVal = params.get("category");
	if (catVal) (ge("category") as HTMLSelectElement).value = catVal;
	for (const f of CHECK_FILTERS) {
		if (
			params.get(f.id) === "true" ||
			(f.id === "noActiveMortgage" &&
				params.get("hasActiveMortgage") === "false")
		) {
			(ge(f.id) as HTMLInputElement).checked = true;
		} else if (
			f.id === "hasActiveMortgage" &&
			params.get("hasActiveMortgage") === "true"
		) {
			(ge(f.id) as HTMLInputElement).checked = true;
		}
	}

	// 3. Events
	const handlers: [HTMLElement | Document, string, EventListener][] = [];
	const add = <T extends Event>(
		el: HTMLElement | Document,
		ev: string,
		fn: (e: T) => void,
	) => {
		const listener = fn as EventListener;
		el.addEventListener(ev, listener);
		handlers.push([el, ev, listener]);
	};

	add(ge("search-btn"), "click", () => void doSearch(false));
	add(ge("thresh"), "input", (e) => {
		ge("tval").textContent = `${(e.target as HTMLInputElement).value}%`;
	});
	add(ge("adv-toggle"), "click", () => {
		const panel = ge("adv-panel");
		const open = panel.classList.toggle("open");
		ge("adv-toggle").setAttribute("aria-expanded", String(open));
	});

	// Bus listener for infinite scroll
	const offSearch = bus.on(EVENTS.SEARCH_STARTED, (data) => {
		void doSearch(data?.more ?? false);
	});

	// Filter change listeners
	add(ge("noActiveMortgage"), "change", () => {
		if ((ge("noActiveMortgage") as HTMLInputElement).checked)
			(ge("hasActiveMortgage") as HTMLInputElement).checked = false;
		updateChips();
	});
	add(ge("hasActiveMortgage"), "change", () => {
		if ((ge("hasActiveMortgage") as HTMLInputElement).checked)
			(ge("noActiveMortgage") as HTMLInputElement).checked = false;
		updateChips();
	});
	for (const f of CHECK_FILTERS) {
		if (f.id !== "noActiveMortgage" && f.id !== "hasActiveMortgage")
			add(ge(f.id), "change", updateChips);
	}
	for (const f of NUM_FILTERS) add(ge(f.id), "input", updateChips);
	add(ge("category"), "input", updateChips);

	add(document, "keydown", (e: KeyboardEvent) => {
		if (
			e.key === "Enter" &&
			!["BUTTON", "A", "SELECT"].includes((e.target as Element).tagName)
		)
			void doSearch(false);
	});

	// 4. Initial chips
	updateChips();

	// 5. Load Locations
	(async () => {
		const sel = ge("loc") as HTMLSelectElement;
		try {
			const r = await fetch("/api/deals/locations");
			const d = (await r.json()) as { data: string[] };
			sel.innerHTML = '<option value="__all__">All locations</option>';
			for (const loc of d.data) {
				const o = document.createElement("option");
				o.value = o.textContent = loc;
				sel.appendChild(o);
			}
			const loc = params.get("location");
			if (loc) {
				sel.value = loc;
				void doSearch(false);
			}
		} catch {
			sel.innerHTML =
				'<option value="" disabled selected>Failed to load</option>';
		}
	})();

	return () => {
		handlers.forEach(([el, ev, fn]) => {
			el.removeEventListener(ev, fn);
		});
		offSearch();
	};
}
