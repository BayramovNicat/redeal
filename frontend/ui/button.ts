import { ce, cn, html } from "@/core/utils";

const SHARED =
	"transition-all duration-150 rounded-(--r) font-medium active:scale-[0.97] disabled:opacity-[0.45] disabled:cursor-not-allowed disabled:transform-none select-none";

const VARIANTS = {
	base: "inline-flex items-center justify-center gap-1.5 px-4 py-2.25 text-sm h-10 whitespace-nowrap",
	padded:
		"inline-flex items-center gap-1.25 px-2.5 py-1.25 text-xs border whitespace-nowrap",
	square: "size-7.5 flex items-center justify-center border",
	ghost: "inline-flex items-center gap-1.25 border-none p-0 text-xs",
};

const COLORS = {
	solid: "bg-(--text) text-(--bg) border-none font-semibold hover:bg-[#d7dbdc]",
	yellow:
		"text-(--muted) border-(--border) bg-transparent hover:text-(--yellow) hover:border-(--yellow-b) hover:bg-(--yellow-dim) [&.on]:text-(--yellow) [&.on]:border-(--yellow-b) [&.on]:bg-(--yellow-dim)",
	red: "text-(--muted) border-(--border) bg-transparent hover:text-(--red) hover:border-(--red-b) hover:bg-(--red-dim) [&.on]:text-(--red) [&.on]:border-(--red-b) [&.on]:bg-(--red-dim)",
	indigo:
		"text-(--muted) border-(--border) bg-(--surface-2) hover:text-(--text) hover:border-(--border-h) [&.on]:text-(--accent) [&.on]:border-(--accent-b) [&.on]:bg-(--accent-dim)",
	green:
		"text-(--muted) border-(--border) bg-transparent hover:text-(--green) hover:border-(--green-b) hover:bg-(--green-dim)",
	blue: "text-(--muted) border-(--border) bg-transparent hover:text-(--blue) hover:border-(--blue-b) hover:bg-(--blue-dim)",
	muted: "text-(--muted) border-none bg-transparent hover:text-(--text)",
	accent:
		"bg-(--accent-solid) text-white border-none font-semibold hover:bg-(--accent-h) hover:shadow-[0_4px_12px_rgba(79,70,229,0.3)]",
};

/** Props accepted by {@link RawButton}. */
export type RawButtonProps = {
	content: unknown;
} & Partial<HTMLButtonElement>;

/**
 * A basic button component that forwards all properties to the underlying `<button>`.
 */
export function RawButton({
	content,
	...props
}: RawButtonProps): HTMLButtonElement {
	return ce<HTMLButtonElement>(
		html`<button type="button">${content}</button>`,
		props,
	);
}

/** Props accepted by {@link Button}. */
export type ButtonProps = {
	content: unknown;
	variant?: keyof typeof VARIANTS;
	color?: keyof typeof COLORS;
	active?: boolean;
} & Partial<HTMLButtonElement>;

/**
 * A stylized button component with standardized branding and variations.
 *
 * Renders a stylized `<button>` using standardized typographic and surface tokens.
 * Supports full property forwarding to the underlying {@link HTMLButtonElement},
 * allowing for standard attributes like `id`, `title`, and event listeners to be passed directly.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button MDN <button> element}
 *
 * @example
 * ```ts
 * const btn = Button({ content: "Click Me", variant: "base", color: "indigo", onclick: () => console.log("clicked") });
 * container.appendChild(btn);
 * ```
 */
export function Button({
	content,
	variant = "padded",
	color = "yellow",
	className = "",
	active = false,
	...props
}: ButtonProps): HTMLButtonElement {
	return RawButton({
		content,
		className: cn(
			SHARED,
			VARIANTS[variant],
			COLORS[color],
			active && "on",
			className,
		),
		...props,
	});
}
