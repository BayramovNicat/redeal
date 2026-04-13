import { bus, EVENTS } from "../core/events";
import { getLang, setLang, t } from "../core/i18n";
import { frag, ge, html } from "../core/utils";
import { openHeatmap } from "../dialogs/heatmap";
import { Button } from "../ui/button";
import { HealthStatus } from "../ui/health-status";
import { Icons } from "../ui/icons";
import type { MultiSelectElement } from "../ui/multi-select";

const LANGS = [
	{ code: "en" as const, label: "EN" },
	{ code: "az" as const, label: "AZ" },
	{ code: "ru" as const, label: "RU" },
];

function LangSwitcher(): HTMLElement {
	const cur = getLang();
	const el = html`<div class="flex items-center gap-0.5 border border-(--border) rounded-(--r-sm) p-0.5"></div>`;
	for (const lang of LANGS) {
		const btn = html`<button
      type="button"
      class="px-2 py-0.5 text-xs font-semibold rounded-[3px] transition-colors duration-150 ${cur === lang.code ? "bg-(--accent) text-white" : "text-(--muted) hover:text-(--text)"}"
    >${lang.label}</button>`;
		btn.addEventListener("click", () => setLang(lang.code));
		el.appendChild(btn);
	}
	return el;
}

export function initHeader(container: HTMLElement): () => void {
	const logo = html`
    <div class="flex items-center gap-2.5 group cursor-pointer">
      <div
        class="w-8.5 h-8.5 rounded-(--r-sm) bg-(--accent-dim) border border-[rgba(99,102,241,0.35)] flex items-center justify-center text-(--accent) shrink-0 transition-transform group-hover:scale-105"
      >
        ${Icons.home()}
      </div>
      <div>
        <div class="text-base font-bold tracking-[-0.3px]">${t("appName")}</div>
        <div class="text-xs text-(--muted) mt-px">
          ${t("appTagline")}
        </div>
      </div>
    </div>
  `;

	logo.addEventListener("click", () => window.location.reload());

	const mapBtn = Button({
		title: t("priceMapTitle"),
		color: "indigo",
		content: frag`${Icons.globe()} ${t("priceMap")}`,
	});

	const header = html`
    <header
      class="flex items-center justify-between pt-6 pb-5 border-b border-(--border) mb-6"
    >
      ${logo}
      <div class="flex items-center gap-2">${LangSwitcher()} ${mapBtn} ${HealthStatus()}</div>
    </header>
  `;

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
		mapBtn.removeEventListener("click", onMapClick);
	};
}
