export function ge(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

export function show(id: string, d?: string): void {
  const e = ge(id);
  if (e) e.style.display = d ?? "";
}

export function hide(id: string): void {
  const e = ge(id);
  if (e) e.style.display = "none";
}

export function fmt(n: number | string, d = 0): string {
  return Number(n).toLocaleString("az-AZ", { maximumFractionDigits: d });
}

export function timeAgo(s: string | null | undefined): string | null {
  if (!s) return null;
  const sec = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function toast(msg: string, err = false): void {
  const el = html`<div
    class="bg-(--surface-3) border border-(--border) rounded-(--r) px-4 py-2.5 text-[13px] text-(--text-2) shadow-[0_4px_20px_rgba(0,0,0,0.5)] pointer-events-auto animate-[fadeUp_0.2s_ease] ${err
      ? "border-(--red-b) text-(--red)"
      : ""}"
  >
    ${msg}
  </div>`;
  ge("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

export function fmtFloor(
  f: number | null | undefined,
  t: number | null | undefined,
): string {
  if (f != null && t != null) return `${f}/${t}`;
  return f?.toString() ?? "—";
}

const _template = document.createElement("template");

export const html = <T extends HTMLElement = HTMLElement>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): T => {
  const elementsMap = new Map<string, Node>();
  let idCounter = 0;

  // Helper to check and handle live DOM nodes or arrays
  const processValue = (val: unknown): string => {
    // If it's a live DOM node (Element, TextNode, Fragment)
    if (val instanceof Node) {
      const id = `__ref_${idCounter++}__`;
      elementsMap.set(id, val);
      // Use <template> because the browser parser allows it anywhere (even inside tables)
      return `<template data-ref="${id}"></template>`;
    }

    // If it's an array, recursively process each item
    if (Array.isArray(val)) {
      return val.map(processValue).join("");
    }

    // Normal primitive values (strings, numbers)
    return String(val ?? "");
  };

  // 1. Build the raw HTML string with placeholders
  const rawHtml = strings.reduce((result, str, i) => {
    return result + str + (i < values.length ? processValue(values[i]) : "");
  }, "");

  // 2. Parse into DOM
  _template.innerHTML = rawHtml.trim();
  const content = _template.content;

  // 3. Swap placeholders with the real, live nodes
  content.querySelectorAll("template[data-ref]").forEach((placeholder) => {
    const id = placeholder.getAttribute("data-ref");
    if (id) {
      const realNode = elementsMap.get(id);
      if (realNode) {
        // replaceWith physically moves the node, preserving all listeners
        placeholder.replaceWith(realNode);
      }
    }
  });

  const el = content.firstElementChild;
  if (!el)
    throw new Error("html`` utility requires at least one root element.");

  return el as T;
};
