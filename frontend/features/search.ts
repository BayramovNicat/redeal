import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import { state } from "../core/state";
import type { Property } from "../core/types";
import { frag, ge, hide, show, toast } from "../core/utils";
import { Chip, CloseableChip } from "../ui/chip";
import { Field } from "../ui/field";
import { Icons } from "../ui/icons";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { MultiSelect, type MultiSelectElement } from "../ui/multi-select";
import { Range, setRangeProgress } from "../ui/range";
import { Select } from "../ui/select";

const NUM_FILTERS = () => [
	{
		id: "minPrice",
		label: t("minPrice"),
		placeholder: "30 000",
		chipLabel: t("chipMinPrice"),
	},
	{
		id: "maxPrice",
		label: t("maxPrice"),
		placeholder: "150 000",
		chipLabel: t("chipMaxPrice"),
	},
	{
		id: "minPriceSqm",
		label: t("minPriceSqm"),
		placeholder: "500",
		chipLabel: t("chipMinPriceSqm"),
	},
	{
		id: "maxPriceSqm",
		label: t("maxPriceSqm"),
		placeholder: "2000",
		chipLabel: t("chipMaxPriceSqm"),
	},
	{
		id: "minArea",
		label: t("minArea"),
		placeholder: "40",
		chipLabel: t("chipMinArea"),
	},
	{
		id: "maxArea",
		label: t("maxArea"),
		placeholder: "120",
		chipLabel: t("chipMaxArea"),
	},
	{
		id: "minRooms",
		label: t("minRooms"),
		placeholder: "2",
		chipLabel: t("chipMinRooms"),
	},
	{
		id: "maxRooms",
		label: t("maxRooms"),
		placeholder: "4",
		chipLabel: t("chipMaxRooms"),
	},
	{
		id: "minFloor",
		label: t("minFloor"),
		placeholder: "2",
		chipLabel: t("chipMinFloor"),
	},
	{
		id: "maxFloor",
		label: t("maxFloor"),
		placeholder: "15",
		chipLabel: t("chipMaxFloor"),
	},
	{
		id: "minTotalFloors",
		label: t("minTotalFloors"),
		placeholder: "2",
		chipLabel: t("chipMinTotalFloors"),
	},
	{
		id: "maxTotalFloors",
		label: t("maxTotalFloors"),
		placeholder: "5",
		chipLabel: t("chipMaxTotalFloors"),
	},
];

const CHECK_FILTERS = () => [
	{ id: "hasRepair", label: t("hasRepair") },
	{ id: "hasDocument", label: t("hasDocument") },
	{ id: "hasMortgage", label: t("hasMortgage") },
	{ id: "isUrgent", label: t("isUrgent") },
	{ id: "notLastFloor", label: t("notLastFloor") },
];

export function initSearch(container: HTMLElement): () => void {
	const v = (id: string) => (ge(id) as HTMLInputElement).value.trim();
	const cb = (id: string) => (ge(id) as HTMLInputElement).checked;

	function updateChips(): void {
		const row = ge("chips-row");
		const chips: HTMLElement[] = [];

		for (const f of CHECK_FILTERS()) {
			if (cb(f.id)) {
				chips.push(
					CloseableChip({
						label: f.label,
						onClose: () => {
							(ge(f.id) as HTMLInputElement).checked = false;
							updateChips();
						},
					}),
				);
			}
		}

		for (const f of NUM_FILTERS()) {
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
					label: `${t("chipCategory")}: ${cat}`,
					onClose: () => {
						(ge("category") as HTMLSelectElement).value = "";
						updateChips();
					},
				}),
			);
		}

		const am = (ge("hasActiveMortgage") as HTMLSelectElement).value;
		if (am) {
			chips.push(
				CloseableChip({
					label: `${t("chipActiveMortgage")}: ${am === "true" ? t("yes") : t("no")}`,
					onClose: () => {
						(ge("hasActiveMortgage") as HTMLSelectElement).value = "";
						updateChips();
					},
				}),
			);
		}

		const desc = (ge("descriptionSearch") as HTMLInputElement).value.trim();
		if (desc) {
			chips.push(
				CloseableChip({
					label: `${t("chipDescSearch")}: ${desc}`,
					onClose: () => {
						(ge("descriptionSearch") as HTMLInputElement).value = "";
						updateChips();
					},
				}),
			);
		}

		const locs = (ge("loc") as MultiSelectElement).getValue() as string[];
		if (locs.length > 0 && !locs.includes("__all__")) {
			for (const l of locs) {
				chips.push(
					CloseableChip({
						label: l,
						onClose: () => {
							const el = ge("loc") as MultiSelectElement;
							const current = el.getValue();
							el.setValue(current.filter((v: string) => v !== l));
							updateChips();
							void doSearch(false);
						},
					}),
				);
			}
		}

		row.replaceChildren();

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
		const locs = (ge("loc") as MultiSelectElement).getValue();
		if (locs.length === 0) {
			(ge("loc-trigger") as HTMLButtonElement).focus();
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
			ge("cards").replaceChildren();

			show("s-loading");
		}
		(ge("search-btn") as HTMLButtonElement).disabled = true;

		try {
			const p = new URLSearchParams({
				location: locs.join(","),
				threshold: thresh,
				limit: String(state.PAGE),
				offset: String(state.currentOffset),
			});

			for (const f of NUM_FILTERS()) {
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

			const am = (ge("hasActiveMortgage") as HTMLSelectElement).value;
			if (am) p.set("hasActiveMortgage", am);

			const desc = v("descriptionSearch");
			if (desc) p.set("descriptionSearch", desc);

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

			if (!more && locs.length === 1 && locs[0] !== "__all__") {
				bus.emit(EVENTS.LOCATION_CHANGED, locs[0]);
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
	const root = frag`
		<div class="bg-(--surface) border border-(--border) rounded-(--r-lg) p-5 mb-3.5">
			<div class="grid grid-cols-[1fr_260px_120px] gap-3 items-end max-[680px]:grid-cols-1">
				${Field({
					htmlFor: "loc-trigger",
					label: t("location"),
					input: MultiSelect({
						id: "loc",
						options: [],
						placeholder: t("chooseLocs"),
						className: "w-full",
						onChange: () => {
							updateChips();
							void doSearch(false);
						},
					}),
				})}
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between">
						${Label({ htmlFor: "thresh", text: t("discountThreshold") })}
						<span id="tval" class="text-xs font-bold text-(--accent) bg-(--accent-dim) px-2 py-0.5 rounded-full tracking-[0.02em]">10%</span>
					</div>
					${Range({ id: "thresh", min: 1, max: 50, value: 10, ariaLabel: t("discountThreshold") })}
				</div>
				<div class="flex flex-col gap-1.5">
					<span class="text-xs font-medium text-(--muted) tracking-[0.06em] uppercase invisible" aria-hidden="true">Go</span>
					<button type="button" id="search-btn" class="inline-flex items-center justify-center gap-1.5 bg-(--accent-solid) text-white border-none rounded-(--r) px-4 py-2.25 font-semibold text-sm h-10 transition-all hover:bg-(--accent-h) hover:shadow-[0_4px_12px_rgba(79,70,229,0.3)] active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed">
						${Icons.search()} ${t("search")}
					</button>
				</div>
			</div>

			<button type="button" id="adv-toggle" aria-expanded="false" class="group inline-flex items-center gap-1.25 bg-transparent border border-(--border) rounded-(--r-sm) px-3 py-1.5 text-(--text-2) text-xs font-medium mt-3.5 transition-all hover:border-(--border-h) hover:text-(--text) hover:bg-(--surface-2) aria-expanded:text-(--accent) aria-expanded:border-[rgba(99,102,241,0.4)] aria-expanded:bg-(--accent-dim)">
				${Icons.chevron(12, "transition-transform duration-200 group-aria-expanded:rotate-180")}
				${t("advancedFilters")}
				<span id="adv-cnt" class="bg-(--accent-solid) text-white rounded-full px-1.5 py-px text-xs font-semibold" style="display:none"></span>
			</button>

			<div id="adv-panel" class="overflow-hidden max-h-0 opacity-0 transition-all ease-in-out duration-300 [&.open]:max-h-150 [&.open]:opacity-100">
				<div class="grid grid-cols-4 gap-2.5 pt-4 border-t border-(--border) mt-3.5 max-[680px]:grid-cols-2">
					${NUM_FILTERS().map((f) =>
						Field({
							htmlFor: f.id,
							label: f.label,
							input: Input({
								id: f.id,
								type: "number",
								placeholder: f.placeholder,
								className: "w-full",
							}),
						}),
					)}
					${Field({
						htmlFor: "category",
						label: t("category"),
						input: Select({
							id: "category",
							className: "w-full",
							options: [
								{ value: "", label: t("any") },
								{ value: "Yeni tikili", label: t("newBuild") },
								{ value: "Köhnə tikili", label: t("secondary") },
							],
						}),
					})}
					${Field({
						htmlFor: "hasActiveMortgage",
						label: t("activeMortgage"),
						input: Select({
							id: "hasActiveMortgage",
							className: "w-full",
							options: [
								{ value: "", label: t("any") },
								{ value: "false", label: t("no") },
								{ value: "true", label: t("yes") },
							],
						}),
					})}
					${Field({
						htmlFor: "descriptionSearch",
						label: t("descriptionSearch"),
						input: Input({
							id: "descriptionSearch",
							type: "text",
							placeholder: t("descriptionSearchPlaceholder"),
							className: "w-full",
						}),
					})}
				</div>
				<div class="flex flex-wrap gap-1.75 pt-3.5">
					${CHECK_FILTERS().map((f) => Chip({ id: f.id, label: f.label }))}
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
	for (const f of NUM_FILTERS()) {
		const val = params.get(f.id);
		if (val) (ge(f.id) as HTMLInputElement).value = val;
	}
	const catVal = params.get("category");
	if (catVal) (ge("category") as HTMLSelectElement).value = catVal;
	const amVal = params.get("hasActiveMortgage");
	if (amVal) (ge("hasActiveMortgage") as HTMLSelectElement).value = amVal;
	const descVal = params.get("descriptionSearch");
	if (descVal) (ge("descriptionSearch") as HTMLInputElement).value = descVal;
	for (const f of CHECK_FILTERS()) {
		if (params.get(f.id) === "true") {
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
	add(ge("hasActiveMortgage"), "change", updateChips);
	add(ge("descriptionSearch"), "input", updateChips);
	for (const f of CHECK_FILTERS()) {
		add(ge(f.id), "change", updateChips);
	}
	for (const f of NUM_FILTERS()) add(ge(f.id), "input", updateChips);
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
		const el = ge("loc") as MultiSelectElement;
		try {
			const r = await fetch("/api/deals/locations");
			const d = (await r.json()) as { data: string[] };
			const options = [
				{ value: "__all__", label: t("allLocations") },
				...d.data.map((l) => ({ value: l, label: l })),
			];
			el.setOptions(options);

			const locParam = params.get("location");
			if (locParam) {
				const vals = locParam.split(",").filter(Boolean);
				el.setValue(vals);
				void doSearch(false);
			}
		} catch {
			el.setOptions([{ value: "", label: t("failedLocs") }]);
		}
	})();

	return () => {
		handlers.forEach(([el, ev, fn]) => {
			el.removeEventListener(ev, fn);
		});
		offSearch();
	};
}
