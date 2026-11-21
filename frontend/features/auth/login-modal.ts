import { t } from "@/core/i18n";
import { fmt, html } from "@/core/utils";
import { Dialog } from "@/ui/dialog";
import { Icons } from "@/ui/icons";

export type LoginPromptReason =
	| "filter"
	| "sort"
	| "alerts"
	| "more"
	| "general";

export interface LoginPromptOptions {
	total?: number;
	limit?: number;
	returnTo?: string;
}

let loginDialog: HTMLDialogElement | null = null;
let subtitleEl: HTMLElement | null = null;
let googleLinkEl: HTMLAnchorElement | null = null;

function createGoogleIcon(): HTMLElement {
	return html`
		<svg class="size-4.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
			/>
			<path
				fill="#FBBC05"
				d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
			/>
		</svg>
	`;
}

function getReasonText(
	reason: LoginPromptReason,
	opts?: LoginPromptOptions,
): string {
	switch (reason) {
		case "filter":
			return t("loginRequiredFilter");
		case "sort":
			return t("loginRequiredSort");
		case "alerts":
			return t("loginRequiredAlerts");
		case "more":
			return t("loginRequiredMore", {
				total: fmt(opts?.total ?? 0),
				limit: opts?.limit ?? 50,
			});
		default:
			return t("loginRequiredGeneral");
	}
}

export function buildGoogleLoginHref(returnTo?: string): string {
	if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
		return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
	}
	return "/api/auth/google";
}

function ensureLoginDialog(): HTMLDialogElement {
	if (loginDialog && document.body.contains(loginDialog)) {
		return loginDialog;
	}

	subtitleEl = html`<p class="text-[13.5px] text-(--text-2) leading-relaxed"></p>`;

	googleLinkEl = html`
		<a
			href="/api/auth/google"
			class="w-full h-11.5 flex items-center justify-center gap-3 rounded-(--r) bg-(--text) text-[#060709] hover:bg-white px-5 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-6px_rgba(255,255,255,0.2)] transition-all duration-180 active:scale-[0.98]"
		>
			${createGoogleIcon()}
			<span>${t("signInWithGoogle")}</span>
		</a>
	` as HTMLAnchorElement;

	const closeTextBtn = html`
		<button
			type="button"
			class="text-xs font-medium text-(--muted) hover:text-(--text) transition-colors py-1"
		>
			${t("continuePreview")}
		</button>
	` as HTMLButtonElement;

	const benefits = [
		t("loginBenefitFilters"),
		t("loginBenefitAll"),
		t("loginBenefitAlerts"),
	];

	const content = html`
		<div class="p-6 sm:p-7 flex flex-col items-center text-center gap-5">
			<div class="flex flex-col items-center gap-3">
				<div
					class="size-12 rounded-2xl bg-linear-to-br from-(--accent-solid)/30 via-(--accent-dim) to-(--blue-dim) border border-(--accent-b) flex items-center justify-center text-(--accent) shadow-[0_0_28px_rgba(88,101,242,0.25),inset_0_1px_0_rgba(255,255,255,0.16)]"
				>
					${Icons.lock(20)}
				</div>
				<div class="space-y-1.5 max-w-sm">
					<h2 class="text-lg font-extrabold tracking-[-0.02em] text-(--text)">
						${t("loginRequiredTitle")}
					</h2>
					${subtitleEl}
				</div>
			</div>

			<ul class="w-full text-left space-y-2 rounded-(--r) border border-(--border) bg-(--surface-2)/60 p-3.5">
				${benefits.map(
					(text) => html`
						<li class="flex items-start gap-2.5 text-xs text-(--text-2) leading-snug">
							<span class="mt-0.5 text-(--green) shrink-0">${Icons.check(13)}</span>
							<span>${text}</span>
						</li>
					`,
				)}
			</ul>

			<div class="w-full flex flex-col items-center gap-2.5">
				${googleLinkEl}
				<p class="text-[11px] text-(--muted)">
					${t("loginWhitelistNote")}
				</p>
				${closeTextBtn}
			</div>
		</div>
	`;

	loginDialog = Dialog({
		id: "login-required-modal",
		maxWidth: "430px",
		showClose: true,
		content,
	});

	closeTextBtn.onclick = () => loginDialog?.close();

	const root = document.getElementById("app") ?? document.body;
	root.appendChild(loginDialog);

	return loginDialog;
}

export function openLoginModal(
	reason: LoginPromptReason = "general",
	opts?: LoginPromptOptions,
): void {
	const dialog = ensureLoginDialog();
	if (subtitleEl) {
		subtitleEl.textContent = getReasonText(reason, opts);
	}
	if (googleLinkEl) {
		googleLinkEl.href = buildGoogleLoginHref(opts?.returnTo);
	}
	if (!dialog.open) {
		dialog.showModal();
	}
}
