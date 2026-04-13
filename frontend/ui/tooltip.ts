import { html } from "../core/utils";

/**
 * Super-optimized global tooltip system.
 * Uses a single DOM element and event delegation to provide high-performance tooltips.
 */

let el: HTMLElement | null = null;
let activeTarget: HTMLElement | null = null;

/**
 * Initializes the tooltip system by attaching global event listeners.
 */
export function initTooltip(root: HTMLElement = document.body): () => void {
  if (el) return () => {};

  el = html`
    <div
      class="fixed top-0 left-0 z-50 px-2.5 py-1.5 bg-(--surface-3) text-(--text) border border-(--border-h) rounded-(--r-sm) text-xs font-medium pointer-events-none shadow-xl backdrop-blur-md opacity-0 transition-opacity duration-150"
      role="tooltip"
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

  window.addEventListener("mouseover", onMouseOver, { passive: true });
  window.addEventListener("mouseout", onMouseOut, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  return () => {
    window.removeEventListener("mouseover", onMouseOver);
    window.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    el?.remove();
    el = null;
  };
}

function show(target: HTMLElement) {
  if (!el) return;

  activeTarget = target;
  const text = target.getAttribute("data-tip");
  if (!text) return;

  el.textContent = text;
  updatePosition();

  el.classList.remove("opacity-0");
  el.classList.add("opacity-100");
}

function hide() {
  if (!el) return;
  el.classList.add("opacity-0");
  el.classList.remove("opacity-100");
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
