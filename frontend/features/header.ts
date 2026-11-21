import { getLang, setLang, t } from "@/core/i18n";
import { cn, html, makeEventManager } from "@/core/utils";
import { fetchAuthUser, logoutUser } from "@/features/auth/api";
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

function LangSwitcher(evm: ReturnType<typeof makeEventManager>): HTMLElement {
	const cur = getLang();

	const trigger = Button({
		content: html`
			<span class="flex items-center gap-1.5 font-mono-num tracking-wide">
				${cur.toUpperCase()}
				${Icons.chevron({
					size: 11,
					className: "opacity-60 transition-transform group-[.open]:rotate-180",
				})}
			</span>
		`,
		variant: "padded",
		color: "indigo",
		className: "group h-8.5 px-3 font-semibold rounded-(--r-sm)",
	});

	const dropdown = html`
		<div
			class="absolute right-0 top-full mt-2 z-50 min-w-24 rounded-(--r) border border-(--border-h) glass-panel bg-(--surface-glass-strong) shadow-[var(--shadow-float)] p-1 hidden animate-[fadeUp_0.15s_ease-out] origin-top-right"
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
				${Icons.barChart(14)}
				<span class="max-[640px]:hidden">${t("statsBtn")}</span>
			</span>
		`,
		className: "h-8.5 px-2.5 sm:px-3 rounded-(--r-sm)",
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
		content: Icons.refresh(14),
		className: "size-8.5 rounded-(--r-sm)",
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

function WhitelistButton(): HTMLButtonElement {
	return Button({
		title: "Allowed Accounts",
		color: "indigo",
		variant: "square",
		ariaLabel: "Allowed Accounts",
		content: Icons.user(14),
		className: "size-8.5 rounded-(--r-sm)",
		onclick: async () => {
			const { openWhitelistDialog } = await import(
				"@/features/auth/whitelist-dialog"
			);
			openWhitelistDialog();
		},
	});
}

/**
 * Initializes the application header.
 */
export function initHeader(container: HTMLElement): () => void {
	const evm = makeEventManager();

	const logo = html`
		<div class="flex items-center gap-3 group cursor-pointer select-none min-w-0">
			<div
				class="size-10 rounded-(--r) bg-linear-to-br from-(--accent-solid)/25 via-(--accent-dim) to-(--blue-dim) border border-(--accent-b) flex items-center justify-center text-(--accent) shrink-0 transition-[border-color,box-shadow] duration-250 ease-out shadow-[0_0_24px_rgba(88,101,242,0.18),inset_0_1px_0_rgba(255,255,255,0.12)] group-hover:border-(--accent) group-hover:shadow-[0_0_28px_rgba(130,148,255,0.3)]"
			>
				${Icons.home(19)}
			</div>
			<div class="flex flex-col min-w-0">
				<div class="flex items-center gap-2.5 flex-wrap">
					<span class="text-[17px] font-extrabold tracking-[-0.03em] text-(--text) leading-none">
						${t("appName")}
					</span>
					${HealthStatus()}
				</div>
				<span
					class="text-[11px] font-medium text-(--muted) tracking-tight max-[540px]:hidden mt-1 truncate"
				>
					${t("appTagline")}
				</span>
			</div>
		</div>
	`;

	evm.add(logo, "click", () => {
		if (window.location.pathname === "/" && !window.location.search) {
			window.scrollTo({ top: 0, behavior: "smooth" });
		} else {
			window.location.href = "/";
		}
	});

	const adminActions = html`<div class="inline-flex items-center gap-1.5 empty:hidden"></div>`;
	const userActions = html`<span class="empty:hidden"></span>`;
	const header = html`
		<header class="flex items-center justify-between flex-wrap gap-x-3 gap-y-3 py-4 sm:py-5 mb-5 border-b border-(--border)">
			${logo}
			<div class="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
				<div class="flex items-center gap-1.5">
					${StatsButton()}
					${adminActions}
				</div>
				<div class="w-px h-5 bg-(--border) mx-0.5 shrink-0 max-[420px]:hidden"></div>
				${LangSwitcher(evm)}
				${userActions}
			</div>
		</header>
	`;

	container.appendChild(header);

	void fetchAuthUser().then(({ authenticated, user }) => {
		if (authenticated && user) {
			if (user.role === "admin") {
				adminActions.replaceChildren(WhitelistButton(), ScrapeOpsButton());
			}

			const avatarEl = user.avatar
				? html`<img src="${user.avatar}" alt="${user.name || user.email}" class="size-6.5 rounded-full object-cover border border-(--border-h)" />`
				: html`<div class="size-6.5 rounded-full bg-(--accent-dim) text-(--accent) text-[11px] font-bold flex items-center justify-center border border-(--accent-b)">${(user.name || user.email || "U")[0].toUpperCase()}</div>`;

			const roleBadge =
				user.role === "admin"
					? html`<span class="max-[480px]:hidden rounded-full bg-(--accent-dim) px-1.75 py-0.5 text-[9px] font-bold tracking-wider text-(--accent) border border-(--accent-b) uppercase">admin</span>`
					: "";

			const logoutBtn = Button({
				title: "Sign out",
				ariaLabel: "Sign out",
				color: "red",
				variant: "square",
				content: Icons.logOut(13),
				className: "size-8.5 rounded-(--r-sm)",
				onclick: () => void logoutUser(),
			});

			const userBlock = html`
				<div class="flex items-center gap-1.5 sm:gap-2 ml-0.5 pl-2 border-l border-(--border)">
					<div class="flex items-center gap-2 py-0.5" title="${user.email}">
						${avatarEl}
						<span class="text-xs font-semibold text-(--text) max-w-[130px] truncate max-[640px]:hidden">
							${user.name || user.email.split("@")[0]}
						</span>
						${roleBadge}
					</div>
					${logoutBtn}
				</div>
			`;
			userActions.replaceChildren(userBlock);
		}
	});

	return () => {
		evm.cleanup();
		header.remove();
	};
}
