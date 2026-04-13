import { getLang, t } from "./i18n";

export function renderToastsContainer(root: HTMLElement): void {
	const el = document.createElement("div");
	el.id = "toasts";
	el.className =
		"fixed bottom-5 right-5 z-999 flex flex-col gap-2 pointer-events-none";
	root.appendChild(el);
}

export function ge(id: string): HTMLElement {
	return document.getElementById(id) as HTMLElement;
}

export function show(id: string, d?: string): void {
	const e = ge(id);
	if (e) {
		e.classList.remove("hidden");
		e.style.display = d ?? "";
	}
}

export function hide(id: string): void {
	const e = ge(id);
	if (e) e.style.display = "none";
}

export function getLocale(): string {
	const lang = getLang();
	if (lang === "az") return "az-AZ";
	if (lang === "ru") return "ru-RU";
	return "en-GB";
}

export function fmt(n: number | string, d = 0): string {
	return Number(n).toLocaleString(getLocale(), { maximumFractionDigits: d });
}

export function timeAgo(s: string | null | undefined): string | null {
	if (!s) return null;
	const sec = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
	if (sec < 3600) return `${Math.floor(sec / 60)}${t("unitMin")} ${t("ago")}`;
	if (sec < 86400)
		return `${Math.floor(sec / 3600)}${t("unitHour")} ${t("ago")}`;
	if (sec < 604800)
		return `${Math.floor(sec / 86400)}${t("unitDay")} ${t("ago")}`;
	return new Date(s).toLocaleDateString(getLocale(), {
		day: "numeric",
		month: "short",
	});
}

export function toast(msg: string, err = false): void {
	const el = html`<div
    class="bg-(--surface-3) border border-(--border) rounded-(--r) px-4 py-2.5 text-[13px] text-(--text-2) shadow-[0_4px_20px_rgba(0,0,0,0.5)] pointer-events-auto animate-[fadeUp_0.2s_ease] ${
			err ? "border-(--red-b) text-(--red)" : ""
		}"
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

const _parse = (
	strings: TemplateStringsArray,
	values: unknown[],
): DocumentFragment => {
	const elementsMap = new Map<string, Node>();
	let idCounter = 0;

	const processValue = (val: unknown): string => {
		if (val instanceof Node) {
			const id = `__ref_${idCounter++}__`;
			elementsMap.set(id, val);
			return `<template data-ref="${id}"></template>`;
		}

		if (Array.isArray(val)) {
			return val.map(processValue).join("");
		}

		return String(val ?? "");
	};

	const rawHtml = strings.reduce((result, str, i) => {
		return result + str + (i < values.length ? processValue(values[i]) : "");
	}, "");

	_template.innerHTML = rawHtml.trim();
	const content = document.importNode(_template.content, true);

	content.querySelectorAll("template[data-ref]").forEach((placeholder) => {
		const id = placeholder.getAttribute("data-ref");
		if (id) {
			const realNode = elementsMap.get(id);
			if (realNode) placeholder.replaceWith(realNode);
		}
	});

	return content;
};

export const html = <T extends HTMLElement = HTMLElement>(
	strings: TemplateStringsArray,
	...values: unknown[]
): T => {
	const content = _parse(strings, values);
	const el = content.firstElementChild;
	if (!el)
		throw new Error("html`` utility requires at least one root element.");

	return el as T;
};

export const frag = (
	strings: TemplateStringsArray,
	...values: unknown[]
): DocumentFragment => {
	return _parse(strings, values);
};
