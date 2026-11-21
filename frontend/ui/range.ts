import { ce, cn, html } from "@/core/utils";

const CONTAINER_CLS = `
  flex items-center h-10 px-3.5
  bg-(--surface-2)/90 border border-(--border) rounded-(--r)
  transition-all duration-150
  hover:border-(--border-h)
  focus-within:border-(--accent)
  focus-within:shadow-[0_0_0_3px_var(--accent-dim)]
`;

const INPUT_CLS = `
  appearance-none w-full h-1.5 rounded-full outline-none cursor-pointer m-0
  bg-[linear-gradient(to_right,var(--accent)_var(--p,0%),rgba(255,255,255,0.1)_var(--p,0%))]
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:w-4.5
  [&::-webkit-slider-thumb]:h-4.5
  [&::-webkit-slider-thumb]:bg-white
  [&::-webkit-slider-thumb]:rounded-full
  [&::-webkit-slider-thumb]:border-[2.5px]
  [&::-webkit-slider-thumb]:border-(--accent-solid)
  [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(130,148,255,0.22),0_2px_8px_rgba(0,0,0,0.45)]
  [&::-webkit-slider-thumb]:cursor-pointer
  [&::-webkit-slider-thumb]:transition-[transform,scale,box-shadow]
  [&::-webkit-slider-thumb]:duration-200
  [&::-webkit-slider-thumb]:ease-out
  [&::-webkit-slider-thumb:hover]:scale-[1.15]
  [&::-webkit-slider-thumb:active]:scale-[1.08]
`;

/**
 * Updates the CSS variable --p on a range input to reflect its current progress.
 */
export function setRangeProgress(input: HTMLInputElement): void {
	const min = Number(input.min) || 0;
	const max = Number(input.max) || 100;
	const val = Number(input.value);
	const p = ((val - min) / (max - min)) * 100;
	input.style.setProperty("--p", `${p}%`);
}

/** Props accepted by {@link RawRange}. */
export type RawRangeProps = Omit<
	Partial<HTMLInputElement>,
	"min" | "max" | "value"
> & {
	min?: string | number;
	max?: string | number;
	value?: string | number;
};

/**
 * A basic range input component that forwards all properties to the underlying `<input type="range">`.
 */
export function RawRange(props: RawRangeProps): HTMLInputElement {
	const { min, max, value, className = "", ...rest } = props;
	const el = html`<input
		type="range"
		class="${cn(INPUT_CLS, className)}"
	/>` as HTMLInputElement;

	if (min != null) el.min = String(min);
	if (max != null) el.max = String(max);
	if (value != null) el.value = String(value);

	return ce<HTMLInputElement>(el, rest);
}

/** Props accepted by {@link Range}. */
export type RangeProps = {
	className?: string;
} & RawRangeProps;

export interface RangeElement extends HTMLDivElement {
	inputElement: HTMLInputElement;
}

/**
 * A stylized range input component with standardized branding.
 */
export function Range({ className = "", ...props }: RangeProps): RangeElement {
	const input = RawRange(props);

	setRangeProgress(input);
	input.addEventListener("input", () => setRangeProgress(input));

	const el = ce<RangeElement>(
		html`<div class="${cn(CONTAINER_CLS, className)}">${input}</div>`,
		{},
	);
	el.inputElement = input;
	return el;
}
