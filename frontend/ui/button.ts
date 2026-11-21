import { ce, cn, html } from "@/core/utils";

const SHARED =
	"transition-all duration-180 ease-out rounded-(--r-sm) font-medium active:scale-[0.97] disabled:opacity-[0.42] disabled:cursor-not-allowed disabled:transform-none select-none";

const VARIANTS = {
	base: "inline-flex items-center justify-center gap-2 px-4 py-2 text-[13px] h-10 rounded-(--r) whitespace-nowrap",
	padded:
		"inline-flex items-center gap-1.5 px-2.75 py-1.5 text-xs border whitespace-nowrap",
	square: "size-8 flex items-center justify-center border",
	ghost: "inline-flex items-center gap-1.5 border-none p-0 text-xs",
};

const COLORS = {
	solid:
		"bg-(--text) text-[#060709] border-none font-semibold hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_20px_rgba(255,255,255,0.08)]",
	yellow:
		"text-(--text-2) border-(--border) bg-(--surface-2)/70 hover:text-(--yellow) hover:border-(--yellow-b) hover:bg-(--yellow-dim) [&.on]:text-(--yellow) [&.on]:border-(--yellow-b) [&.on]:bg-(--yellow-dim)",
	red: "text-(--text-2) border-(--border) bg-(--surface-2)/70 hover:text-(--red) hover:border-(--red-b) hover:bg-(--red-dim) [&.on]:text-(--red) [&.on]:border-(--red-b) [&.on]:bg-(--red-dim)",
	indigo:
		"text-(--text-2) border-(--border) bg-(--surface-2)/80 hover:text-(--text) hover:border-(--border-h) hover:bg-(--surface-3) [&.on]:text-(--accent) [&.on]:border-(--accent-b) [&.on]:bg-(--accent-dim)",
	green:
		"text-(--text-2) border-(--border) bg-(--surface-2)/70 hover:text-(--green) hover:border-(--green-b) hover:bg-(--green-dim) [&.on]:text-(--green) [&.on]:border-(--green-b) [&.on]:bg-(--green-dim)",
	blue: "text-(--text-2) border-(--border) bg-(--surface-2)/70 hover:text-(--blue) hover:border-(--blue-b) hover:bg-(--blue-dim) [&.on]:text-(--blue) [&.on]:border-(--blue-b) [&.on]:bg-(--blue-dim)",
	muted: "text-(--muted) border-none bg-transparent hover:text-(--text)",
	accent:
		"bg-(--accent-solid) text-white border border-white/10 font-semibold hover:bg-(--accent-hover) shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_6px_18px_-4px_rgba(88,101,242,0.5)] hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_24px_-4px_rgba(88,101,242,0.6)]",
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
