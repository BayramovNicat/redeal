import { html, makeEventManager } from "@/core/utils";

/**
 * Super-optimized global tooltip system.
 * Uses a single DOM element and event delegation to provide high-performance tooltips.
 */

let el: HTMLElement | null = null;
let activeTarget: HTMLElement | null = null;
let rootEl: HTMLElement | null = null;

/**
 * Initializes the tooltip system by attaching global event listeners.
 */
export function initTooltip(root: HTMLElement = document.body): () => void {
	if (el) return () => {};
	rootEl = root;
	const { add, cleanup } = makeEventManager();

	el = html`
		<div
			id="tooltip"
			class="fixed top-0 left-0 z-10001 px-2.75 py-1.5 bg-(--surface-glass-strong) text-(--text) border border-(--border-h) rounded-(--r-sm) text-[11px] font-medium pointer-events-none shadow-[var(--shadow-float)] backdrop-blur-md opacity-0 transition-opacity duration-150"
			role="tooltip"
			aria-hidden="true"
		></div>
	`;
	root.appendChild(el);

	const onMouseOver = (e: MouseEvent) => {
		const target = (e.target as HTMLElement).closest(
			"[title], [data-tip]",
		) as HTMLElement;
		if (!target || target === activeTarget) return;

		// Move title to data-tip to prevent native behavior
		if (target.hasAttribute("title")) {
			target.setAttribute("data-tip", target.getAttribute("title") || "");
			target.removeAttribute("title");
		}

		show(target);
	};

	const onMouseOut = (e: MouseEvent) => {
		const target = (e.target as HTMLElement).closest(
			"[data-tip]",
		) as HTMLElement;
		if (target && target === activeTarget) {
			const related = e.relatedTarget as HTMLElement;
			if (!related || !target.contains(related)) {
				hide();
			}
		}
	};

	const onScroll = () => hide();
	const onPointerDown = () => hide();
	const onClick = () => hide();
	const observer = new MutationObserver(() => {
		if (activeTarget && !activeTarget.isConnected) hide();
	});
	observer.observe(document.body, { childList: true, subtree: true });

	add(window, "mouseover", onMouseOver);
	add(window, "mouseout", onMouseOut);
	add(window, "pointerdown", onPointerDown);
	add(window, "click", onClick);
	add(window, "scroll", onScroll);
	add(window, "resize", onScroll);

	return () => {
		cleanup();
		observer.disconnect();
		el?.remove();
		el = null;
	};
}

function show(target: HTMLElement) {
	if (!el) return;

	activeTarget = target;
	const text = target.getAttribute("data-tip");
	if (!text) return;

	// Handle top-layer (dialog) visibility
	const dialog = target.closest("dialog");
	if (dialog && el.parentElement !== dialog) {
		dialog.appendChild(el);
	} else if (!dialog && rootEl && el.parentElement !== rootEl) {
		rootEl.appendChild(el);
	}

	el.textContent = text;
	el.setAttribute("aria-label", text);
	el.removeAttribute("aria-hidden");
	target.setAttribute("aria-describedby", "tooltip");

	updatePosition();

	el.classList.remove("opacity-0");
	el.classList.add("opacity-100");
}

function hide() {
	if (!el) return;
	el.classList.add("opacity-0");
	el.classList.remove("opacity-100");
	el.setAttribute("aria-hidden", "true");
	activeTarget?.removeAttribute("aria-describedby");
	activeTarget = null;
}

function updatePosition() {
	if (!el || !activeTarget) return;

	const targetRect = activeTarget.getBoundingClientRect();
	const tooltipRect = el.getBoundingClientRect();

	const gap = 8;
	let top = targetRect.top - tooltipRect.height - gap;
	let left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;

	// Overflow checks
	if (top < gap) {
		top = targetRect.bottom + gap;
	}

	if (left < gap) {
		left = gap;
	} else if (left + tooltipRect.width > window.innerWidth - gap) {
		left = window.innerWidth - tooltipRect.width - gap;
	}

	el.style.left = `${Math.round(left)}px`;
	el.style.top = `${Math.round(top)}px`;
}
