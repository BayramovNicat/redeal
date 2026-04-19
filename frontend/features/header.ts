import { bus, EVENTS } from "../core/events";
import { getLang, setLang, t } from "../core/i18n";
import { ge, html } from "../core/utils";
import { openHeatmap } from "../dialogs/heatmap";
import { Button } from "../ui/button";
import { HealthStatus } from "../ui/health-status";
import { Icons } from "../ui/icons";
import type { MultiSelectElement } from "../ui/multi-select";
import { openDistrictStats } from "./district-stats";

const LANGS = [
	{ code: "en" as const, label: "EN" },
	{ code: "az" as const, label: "AZ" },
	{ code: "ru" as const, label: "RU" },
];

function LangSwitcher(): HTMLElement {
	const cur = getLang();

	const trigger = html`<button
		type="button"
		class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-(--r-sm) border border-(--border) bg-(--surface-2) text-(--muted) hover:text-(--text) hover:border-(--border-h) transition-all duration-150 select-none"
	>
		${cur.toUpperCase()}${Icons.chevron(10)}
	</button>`;

	const dropdown = html`<div
		class="absolute right-0 top-full mt-1 z-50 min-w-18 rounded-(--r-sm) border border-(--border) bg-(--surface) shadow-lg py-0.5 hidden"
	></div>`;

	for (const lang of LANGS) {
		const item = html`<button
			type="button"
			class="w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors duration-100 ${
				cur === lang.code
					? "text-(--accent)"
					: "text-(--muted) hover:text-(--text) hover:bg-(--surface-2)"
			}"
		>
			${lang.label}
		</button>`;
		item.addEventListener("click", () => setLang(lang.code));
		dropdown.appendChild(item);
	}

	const wrapper = html`<div class="relative"></div>`;
	wrapper.appendChild(trigger);
	wrapper.appendChild(dropdown);

	let open = false;
	const show = () => {
		open = true;
		dropdown.classList.remove("hidden");
	};
	const hide = () => {
		open = false;
		dropdown.classList.add("hidden");
	};

	trigger.addEventListener("click", (e) => {
		e.stopPropagation();
		open ? hide() : show();
	});

	document.addEventListener("click", () => {
		if (open) hide();
	});

	return wrapper;
}

export function initHeader(container: HTMLElement): () => void {
	const logo = html`
		<div class="flex items-center gap-2.5 group cursor-pointer">
			<div
				class="w-8 h-8 rounded-(--r-sm) bg-(--accent-dim) border border-[rgba(99,102,241,0.35)] flex items-center justify-center text-(--accent) shrink-0 transition-transform group-hover:scale-105"
			>
				${Icons.home()}
			</div>
			<span class="text-sm font-bold tracking-[-0.3px]">${t("appName")}</span>
			${HealthStatus()}
		</div>
	`;

	logo.addEventListener("click", () => window.location.reload());

	const mapBtn = Button({
		title: t("priceMapTitle"),
		color: "indigo",
		variant: "square",
		ariaLabel: t("priceMap"),
		content: Icons.globe(),
	});

	const statsBtn = Button({
		title: t("districtStats"),
		color: "indigo",
		variant: "square",
		ariaLabel: t("statsBtn"),
		content: Icons.barChart(),
	});

	const header = html`
		<header
			class="flex items-center justify-between py-3.5 border-b border-(--border) mb-4"
		>
			${logo}
			<div class="flex items-center gap-1.5">
				${statsBtn}${mapBtn}${LangSwitcher()}
			</div>
		</header>
	`;

	const onStatsClick = () => openDistrictStats();
	statsBtn.addEventListener("click", onStatsClick);

	const onMapClick = () => {
		const el = ge("loc") as MultiSelectElement;
		const active = el ? el.getValue() : [];

		openHeatmap(active, (locName, isToggle) => {
			if (!el) return;

			if (isToggle) {
				const current = el.getValue();
				const idx = current.indexOf(locName);
				if (idx > -1) el.setValue(current.filter((v) => v !== locName));
				else el.setValue([...current, locName]);
			} else {
				el.setValue([locName]);
			}

			// Trigger search via the bus instead of importing doSearch
			bus.emit(EVENTS.SEARCH_STARTED, { more: false });
		});
	};
	mapBtn.addEventListener("click", onMapClick);

	container.appendChild(header);

	return () => {
		statsBtn.removeEventListener("click", onStatsClick);
		mapBtn.removeEventListener("click", onMapClick);
	};
}
