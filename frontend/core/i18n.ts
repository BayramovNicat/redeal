import type en from "./locales/en";

type Lang = "en" | "az" | "ru";
export type TranslationKey = keyof typeof en;

const STORAGE_KEY = "redeal-lang";

function getInitialLang(): Lang {
	const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
	if (saved && (saved === "en" || saved === "az" || saved === "ru")) {
		return saved;
	}

	const browserLang = (
		(navigator.language || "en").split("-")[0] ?? "en"
	).toLowerCase();
	const detected: Lang =
		browserLang === "az" || browserLang === "ru" ? browserLang : "en";

	localStorage.setItem(STORAGE_KEY, detected);
	return detected;
}

const currentLang: Lang = getInitialLang();
let activeDict: Record<string, string> = {};

/** Dynamically loads only the active locale dictionary. */
export async function initI18n(): Promise<void> {
	if (currentLang === "az") {
		activeDict = (await import("./locales/az")).default;
	} else if (currentLang === "ru") {
		activeDict = (await import("./locales/ru")).default;
	} else {
		activeDict = (await import("./locales/en")).default;
	}
}

export function t(
	key: TranslationKey,
	params?: Record<string, string | number>,
): string {
	let str = activeDict[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replace(new RegExp(`{${k}}`, "g"), String(v));
		}
	}
	return str;
}

export function getLang(): Lang {
	return currentLang;
}

export function setLang(lang: Lang): void {
	if (lang === currentLang) return;
	localStorage.setItem(STORAGE_KEY, lang);
	window.location.reload();
}
