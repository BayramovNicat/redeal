import { html } from "../core/utils";

const SHARED_CLS = `
	bg-(--surface-2) border border-(--border) rounded-(--r-sm)
	font-inherit text-(--text)
	transition-all duration-150
	placeholder:text-(--muted)
	focus:outline-none focus:border-(--accent)
	focus:shadow-[0_0_0_3px_var(--accent-dim)]
	box-border
`;

const VARIANTS = {
	sm: "px-2.5 py-1.75 text-sm",
	xs: "px-2.5 py-1.5 text-xs hover:border-(--border-h)",
};

interface InputProps {
	id?: string;
	type?: string;
	placeholder?: string;
	value?: string;
	variant?: keyof typeof VARIANTS;
	className?: string;
	attrs?: Record<string, string>;
}

export function Input({
	id,
	type = "text",
	placeholder = "",
	value = "",
	variant = "sm",
	className = "",
	attrs = {},
}: InputProps): HTMLInputElement {
	const attrStr = Object.entries(attrs)
		.map(([k, v]) => `${k}="${v}"`)
		.join(" ");

	return html<HTMLInputElement>`
    <input
      ${id ? `id="${id}"` : ""}
      type="${type}"
      placeholder="${placeholder}"
      value="${value}"
      class="${SHARED_CLS} ${VARIANTS[variant]} ${className}"
      ${attrStr}
    />
  `;
}
