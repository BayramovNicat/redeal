import { t } from "@/core/i18n";
import { ce, cn, html } from "@/core/utils";
import { Icons } from "@/ui/icons";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 11.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export type BackToTopProps = {
	label?: string;
	onClick?: () => void;
} & Partial<HTMLButtonElement>;

export interface BackToTopController {
	element: HTMLButtonElement;
	update: (visible: boolean, progress: number) => void;
}

function createProgressRing(): {
	svg: SVGSVGElement;
	progressCircle: SVGCircleElement;
} {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 28 28");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute(
		"class",
		"absolute inset-0 size-full -rotate-90 pointer-events-none",
	);

	const track = document.createElementNS(SVG_NS, "circle");
	track.setAttribute("cx", "14");
	track.setAttribute("cy", "14");
	track.setAttribute("r", String(RING_RADIUS));
	track.setAttribute("fill", "none");
	track.setAttribute("stroke", "rgba(255, 255, 255, 0.12)");
	track.setAttribute("stroke-width", "2");

	const progressCircle = document.createElementNS(SVG_NS, "circle");
	progressCircle.setAttribute("cx", "14");
	progressCircle.setAttribute("cy", "14");
	progressCircle.setAttribute("r", String(RING_RADIUS));
	progressCircle.setAttribute("fill", "none");
	progressCircle.setAttribute("stroke", "var(--accent)");
	progressCircle.setAttribute("stroke-width", "2");
	progressCircle.setAttribute("stroke-linecap", "round");
	progressCircle.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
	progressCircle.setAttribute("stroke-dashoffset", String(RING_CIRCUMFERENCE));

	svg.append(track, progressCircle);
	return { svg, progressCircle };
}

/**
 * Floating Neo-Obsidian capsule button that scrolls back to the top of the page
 * with an ambient circular scroll-progress ring.
 */
export function BackToTopButton({
	label = t("backToTop"),
	className,
	onClick,
	...props
}: BackToTopProps = {}): BackToTopController {
	const { svg: progressRing, progressCircle } = createProgressRing();

	const handleClick = () => {
		if (onClick) {
			onClick();
			return;
		}
		const prefersReduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		window.scrollTo({
			top: 0,
			behavior: prefersReduced ? "instant" : "smooth",
		});
		button.blur();
	};

	const button = ce<HTMLButtonElement>(
		html`
			<button
				type="button"
				aria-label="${label}"
				aria-hidden="true"
				tabindex="-1"
				data-visible="false"
			>
				<span
					class="relative size-6.5 rounded-full bg-(--accent-dim) flex items-center justify-center shrink-0 transition-colors duration-200 group-hover:bg-(--accent-solid)/28"
				>
					${progressRing}
					${Icons.arrowUp({
						size: 13,
						strokeWidth: 2.25,
						className:
							"relative text-(--accent-h) transition-[translate,color] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:text-white",
					})}
				</span>
				<span
					class="text-[12.5px] font-semibold tracking-[-0.01em] text-(--text-2) transition-colors duration-180 group-hover:text-(--text) whitespace-nowrap leading-none"
				>
					${label}
				</span>
			</button>
		`,
		{
			className: cn(
				"group fixed left-1/2 -translate-x-1/2 bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6 z-40",
				"inline-flex items-center gap-2 h-10 pl-1.75 pr-3.75 rounded-full select-none",
				"glass-panel bg-(--surface-2)/92 border border-(--border-h)",
				"shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_36px_-8px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.45)]",
				"hover:bg-(--surface-3)/96 hover:border-(--accent-b)",
				"hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_42px_-8px_rgba(0,0,0,0.9),0_0_24px_rgba(130,148,255,0.22)]",
				"transition-[opacity,translate,scale,color,border-color,background-color,box-shadow] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
				"opacity-0 translate-y-3 scale-95 pointer-events-none",
				"data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0 data-[visible=true]:scale-100 data-[visible=true]:pointer-events-auto",
				"data-[visible=true]:hover:-translate-y-0.5 data-[visible=true]:active:scale-[0.96]",
				"focus-visible:rounded-full",
				className,
			),
			onclick: handleClick,
			...props,
		},
	);

	let lastVisible = false;
	let lastOffset = -1;

	const update = (visible: boolean, progress: number): void => {
		if (visible !== lastVisible) {
			lastVisible = visible;
			button.dataset.visible = visible ? "true" : "false";
			button.setAttribute("aria-hidden", visible ? "false" : "true");
			button.tabIndex = visible ? 0 : -1;
		}

		const clamped = Math.max(0, Math.min(1, progress));
		const offset = Math.round(RING_CIRCUMFERENCE * (1 - clamped) * 100) / 100;
		if (offset !== lastOffset) {
			lastOffset = offset;
			progressCircle.style.strokeDashoffset = String(offset);
		}
	};

	return { element: button, update };
}
