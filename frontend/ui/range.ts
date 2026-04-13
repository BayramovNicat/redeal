import { html } from "../core/utils";

const CONTAINER_CLS = `
  flex items-center h-10 px-3.5 
  bg-(--surface-2) border border-(--border) rounded-(--r) 
  transition-[border-color,box-shadow] duration-150 
  hover:border-(--border-h) 
  focus-within:border-(--accent) 
  focus-within:shadow-[0_0_0_3px_var(--accent-dim)]
`;

const INPUT_CLS = `
  appearance-none w-full h-1.25 rounded-full outline-none cursor-pointer m-0 
  bg-[linear-gradient(to_right,var(--accent)_var(--p,0%),var(--muted)_var(--p,0%))] 
  [&::-webkit-slider-thumb]:appearance-none 
  [&::-webkit-slider-thumb]:w-4.5 
  [&::-webkit-slider-thumb]:h-4.5 
  [&::-webkit-slider-thumb]:bg-(--bg) 
  [&::-webkit-slider-thumb]:rounded-full 
  [&::-webkit-slider-thumb]:border-2 
  [&::-webkit-slider-thumb]:border-(--accent) 
  [&::-webkit-slider-thumb]:shadow-[0_2px_5px_rgba(0,0,0,0.2)] 
  [&::-webkit-slider-thumb]:cursor-pointer 
  [&::-webkit-slider-thumb]:transition-[transform_0.1s,background_0.15s] 
  [&::-webkit-slider-thumb:hover]:scale-[1.15] 
  [&::-webkit-slider-thumb:hover]:bg-(--surface-2)
`;

/**
 * Updates the CSS variable --p on a range input to reflect its current progress.
 * This is used for the custom track background gradient.
 */
export function setRangeProgress(input: HTMLInputElement): void {
	const min = Number(input.min) || 0;
	const max = Number(input.max) || 100;
	const val = Number(input.value);
	const p = ((val - min) / (max - min)) * 100;
	input.style.setProperty("--p", `${p}%`);
}

export function Range({
	id,
	min = 0,
	max = 100,
	value = 0,
	className = "",
}: {
	id?: string;
	min?: number | string;
	max?: number | string;
	value?: number | string;
	className?: string;
}): HTMLElement {
	const input = html<HTMLInputElement>`
    <input
      type="range"
      ${id ? `id="${id}"` : ""}
      min="${min}"
      max="${max}"
      value="${value}"
      class="${INPUT_CLS}"
    />
  `;

	// Initialize progress
	setRangeProgress(input);

	// Automatically update progress on input
	input.addEventListener("input", () => setRangeProgress(input));

	return html`
    <div class="${CONTAINER_CLS} ${className}">
      ${input}
    </div>
  `;
}
