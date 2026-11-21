import { ce, cn, frag, html } from "@/core/utils";
import { Label } from "./label";

const SHARED_CLS = `
	bg-(--surface-2)/90 border border-(--border) rounded-(--r-sm)
	font-inherit text-(--text)
	transition-all duration-150
	placeholder:text-(--muted)/80
	hover:border-(--border-h)
	focus:outline-none focus:border-(--accent) focus:bg-(--surface-2)
	focus:shadow-[0_0_0_3px_var(--accent-dim)]
	box-border
`;

const VARIANTS = {
	sm: "px-3 py-2 text-[13px] h-9.5",
	xs: "px-2.5 py-1.5 text-xs h-8",
};

/** Props accepted by {@link RawInput}. */
export type RawInputProps = Omit<
	Partial<HTMLInputElement>,
	"min" | "max" | "value"
> & {
	min?: string | number;
	max?: string | number;
	value?: string | number;
};

/**
 * A basic input component that forwards all properties to the underlying `<input>`.
 */
export function RawInput(props: RawInputProps): HTMLInputElement {
	const el = html`<input />` as HTMLInputElement;
	const { min, max, value, ...rest } = props;

	if (min != null) el.min = String(min);
	if (max != null) el.max = String(max);
	if (value != null) el.value = String(value);

	return ce<HTMLInputElement>(el, rest);
}

/** Props accepted by {@link Input}. */
export type InputProps = {
	variant?: keyof typeof VARIANTS;
} & RawInputProps;

/**
 * A stylized text input with standardized branding.
 */
export function Input({
	variant = "sm",
	className = "",
	...props
}: InputProps) {
	return RawInput({
		className: cn(SHARED_CLS, VARIANTS[variant], className),
		...props,
	});
}

/** Props accepted by {@link Field}. */
export type FieldProps = {
	htmlFor?: string;
	label: string;
	input: HTMLElement;
} & Partial<HTMLDivElement>;

/**
 * A layout wrapper for form fields that stacks a label above an input or select element.
 */
export function Field({
	htmlFor,
	label,
	input,
	className = "",
	...props
}: FieldProps): HTMLDivElement {
	const content = html`
		<div class="${cn("flex flex-col gap-1.5", className)}">
			${
				htmlFor
					? frag`${Label({ htmlFor, text: label })}${input}`
					: Label({
							text: label,
							content: input,
							className: "flex flex-col gap-1.5 cursor-pointer",
						})
			}
		</div>
	`;
	return ce<HTMLDivElement>(content as unknown as HTMLDivElement, props);
}
