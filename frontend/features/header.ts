import { getLang, setLang, t } from "@/core/i18n";
import { cn, html, makeEventManager } from "@/core/utils";
import { type AuthUser, fetchAuthUser, logoutUser } from "@/features/auth/api";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";
import { HealthStatus } from "./health-status";

let statsInitialized = false;
let scrapeOpsInitialized = false;

function LangSwitcher(evm: ReturnType<typeof makeEventManager>): HTMLElement {
	const cur = getLang();

	const trigger = Button({
		content: html`
			<span class="flex items-center gap-1">
				${cur.toUpperCase()}
				${Icons.chevron({
					size: 10,
					className: "opacity-60 transition-transform group-[.open]:rotate-180",
				})}
			</span>
		`,
		variant: "padded",
		color: "indigo",
		className: "group h-7 px-2 font-bold",
	});

	const dropdown = html`
		<div
			class="absolute right-0 top-full mt-1.5 z-50 min-w-20 rounded-(--r-sm) border border-(--border) bg-(--surface) shadow-xl py-1 hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right"
		>
			${LANGS.map((lang) => {
				const isActive = cur === lang.code;
				const item = html`
					<button
						type="button"
						class="${cn(
							"w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors duration-100",
							isActive
								? "text-(--accent) bg-(--accent-dim)/30"
								: "text-(--muted) hover:text-(--text) hover:bg-(--surface-2)",
						)}"
					>
						${lang.label}
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

const LANGS = [
	{ code: "en" as const, label: "EN" },
	{ code: "az" as const, label: "AZ" },
	{ code: "ru" as const, label: "RU" },
] as const;

function StatsButton(): HTMLButtonElement {
	return Button({
		title: t("districtStats"),
		color: "indigo",
		variant: "square",
		ariaLabel: t("statsBtn"),
		content: Icons.barChart(14),
		className: "size-8",
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
		className: "size-8",
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
		className: "size-8",
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
 * @param container - The parent element to attach the header to.
 * @returns A cleanup function to remove event listeners.
 */
export function initHeader(container: HTMLElement): () => void {
	const evm = makeEventManager();

	const logo = html`
		<div class="flex items-center gap-3 group cursor-pointer select-none">
			<div
				class="w-9 h-9 rounded-(--r) bg-(--accent-dim) border border-(--accent-b)/30 flex items-center justify-center text-(--accent) shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:border-(--accent-b)/60 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]"
			>
				${Icons.home(20)}
			</div>
			<div class="flex flex-col">
				<div class="flex items-center gap-2">
					<span class="text-[15px] font-extrabold tracking-tight text-(--text)">
						${t("appName")}
					</span>
					${HealthStatus()}
				</div>
				<span
					class="text-[10px] font-medium text-(--muted) uppercase tracking-wider max-[480px]:hidden mt-0.5"
				>
					Real Estate Aggregator
				</span>
			</div>
		</div>
	`;

	evm.add(logo, "click", () => {
		if (window.location.pathname === "/" && !window.location.search) {
			window.scrollTo({ top: 0, behavior: "auto" });
		} else {
			window.location.href = "/";
		}
	});

	const adminActions = html`<span></span>`;
	const userActions = html`<span></span>`;
	const header = html`
		<header class="flex items-center justify-between py-4 border-b border-(--border) mb-6">
			${logo}
			<div class="flex items-center gap-2">
				${StatsButton()} ${adminActions}
				<div class="w-px h-4 bg-(--border) mx-1"></div>
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
				? html`<img src="${user.avatar}" alt="${user.name || user.email}" class="size-6 rounded-full object-cover border border-(--border)" />`
				: html`<div class="size-6 rounded-full bg-(--accent-dim) text-(--accent) text-[11px] font-bold flex items-center justify-center">${(user.name || user.email || "U")[0].toUpperCase()}</div>`;

			const roleBadge =
				user.role === "admin"
					? html`<span class="rounded bg-(--accent-dim) px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-(--accent) border border-(--accent-b)/30 uppercase">admin</span>`
					: "";

			const logoutBtn = Button({
				title: "Sign out",
				ariaLabel: "Sign out",
				color: "red",
				variant: "square",
				content: Icons.logOut(13),
				className: "size-8",
				onclick: () => void logoutUser(),
			});

			const userBlock = html`
				<div class="flex items-center gap-1.5 ml-1 pl-2 border-l border-(--border)">
					<div class="flex items-center gap-1.5 px-1 py-0.5" title="${user.email}">
						${avatarEl}
						<span class="text-xs font-semibold text-(--text) max-w-[120px] truncate max-[640px]:hidden">
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
