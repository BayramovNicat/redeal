import { html } from "../core/utils";

const SHARED = "transition-all duration-150 rounded-(--r-sm) font-medium";

const VARIANTS = {
	padded: "inline-flex items-center gap-1.25 px-2.5 py-1.25 text-xs border",
	square: "size-7.5 flex items-center justify-center border",
	ghost: "inline-flex items-center gap-1.25 border-none p-0 text-xs",
};

const COLORS = {
	yellow: `
    text-(--muted) border-(--border) bg-transparent
    hover:text-(--yellow) hover:border-(--yellow-b) hover:bg-(--yellow-dim)
    [&.on]:text-(--yellow) [&.on]:border-(--yellow-b) [&.on]:bg-(--yellow-dim)
  `,
	red: `
    text-(--muted) border-(--border) bg-transparent
    hover:text-(--red) hover:border-(--red-b) hover:bg-(--red-dim)
    [&.on]:text-(--red) [&.on]:border-(--red-b) [&.on]:bg-(--red-dim)
  `,
	indigo: `
    text-(--muted) border-(--border) bg-(--surface-2)
    hover:text-(--text) hover:border-(--border-h)
    [&.on]:text-(--accent) [&.on]:border-[rgba(99,102,241,0.4)] [&.on]:bg-(--accent-dim)
  `,
	muted: `
    text-(--muted) border-none bg-transparent
    hover:text-(--text)
  `,
};

export function Button({
	content,
	variant = "padded",
	color = "yellow",
	id,
	title,
	className = "",
	active = false,
	attrs = {},
}: {
	content: unknown;
	variant?: keyof typeof VARIANTS;
	color?: keyof typeof COLORS;
	id?: string;
	title?: string;
	className?: string;
	active?: boolean;
	attrs?: Record<string, string>;
}): HTMLButtonElement {
	const attrStr = Object.entries(attrs)
		.map(([k, v]) => `${k}="${v}"`)
		.join(" ");

	return html<HTMLButtonElement>`
    <button
      type="button"
      ${id ? `id="${id}"` : ""}
      ${title ? `title="${title}"` : ""}
      ${attrStr}
      class="${SHARED} ${VARIANTS[variant]} ${COLORS[color]} ${active ? "on" : ""} ${className}"
    >
      ${content}
    </button>
  `;
}
