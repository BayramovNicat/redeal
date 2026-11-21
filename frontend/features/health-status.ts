import { t } from "@/core/i18n";
import { ce, cn, html } from "@/core/utils";

/** Props accepted by {@link HealthStatus}. */
export type HealthStatusProps = Partial<HTMLDivElement>;

/**
 * Displays the system health status and live property count.
 * Fetches data from the `/health` endpoint on initialization.
 */
export function HealthStatus(props: HealthStatusProps = {}): HTMLDivElement {
	const text = html`<span class="health-txt font-mono-num">${t("statusLive")}</span>`;
	const dot = html`<span class="relative flex size-1.75 shrink-0">
		<span
			class="health-ping absolute inline-flex h-full w-full rounded-full bg-(--green) opacity-55 animate-[livepulse_2.2s_ease-in-out_infinite]"
		></span>
		<span
			class="health-dot relative inline-flex rounded-full size-1.75 bg-(--green) shadow-[0_0_8px_var(--green)]"
		></span>
	</span>`;

	const el = ce<HTMLDivElement>(
		html`
			<div
				class="${cn(
					"inline-flex items-center gap-1.75 text-[11.5px] font-medium text-(--muted) select-none transition-colors hover:text-(--text-2) whitespace-nowrap",
				)}"
				title="${t("allListings")}"
			>
				${dot} ${text}
			</div>
		`,
		props,
	);

	// Fetch health info
	void (async () => {
		try {
			const r = await fetch("/health");
			const d = (await r.json()) as { properties?: number };
			text.textContent = d.properties
				? `${d.properties.toLocaleString()} ${t(
						d.properties !== 1 ? "listings" : "listing",
					)}`
				: `0 ${t("listings")}`;
		} catch {
			text.textContent = t("statusDown");
			const ping = dot.firstElementChild as HTMLElement | null;
			const core = dot.lastElementChild as HTMLElement | null;
			if (ping) ping.classList.add("hidden");
			if (core) {
				core.classList.remove("bg-(--green)", "shadow-[0_0_8px_var(--green)]");
				core.classList.add("bg-(--muted)");
			}
		}
	})();

	return el;
}
