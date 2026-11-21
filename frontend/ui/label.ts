import { ce, cn, html } from "@/core/utils";

/** Props accepted by {@link Label}. */
export type LabelProps = {
	text: string;
	content?: unknown;
} & Partial<HTMLLabelElement>;

/**
 * A semantically-compliant `<label>` element with standardized branding.
 */
export function Label({ text, content, className = "", ...props }: LabelProps) {
	return ce<HTMLLabelElement>(
		html`
			<label
				class="${cn(
					"text-[11px] font-semibold text-(--muted) tracking-[0.06em] uppercase",
					className,
				)}"
			>
				${text} ${content}
			</label>
		`,
		props,
	);
}
