import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getLang, type TranslationKey, t } from "./i18n";

export function toThumbUrl(src: string): string {
	return src.replace("/uploads/full/", "/uploads/f460x345/");
}

// --- Trusted Types ---
interface TrustedHTML {
	__brand: "TrustedHTML";
}
interface TrustedScriptURL {
	__brand: "TrustedScriptURL";
}
interface TrustedTypePolicy {
	createHTML(html: string): TrustedHTML;
	createScriptURL(url: string): TrustedScriptURL;
}
interface TrustedTypePolicyFactory {
	createPolicy(
		name: string,
		options: {
			createHTML?: (html: string) => string;
			createScriptURL?: (url: string) => string;
		},
	): TrustedTypePolicy;
}

declare global {
	interface Window {
		trustedTypes?: TrustedTypePolicyFactory;
	}
}

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

const trustedTypesPolicyOptions = {
	createHTML: (s: string) => s,
	createScriptURL: (s: string) => s,
};

const createTrustedTypesPolicy = (name: string) => {
	try {
		return window.trustedTypes?.createPolicy(name, trustedTypesPolicyOptions);
	} catch {
		return undefined;
	}
};

createTrustedTypesPolicy("default");

const policy = createTrustedTypesPolicy("redeal");

type RawHTML = {
	__rawHtml: string;
};

export const trust = (html: string): RawHTML => {
	return { __rawHtml: html };
};

export const trustScriptURL = (url: string): string | TrustedScriptURL => {
	return policy ? policy.createScriptURL(url) : url;
};

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

export function show(target: string | HTMLElement, d?: string): void {
	const e = typeof target === "string" ? ge(target) : target;
	if (e) {
		e.classList.remove("hidden");
		e.style.display = d ?? "";
	}
}

export function hide(target: string | HTMLElement): void {
	const e = typeof target === "string" ? ge(target) : target;
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

function getToastHost(): HTMLElement {
	const openDialogs =
		document.querySelectorAll<HTMLDialogElement>("dialog[open]");
	const dialog = openDialogs[openDialogs.length - 1];
	if (!dialog) return ge("toasts");

	let host = dialog.querySelector<HTMLElement>("[data-dialog-toasts]");
	if (!host) {
		host = document.createElement("div");
		host.dataset.dialogToasts = "true";
		host.className =
			"fixed bottom-5 right-5 z-[10000] flex flex-col gap-2 pointer-events-none";
		dialog.appendChild(host);
	}
	return host;
}

export function toast(msg: string, err = false): void {
	const el = html`<div
		class="glass-panel bg-(--surface-glass-strong) border rounded-(--r) px-4 py-2.5 text-[13px] font-medium shadow-[var(--shadow-float)] pointer-events-auto animate-[fadeUp_0.2s_ease-out] ${
			err
				? "border-(--red-b) text-(--red)"
				: "border-(--border-h) text-(--text)"
		}"
	>
		${msg}
	</div>`;
	getToastHost().appendChild(el);
	setTimeout(() => el.remove(), 3800);
}

export function fmtFloor(
	f: number | null | undefined,
	t: number | null | undefined,
): string {
	if (f != null && t != null) return `${f}/${t}`;
	return f?.toString() ?? "—";
}

export function tTier(tier: string, short = false): string {
	const map: Record<string, TranslationKey> = {
		"High Value Deal": short ? "tierHighShort" : "tierHigh",
		"Good Deal": short ? "tierGoodShort" : "tierGood",
		"Fair Price": short ? "tierFairShort" : "tierFair",
		Overpriced: short ? "tierOverpricedShort" : "tierOverpriced",
	};
	const key = map[tier] || (short ? "tierNormalShort" : "tierNormal");
	return t(key);
}

const _template = document.createElement("template");

const escapeHtml = (value: unknown): string => {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
};

const isRawHTML = (val: unknown): val is RawHTML => {
	return typeof val === "object" && val !== null && "__rawHtml" in val;
};

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

		if (isRawHTML(val)) {
			return val.__rawHtml;
		}

		return escapeHtml(val);
	};

	const rawHtml = strings.reduce((result, str, i) => {
		return result + str + (i < values.length ? processValue(values[i]) : "");
	}, "");

	const trimmed = rawHtml.trim();
	if (policy) {
		(_template as unknown as { innerHTML: TrustedHTML }).innerHTML =
			policy.createHTML(trimmed);
	} else {
		_template.innerHTML = trimmed;
	}
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

/**
 * Tagged template literal for creating a single root HTMLElement.
 * Supports nested Node objects via <template data-ref> injection.
 * @throws {Error} if the template doesn't contain a root element.
 */
export function html<T extends HTMLElement = HTMLElement>(
	strings: TemplateStringsArray,
	...values: unknown[]
): T {
	const content = _parse(strings, values);
	const el = content.firstElementChild;
	if (!el)
		throw new Error("html`` utility requires at least one root element.");

	return el as T;
}

export const frag = (
	strings: TemplateStringsArray,
	...values: unknown[]
): DocumentFragment => {
	return _parse(strings, values);
};

/**
 * Factory for creating a scoped event manager.
 * Tracks all added listeners and provides a single cleanup method.
 */
export function makeEventManager() {
	const handlers: [
		Element | Document | Window,
		string,
		EventListener,
		boolean | AddEventListenerOptions | undefined,
	][] = [];
	const add = <T extends Event>(
		el: Element | Document | Window,
		ev: string,
		fn: (e: T) => void,
		options?: boolean | AddEventListenerOptions,
	) => {
		const listener = fn as EventListener;
		el.addEventListener(ev, listener, options);
		handlers.push([el, ev, listener, options]);
	};
	const cleanup = () => {
		handlers.forEach(([el, ev, fn, options]) => {
			el.removeEventListener(ev, fn, options);
		});
		handlers.length = 0;
	};
	return { add, cleanup };
}

export function ce<T extends HTMLElement>(
	el: T,
	props: Omit<Partial<T>, "style"> & {
		dataset?: Record<string, string | undefined>;
		style?: string | Partial<CSSStyleDeclaration>;
	},
): T {
	const { dataset, style, ...rest } = props;
	if (dataset) Object.assign(el.dataset, dataset);
	if (typeof style === "string") {
		el.style.cssText = style;
	} else if (style) {
		Object.assign(el.style, style);
	}
	Object.assign(el, rest);
	return el;
}
export function debounce<T extends unknown[]>(
	fn: (...args: T) => unknown,
	ms: number,
): (...args: T) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: T) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), ms);
	};
}
