import { html } from "../core/utils";

const SHARED_CLS = `
  text-xs font-medium text-(--muted)
  tracking-[0.06em] uppercase
`;

export function Label({
	text,
	htmlFor,
	className = "",
}: {
	text: string;
	htmlFor?: string;
	className?: string;
}): HTMLLabelElement {
	return html<HTMLLabelElement>`
    <label
      ${htmlFor ? `for="${htmlFor}"` : ""}
      class="${SHARED_CLS} ${className}"
    >
      ${text}
    </label>
  `;
}
