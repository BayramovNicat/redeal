import { bus, EVENTS } from "@/core/events";
import { getLang, setLang, t } from "@/core/i18n";
import { cn, html, makeEventManager } from "@/core/utils";
import {
	fetchAccessRequests,
	getCachedAuthUser,
	isUserAuthenticated,
	logoutUser,
} from "@/features/auth/api";
import { openLoginModal } from "@/features/auth/login-modal";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";
import { HealthStatus } from "./health-status";

let statsInitialized = false;
let scrapeOpsInitialized = false;

const LANGS = [
	{ code: "en" as const, label: "EN" },
	{ code: "az" as const, label: "AZ" },
	{ code: "ru" as const, label: "RU" },
] as const;

const CAPSULE_BTN =
	"h-7.5 border-none bg-transparent rounded-full text-(--text-2) hover:text-(--text) hover:bg-white/[0.06] transition-colors duration-180";

function LangSwitcher(evm: ReturnType<typeof makeEventManager>): HTMLElement {
	const cur = getLang();

	const trigger = Button({
		content: html`
			<span class="flex items-center gap-1 font-mono-num tracking-wide text-[11.5px]">
				${cur.toUpperCase()}
				${Icons.chevron({
					size: 10,
					className: "opacity-55 transition-transform group-[.open]:rotate-180",
				})}
			</span>
		`,
		variant: "padded",
		color: "indigo",
		className: cn("group px-2.5 font-semibold", CAPSULE_BTN),
	});

	const dropdown = html`
		<div
			class="absolute right-0 top-full mt-2.5 z-50 min-w-24 rounded-(--r) border border-(--border-h) glass-panel bg-(--surface-glass-strong) shadow-[var(--shadow-float)] p-1 hidden animate-[fadeUp_0.15s_ease-out] origin-top-right"
		>
			${LANGS.map((lang) => {
				const isActive = cur === lang.code;
				const item = html`
					<button
						type="button"
						class="${cn(
							"w-full flex items-center justify-between px-2.5 py-1.5 rounded-(--r-xs) text-xs font-semibold transition-colors duration-100",
							isActive
								? "text-(--accent) bg-(--accent-dim)"
								: "text-(--text-2) hover:text-(--text) hover:bg-(--surface-3)/70",
						)}"
					>
						<span>${lang.label}</span>
						${isActive ? Icons.check(12) : ""}
					</button>
				`;
				item.onclick = () => setLang(lang.code);
				return item;
			})}
		</div>
	`;

	const wrapper = html`<div class="relative">${trigger}${dropdown}</div>`;

	let open = false;
	const toggle = (force?: boolean) => {
		open = force ?? !open;
		dropdown.classList.toggle("hidden", !open);
		trigger.classList.toggle("open", open);
	};

	evm.add(trigger, "click", (e) => {
		e.stopPropagation();
		toggle();
	});

	evm.add(document, "click", (e) => {
		if (open && !wrapper.contains(e.target as Node)) {
			toggle(false);
		}
	});

	return wrapper;
}

function StatsButton(): HTMLButtonElement {
	return Button({
		title: t("districtStats"),
		color: "indigo",
		variant: "padded",
		ariaLabel: t("statsBtn"),
		content: html`
			<span class="flex items-center gap-1.5">
				${Icons.barChart(13)}
				<span class="max-[560px]:hidden">${t("statsBtn")}</span>
			</span>
		`,
		className: cn("px-2.75 font-medium", CAPSULE_BTN),
		onclick: async () => {
			const { initDistrictStats, openDistrictStats } = await import(
				"./district-stats/index"
			);
			if (!statsInitialized) {
				const root = document.getElementById("app") as HTMLElement;
				initDistrictStats(root);
				statsInitialized = true;
			}
			openDistrictStats();
		},
	});
}

function ScrapeOpsButton(): HTMLButtonElement {
	return Button({
		title: t("scrapeOps"),
		color: "indigo",
		variant: "square",
		ariaLabel: t("scrapeOps"),
		content: Icons.refresh(13),
		className: cn("size-7.5", CAPSULE_BTN),
		onclick: async () => {
			const { initScrapeOps, openScrapeOps } = await import(
				"./scrape-ops/index"
			);
			if (!scrapeOpsInitialized) {
				const root = document.getElementById("app") as HTMLElement;
				initScrapeOps(root);
				scrapeOpsInitialized = true;
			}
			openScrapeOps();
		},
	});
}

function WhitelistButton(): {
	button: HTMLButtonElement;
	setPendingCount: (count: number) => void;
} {
	const badge = html`
		<span
			class="hidden absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-(--yellow) text-[#060709] text-[10px] font-extrabold font-mono-num leading-none items-center justify-center ring-2 ring-(--surface) pointer-events-none"
		></span>
	`;

	const button = Button({
		title: t("accessDialogTitle"),
		color: "indigo",
		variant: "square",
		ariaLabel: t("accessDialogTitle"),
		content: html`
			<span class="relative inline-flex items-center justify-center">
				${Icons.user(13)}
			</span>
		`,
		className: cn("relative size-7.5", CAPSULE_BTN),
		onclick: async () => {
			const { openWhitelistDialog } = await import(
				"@/features/auth/whitelist-dialog"
			);
			openWhitelistDialog();
		},
	});
	button.appendChild(badge);

	const setPendingCount = (count: number) => {
		if (count > 0) {
			badge.textContent = count > 99 ? "99+" : String(count);
			badge.classList.remove("hidden");
			badge.classList.add("inline-flex");
			button.title = `${t("accessDialogTitle")} (${t("accessRequestsCount", { n: count })})`;
		} else {
			badge.textContent = "";
			badge.classList.add("hidden");
			badge.classList.remove("inline-flex");
			button.title = t("accessDialogTitle");
		}
	};

	return { button, setPendingCount };
}

/**
 * Initializes the application header.
 */
export function initHeader(container: HTMLElement): () => void {
	const evm = makeEventManager();

	const logo = html`
		<div
			class="flex items-center gap-2.5 group cursor-pointer select-none min-w-0"
			title="${t("appTagline")}"
		>
			<div
				class="size-8.5 rounded-[10px] bg-linear-to-br from-(--accent-solid)/30 via-(--accent-dim) to-(--blue-dim) border border-(--accent-b) flex items-center justify-center text-(--accent) shrink-0 transition-[border-color,box-shadow] duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] group-hover:border-(--accent) group-hover:shadow-[0_0_18px_rgba(130,148,255,0.28)]"
			>
				${Icons.home(16)}
			</div>
			<span class="text-[16px] font-extrabold tracking-[-0.03em] text-(--text) leading-none">
				${t("appName")}
			</span>
			<span class="text-(--border-h) font-light select-none text-sm leading-none">/</span>
			${HealthStatus()}
		</div>
	`;

	evm.add(logo, "click", () => {
		if (window.location.pathname === "/" && !window.location.search) {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} else {
			window.location.href = "/";
		}
	});

	const adminActions = html`<div class="inline-flex items-center gap-0.5 empty:hidden"></div>`;
	const userActions = html`<div class="flex items-center empty:hidden"></div>`;

	const utilityCapsule = html`
		<div
			class="inline-flex items-center gap-0.5 p-1 rounded-full bg-(--surface) border border-(--border) surface-specular"
		>
			${StatsButton()}
			${adminActions}
			<div class="w-px h-3.5 bg-(--border) mx-0.5 shrink-0"></div>
			${LangSwitcher(evm)}
		</div>
	`;

	const header = html`
		<header class="flex items-center justify-between flex-wrap gap-x-3 gap-y-2.5 py-4 sm:py-5 mb-2">
			${logo}
			<div class="flex items-center gap-2 shrink-0 ml-auto">
				${utilityCapsule}
				${userActions}
			</div>
		</header>
	`;

	container.appendChild(header);

	let unsubscribeRequests: (() => void) | null = null;

	const authenticated = isUserAuthenticated();
	const user = getCachedAuthUser();

	if (authenticated && user) {
		if (user.role === "admin") {
			const whitelistBtn = WhitelistButton();
			adminActions.replaceChildren(whitelistBtn.button, ScrapeOpsButton());
			unsubscribeRequests = bus.on(EVENTS.ACCESS_REQUESTS_CHANGED, (count) =>
				whitelistBtn.setPendingCount(count),
			);
			void fetchAccessRequests()
				.then((reqs) => whitelistBtn.setPendingCount(reqs.length))
				.catch(() => {});
		}

		const initial = (user.name || user.email || "U")[0].toUpperCase();
		const fallbackAvatar = () =>
			html`<div class="size-6.5 shrink-0 rounded-full bg-(--accent-dim) text-(--accent) text-[11px] font-bold flex items-center justify-center ring-1 ring-(--accent-b)">${initial}</div>`;

		let avatarEl: HTMLElement;
		if (user.avatar) {
			const img = html`<img src="${user.avatar}" alt="" referrerpolicy="no-referrer" width="26" height="26" class="size-6.5 shrink-0 block rounded-full object-cover ring-1 ring-white/15" />` as HTMLImageElement;
			img.onerror = () => img.replaceWith(fallbackAvatar());
			avatarEl = img;
		} else {
			avatarEl = fallbackAvatar();
		}

		const roleDot =
			user.role === "admin"
				? html`<span class="max-[640px]:hidden text-[10px] font-semibold text-(--accent) tracking-wide">· admin</span>`
				: "";

		const logoutBtn = Button({
			title: "Sign out",
			ariaLabel: "Sign out",
			color: "red",
			variant: "square",
			content: Icons.logOut(13),
			className:
				"size-7 rounded-full border-none bg-transparent text-(--muted) hover:text-(--red) hover:bg-(--red-dim)",
			onclick: () => void logoutUser(),
		});

		const userBlock = html`
			<div
				class="inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full bg-(--surface) border border-(--border) surface-specular"
			>
				<div class="flex items-center gap-2 pr-0.5" title="${user.email}">
					${avatarEl}
					<span class="text-xs font-medium text-(--text) max-w-[130px] truncate max-[640px]:hidden">
						${user.name || user.email.split("@")[0]}
					</span>
					${roleDot}
				</div>
				<div class="w-px h-3.5 bg-(--border) shrink-0"></div>
				${logoutBtn}
			</div>
		`;
		userActions.replaceChildren(userBlock);
	} else {
		const signInBtn = Button({
			id: "header-signin-btn",
			title: t("signIn"),
			ariaLabel: t("signIn"),
			color: "indigo",
			variant: "padded",
			content: html`
				<span class="flex items-center gap-1.5">
					${Icons.logIn(13)}
					<span>${t("signIn")}</span>
				</span>
			`,
			className:
				"h-9.5 px-3.75 rounded-full bg-(--accent-solid) hover:bg-(--accent) border border-(--accent-b) text-white text-xs font-semibold shadow-[0_0_20px_rgba(88,101,242,0.28),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-180",
			onclick: () => openLoginModal("general"),
		});
		userActions.replaceChildren(signInBtn);
	}

	return () => {
		unsubscribeRequests?.();
		evm.cleanup();
		header.remove();
	};
}
