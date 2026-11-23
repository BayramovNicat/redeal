import { ce, cn, html } from "@/core/utils";
import { Button } from "./button";
import { Icons } from "./icons";

const BACKDROP = `
	bg-transparent border-none p-0
	max-w-screen max-h-screen w-full h-full
	backdrop:bg-[#040508]/80 backdrop:backdrop-blur-md
`;

const INNER = `
	dialog-panel
	fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
	flex flex-col overflow-hidden
	bg-(--surface) text-(--text) border border-(--border-h) rounded-(--r-xl)
	max-h-[calc(100vh-2rem)]
	shadow-[var(--shadow-float)]
`;

/** Props accepted by {@link Dialog}. */
export type DialogProps = {
	/** Maximum width of the dialog panel (e.g. "860px"). Responsive width is handled automatically. */
	maxWidth: string;
	/** Optional title for the standardized header. */
	title?: string;
	/** Optional description text or element for the header. */
	description?: unknown;
	/** Whether to show a close button in the top-right. Defaults to true if title is provided. */
	showClose?: boolean;
	/** Optional custom classes for the close button. */
	closeClassName?: string;
	/** Main content of the dialog. */
	content: unknown;
} & Partial<HTMLDialogElement>;

let openDialogsCount = 0;

/**
 * A stylized dialog component with standardized branding and backdrop logic.
 */
export function Dialog({
	maxWidth,
	title,
	description,
	showClose,
	closeClassName = "",
	content,
	className = "",
	...props
}: DialogProps): HTMLDialogElement {
	const displayClose = showClose ?? !!title;

	const closeBtn = displayClose
		? Button({
				content: Icons.close(16),
				variant: "ghost",
				color: "muted",
				ariaLabel: "Close dialog",
				className: cn(
					"absolute top-4.5 right-4.5 size-8.5 flex items-center justify-center rounded-full border border-(--border) bg-(--surface-2)/80 text-(--text-2) hover:text-(--text) hover:bg-(--surface-3) hover:border-(--border-h) transition-all z-[1001]",
					closeClassName,
				),
				onclick: (e) => {
					const d = (e.currentTarget as HTMLElement).closest(
						"dialog",
					) as HTMLDialogElement;
					d?.close();
				},
			})
		: "";

	const header = title
		? html`
				<div
					class="relative px-6 pt-5.5 pb-4.5 border-b border-(--border) bg-(--surface-2)/55"
				>
					${closeBtn}
					<div class="text-[17px] font-bold text-(--text) tracking-tight pr-10">
						${title}
					</div>
					${
						description
							? html`<p class="text-xs text-(--text-2) leading-relaxed pr-10 mt-1">
								${description}
							</p>`
							: ""
					}
				</div>
			`
		: displayClose
			? html`<div class="relative">${closeBtn}</div>`
			: "";

	const el = ce<HTMLDialogElement>(
		html`
			<dialog class="${BACKDROP}" aria-modal="true">
				<div
					class="${cn(INNER, className)}"
					style="width:${maxWidth === "none" ? "100%" : "calc(100vw - 2rem)"};max-width:${maxWidth}"
				>
					${header}
					<div class="flex-1 flex flex-col min-h-0">${content}</div>
				</div>
			</dialog>
		`,
		props,
	);

	el.addEventListener("click", (e) => {
		if (e.target === e.currentTarget) el.close();
	});

	const originalShowModal = el.showModal.bind(el);
	el.showModal = () => {
		if (el.open) return;
		originalShowModal();
		openDialogsCount++;
		document.body.setAttribute("data-dialog-open", "true");
	};

	const onDialogClosed = () => {
		openDialogsCount = Math.max(0, openDialogsCount - 1);
		if (openDialogsCount === 0) {
			document.body.removeAttribute("data-dialog-open");
		}
	};
	el.addEventListener("close", onDialogClosed);

	const originalRemove = el.remove.bind(el);
	el.remove = () => {
		if (el.open) onDialogClosed();
		originalRemove();
	};

	return el;
}
