import { html } from "../core/utils";

const CHIP_BASE_CLS = `
  inline-flex items-center gap-1.5
  px-3 py-1.25 rounded-full
  border border-(--border)
  text-(--text-2) text-xs font-medium
  transition-all duration-150
  group-hover:border-(--border-h) group-hover:text-(--text)
  peer-checked:border-[rgba(99,102,241,0.5)] 
  peer-checked:text-(--accent) peer-checked:bg-(--accent-dim)
  before:content-[''] before:w-1.25 before:h-1.25 before:rounded-full before:bg-(--muted)
  before:transition-[background] before:duration-150
  peer-checked:before:bg-(--accent)
`;

const TAG_BASE_CLS = `
  inline-flex items-center gap-1
  text-xs font-medium px-2 py-0.75
  rounded-full border border-current
  whitespace-nowrap
`;

/**
 * An interactive filter pill with a checkbox state.
 */
export function Chip({
	id,
	label,
	checked = false,
}: {
	id: string;
	label: string;
	checked?: boolean;
}): HTMLElement {
	return html`
    <label class="group inline-flex cursor-pointer select-none">
      <input
        type="checkbox"
        id="${id}"
        class="peer absolute opacity-0 w-0 h-0"
        ${checked ? "checked" : ""}
      />
      <span class="${CHIP_BASE_CLS}">${label}</span>
    </label>
  `;
}

/**
 * A static display tag (used on cards).
 */
export function Tag({
	label,
	icon,
	className = "",
}: {
	label: string;
	icon?: string;
	className?: string;
}): HTMLElement {
	return html`
    <span class="${TAG_BASE_CLS} ${className}">
      ${icon ? `${icon} ` : ""}${label}
    </span>
  `;
}
