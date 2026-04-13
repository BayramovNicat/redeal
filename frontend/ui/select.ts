import { html } from "../core/utils";

const SHARED_CLS = `
	bg-(--surface-2) border border-(--border) rounded-(--r-sm)
	font-inherit appearance-none cursor-pointer
	transition-[border-color] duration-150
`;

const VARIANTS = {
	xs: `
		px-2.5 py-1.5
		text-(--text-2) text-xs
		hover:border-(--border-h)
	`,
	sm: `
		px-2.5 py-1.75
		text-(--text) text-sm
		focus:outline-none focus:border-(--accent)
		focus:shadow-[0_0_0_3px_var(--accent-dim)]
	`,
};

export interface SelectOption {
	value: string;
	label: string;
}

export function Select({
	id,
	options,
	variant = "sm",
	className = "",
}: {
	id: string;
	options: SelectOption[];
	variant?: "sm" | "xs";
	className?: string;
}): HTMLSelectElement {
	return html<HTMLSelectElement>`
		<select
			id="${id}"
			class="${SHARED_CLS} ${VARIANTS[variant]} ${className}"
		>
			${options.map((o) => html`<option value="${o.value}">${o.label}</option>`)}
		</select>
	`;
}
