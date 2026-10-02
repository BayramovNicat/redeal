import { ce, html, trust } from "@/core/utils";

/**
 * Properties for configuring an icon instance.
 */
export interface IconProps extends Partial<SVGSVGElement> {
	size?: number | string;
	strokeWidth?: number | string;
	className?: string;
	color?: string;
	fill?: string | boolean;
}

/**
 * A functional icon component that returns an SVG element.
 * Supports multiple call signatures for convenience.
 */
export interface IconComponent {
	(props?: IconProps): SVGSVGElement;
	(size: number | string, className?: string): SVGSVGElement;
	(filled: boolean, className?: string): SVGSVGElement;
}

/**
 * Factory to create a Lucide-style SVG icon component.
 * Uses a cloned template for performance.
 *
 * @param path - The inner SVG content (paths, circles, etc.)
 */
const i = (path: string): IconComponent => {
	// Pre-parse the base SVG template
	const template = html`
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			${trust(path)}
		</svg>
	`;

	/**
	 * Polymorphic icon function.
	 */
	function icon(props?: IconProps): SVGSVGElement;
	function icon(size: number | string, className?: string): SVGSVGElement;
	function icon(filled: boolean, className?: string): SVGSVGElement;
	function icon(
		arg1?: number | string | boolean | IconProps,
		arg2?: string,
	): SVGSVGElement {
		const el = template.cloneNode(true) as HTMLElement;

		let props: IconProps = {};

		if (typeof arg1 === "object" && arg1 !== null) {
			props = arg1;
		} else if (typeof arg1 === "boolean") {
			props = { fill: arg1 ? "currentColor" : "none", className: arg2 };
		} else if (arg1 !== undefined) {
			props = { size: arg1 as number | string, className: arg2 };
		}

		const { size = 24, strokeWidth, className, color, fill, ...rest } = props;

		el.setAttribute("width", String(size));
		el.setAttribute("height", String(size));
		if (strokeWidth) el.setAttribute("stroke-width", String(strokeWidth));
		if (className) el.setAttribute("class", className);
		if (color) el.setAttribute("stroke", color);
		if (fill !== undefined) {
			el.setAttribute(
				"fill",
				typeof fill === "boolean" ? (fill ? "currentColor" : "none") : fill,
			);
		}

		return ce(el, rest) as unknown as SVGSVGElement;
	}

	return icon as IconComponent;
};

/**
 * Centralized icon library.
 * Icons are functional components created via the {@link i} factory.
 */
export const Icons = {
	barChart: i(
		'<line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />',
	),

	bell: i(
		'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />',
	),

	bookmark: i(
		'<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />',
	),

	check: i('<polyline points="20 6 9 17 4 12" />'),

	chevron: i('<polyline points="6 9 12 15 18 9" />'),

	chevronLeft: i('<polyline points="15 18 9 12 15 6" />'),

	chevronRight: i('<polyline points="9 18 15 12 9 6" />'),

	close: i(
		'<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />',
	),

	desc: i(
		'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />',
	),

	download: i(
		'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />',
	),

	expand: i('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />'),

	external: i('<path d="M7 17L17 7M7 7h10v10" />'),

	gallery: i(
		'<rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />',
	),

	globe: i(
		'<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />',
	),

	grid: i(
		'<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />',
	),

	hide: i(
		'<path d="M9.88 9.88L3.59 3.59M21 21l-6.39-6.39M2 2l20 20M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><circle cx="12" cy="12" r="3" />',
	),

	home: i(
		'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />',
	),

	list: i(
		'<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />',
	),

	map: i(
		'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />',
	),

	mapPins: i(
		'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />',
	),

	noResults: i(
		'<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><path d="M11 8v3M11 15h.01" stroke-width="2" />',
	),

	refresh: i(
		'<path d="M21 12a9 9 0 0 0-15-6.7L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 15 6.7L21 16" /><path d="M21 21v-5h-5" />',
	),

	search: i(
		'<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />',
	),

	share: i(
		'<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />',
	),

	spinner: i('<path d="M21 12a9 9 0 1 1-6.219-8.56" />'),

	trash: i(
		'<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />',
	),

	logOut: i(
		'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />',
	),

	user: i(
		'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',
	),
};
