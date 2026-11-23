import { ce, cn, html } from "@/core/utils";
import { RawButton } from "./button";
import { Icons } from "./icons";

const CHIP_SHARED = cn(
	"inline-flex items-center gap-2",
	"px-3 py-1.5 rounded-full",
	"bg-(--surface-2)/70 border border-(--border)",
	"text-(--text-2) text-xs font-medium",
	"transition-all duration-150",
	"group-hover:border-(--border-h) group-hover:text-(--text) group-hover:bg-(--surface-3)/70",
	"peer-checked:border-(--accent-b)",
	"peer-checked:text-(--accent) peer-checked:bg-(--accent-dim)",
	"before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-(--muted)/60",
	"before:transition-all before:duration-150",
	"peer-checked:before:bg-(--accent) peer-checked:before:shadow-[0_0_8px_var(--accent)]",
);

const TAG_SHARED = cn(
	"inline-flex items-center gap-1",
	"text-[11px] font-medium px-2 py-0.5",
	"rounded-md border border-transparent",
	"whitespace-nowrap leading-tight",
);

const CLOSEABLE_SHARED = cn(
	"inline-flex items-center gap-1.5",
	"bg-(--accent-dim) border border-(--accent-b) rounded-full",
	"py-1 pr-1.5 pl-3",
	"text-xs font-medium text-(--text)",
	"animate-[fadeUp_0.16s_ease-out]",
);

const CLOSEABLE_BTN_SHARED = cn(
	"bg-none border-none text-(--accent)/80 rounded-full",
	"size-4.5 flex items-center justify-center transition-colors duration-100",
	"hover:text-(--text) hover:bg-white/10 cursor-pointer",
);

/** Props accepted by {@link Chip}. */
export type ChipProps = {
	label: string;
} & Partial<HTMLInputElement>;

export interface ChipElement extends HTMLLabelElement {
	inputElement: HTMLInputElement;
}

/**
 * An interactive filter pill with a checkbox state.
 */
export function Chip({
	label,
	className = "",
	...props
}: ChipProps): ChipElement {
	const input = ce<HTMLInputElement>(
		html`<input type="checkbox" class="peer absolute opacity-0 w-0 h-0" />`,
		props,
	);
	const el = html`
		<label class="group inline-flex cursor-pointer select-none">
			${input}
			<span class="${cn(CHIP_SHARED, className)}">${label}</span>
		</label>
	` as ChipElement;
	el.inputElement = input;
	return el;
}

/** Props accepted by {@link Tag}. */
export type TagProps = {
	label: string;
	icon?: string;
} & Partial<HTMLSpanElement>;

/**
 * A static display tag (used on cards).
 */
export function Tag({
	label,
	icon,
	className = "",
	...props
}: TagProps): HTMLSpanElement {
	return ce<HTMLSpanElement>(
		html`
			<span class="${cn(TAG_SHARED, className)}">
				${icon ? `${icon} ` : ""}${label}
			</span>
		`,
		props,
	);
}

/** Props accepted by {@link CloseableChip}. */
export type CloseableChipProps = {
	label: string;
	onClose: () => void;
} & Partial<HTMLSpanElement>;

/**
 * A removable chip with a close button.
 */
export function CloseableChip({
	label,
	onClose,
	className = "",
	...props
}: CloseableChipProps): HTMLSpanElement {
	return ce<HTMLSpanElement>(
		html`
			<span class="${cn(CLOSEABLE_SHARED, className)}">
				${label}
				${RawButton({
					ariaLabel: "Remove filter",
					className: CLOSEABLE_BTN_SHARED,
					onclick: onClose,
					content: Icons.close(10),
				})}
			</span>
		`,
		props,
	);
}
