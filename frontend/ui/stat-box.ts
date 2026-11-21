import { html } from "@/core/utils";

export function StatBox({
	label,
	value,
}: {
	label: string;
	value: string | number;
}): HTMLElement {
	return html`
		<div
			class="bg-(--surface-2)/75 border border-(--border-subtle) rounded-(--r-sm) py-2 px-1.5 text-center transition-colors duration-150 group-hover:border-(--border)"
		>
			<div class="text-[10px] font-medium text-(--muted) tracking-wide mb-0.5 truncate">
				${label}
			</div>
			<div class="text-[13px] font-semibold text-(--text) font-mono-num truncate">
				${value}
			</div>
		</div>
	`;
}
