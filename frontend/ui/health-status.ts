import { html } from "../core/utils";

export function HealthStatus(): HTMLElement {
	const text = html`<span class="health-txt">Live</span>`;
	const dot = html`<div class="w-1.5 h-1.5 rounded-full bg-(--green) animate-[livepulse_2s_ease-in-out_infinite]"></div>`;

	const container = html`
		<div
			class="inline-flex items-center gap-1.5 bg-(--surface) border border-(--border) rounded-full py-1.25 pr-3 pl-2 text-xs text-(--text-2) select-none"
			title="Live listings count"
		>
			${dot}
			${text}
		</div>
	`;

	// Fetch health info
	void (async () => {
		try {
			const r = await fetch("/health");
			const d = (await r.json()) as { properties?: number };
			text.textContent = d.properties
				? `${d.properties.toLocaleString()} listings`
				: "0 listings";
		} catch {
			text.textContent = "Down";
			dot.classList.remove("bg-(--green)");
			dot.classList.add("bg-(--muted)");
			dot.classList.remove("animate-[livepulse_2s_ease-in-out_infinite]");
		}
	})();

	return container;
}
