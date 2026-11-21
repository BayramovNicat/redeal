import { ce, cn, html } from "@/core/utils";

export type EmptyStateProps = {
	icon: SVGSVGElement;
	title: string;
	subtitle?: string;
	hidden?: boolean;
	padTop?: boolean;
} & Partial<HTMLElement>;

/**
 * Centered state view used for loading, empty, and welcome screens.
 */
export function EmptyState({
	icon,
	title,
	subtitle,
	hidden = true,
	padTop = false,
	className = "",
	...props
}: EmptyStateProps): HTMLElement {
	return ce(
		html`
			<div class="${cn(hidden && "hidden", className)}">
				<div
					class="${cn(
						"flex flex-col items-center justify-center py-20 px-6 gap-3.5 text-center",
						padTop && "pt-24",
					)}"
				>
					<div
						class="size-16 rounded-2xl bg-(--surface) border border-(--border) flex items-center justify-center shadow-[var(--shadow-card)] text-(--muted)"
					>
						${icon}
					</div>
					<p class="text-base font-semibold text-(--text) tracking-tight">
						${title}
					</p>
					${
						subtitle
							? html`<p class="text-[13px] text-(--muted) max-w-88 leading-relaxed">
								${subtitle}
							</p>`
							: ""
					}
				</div>
			</div>
		`,
		props,
	);
}
