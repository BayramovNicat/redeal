import { ce, cn, html } from "@/core/utils";

const SHARED =
	"select-chevron bg-(--surface-2)/90 border border-(--border) rounded-(--r-sm) font-inherit appearance-none cursor-pointer transition-all duration-150 hover:border-(--border-h) hover:text-(--text) focus:outline-none focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-dim)]";

const VARIANTS = {
	xs: "pl-3 pr-7.5 py-1.5 h-8 text-(--text-2) text-xs font-medium",
	sm: "pl-3 pr-8 py-2 h-9.5 text-(--text) text-[13px]",
};

export interface SelectOption {
	value: string;
	label: string;
}

export type SelectProps = {
	options: SelectOption[];
	variant?: keyof typeof VARIANTS;
} & Omit<Partial<HTMLSelectElement>, "options">;

/**
 * A stylized select component with standardized branding and variations.
 * Supports full property forwarding to the underlying {@link HTMLSelectElement}.
 */
export function Select({
	options,
	variant = "sm",
	className = "",
	...props
}: SelectProps): HTMLSelectElement {
	return ce<HTMLSelectElement>(
		html`
			<select class="${cn(SHARED, VARIANTS[variant], className)}">
				${options.map(
					(o) => html`<option value="${o.value}">${o.label}</option>`,
				)}
			</select>
		`,
		props,
	);
}
