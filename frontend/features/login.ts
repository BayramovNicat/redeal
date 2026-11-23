import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import { buildGoogleLoginHref } from "@/features/auth/api";
import { Icons } from "@/ui/icons";

export function initLogin(container: HTMLElement): () => void {
	const params = new URLSearchParams(window.location.search);
	const errorType = params.get("error");
	const deniedEmail = params.get("email");
	const returnTo = params.get("returnTo") ?? undefined;
	const googleHref = buildGoogleLoginHref(returnTo);

	let errorMessage = "";
	let errorTitle = "";
	let isPendingNotice = false;

	if (errorType === "not_whitelisted") {
		isPendingNotice = true;
		errorTitle = t("loginRequestPendingTitle");
		errorMessage = deniedEmail
			? t("loginRequestPendingMsg", { email: deniedEmail })
			: t("loginRequestPendingMsgGeneric");
	} else if (errorType === "missing_config") {
		errorTitle = "Google OAuth Not Configured";
		errorMessage =
			"Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) have not been configured on this server yet.";
	} else if (errorType === "oauth_failed") {
		errorTitle = "Sign-in Failed";
		errorMessage =
			"Google authentication was canceled or encountered an unexpected error. Please try again.";
	} else if (errorType === "invalid_state") {
		errorTitle = "Session Expired";
		errorMessage = "The sign-in state expired. Please try signing in again.";
	} else if (errorType) {
		errorTitle = "Authentication Error";
		errorMessage = "An error occurred during authentication. Please try again.";
	}

	const noticeBoxClass = isPendingNotice
		? "border-(--yellow-b) bg-(--yellow-dim)"
		: "border-(--red-b) bg-(--red-dim)";
	const noticeToneClass = isPendingNotice ? "text-(--yellow)" : "text-(--red)";

	const errorBox = errorMessage
		? html`
			<div class="w-full rounded-(--r) border ${noticeBoxClass} p-3.75 text-left animate-[fadeUp_0.2s_ease-out]">
				<div class="flex items-start gap-3">
					<div class="mt-0.5 ${noticeToneClass} shrink-0">
						<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
					<div class="flex flex-col gap-0.75 text-sm">
						<span class="font-bold ${noticeToneClass} text-[13px]">${errorTitle}</span>
						<p class="text-(--text)/90 leading-relaxed text-xs">
							${errorMessage}
						</p>
					</div>
				</div>
			</div>
		`
		: "";

	const googleIcon = html`
		<svg class="size-4.5 shrink-0" viewBox="0 0 24 24">
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

	const loginCard = html`
		<div class="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center px-5 py-12">
			<div class="w-full rounded-(--r-xl) border border-(--border-h) glass-panel bg-(--surface-glass-strong) p-8 sm:p-9 shadow-[var(--shadow-float)] flex flex-col items-center text-center gap-6">
				<!-- Brand Header -->
				<div class="flex flex-col items-center gap-3.5">
					<div
						class="size-14 rounded-2xl bg-linear-to-br from-(--accent-solid)/30 via-(--accent-dim) to-(--blue-dim) border border-(--accent-b) flex items-center justify-center text-(--accent) shadow-[0_0_32px_rgba(88,101,242,0.28),inset_0_1px_0_rgba(255,255,255,0.16)]"
					>
						${Icons.home(26)}
					</div>
					<div>
						<h1 class="text-2xl font-extrabold tracking-[-0.03em] text-(--text)">
							Redeal
						</h1>
						<p class="text-[11px] font-semibold text-(--muted) uppercase tracking-[0.14em] mt-1">
							Baku Real Estate Intelligence
						</p>
					</div>
				</div>

				<!-- Whitelist Notice -->
				<div class="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--surface-2)/80 px-3.5 py-1.5 text-[11px] font-medium text-(--text-2)">
					<span class="size-1.5 rounded-full bg-(--accent) shadow-[0_0_8px_var(--accent)]"></span>
					Private Access • Whitelist Only
				</div>

				<!-- Description -->
				<p class="text-[13.5px] text-(--text-2) leading-relaxed max-w-xs">
					Sign in with your approved Google account to track undervalued listings and district price trends.
				</p>

				${errorBox}

				<!-- Sign in Button -->
				<a
					href="${googleHref}"
					class="w-full h-12 flex items-center justify-center gap-3 rounded-(--r) bg-(--text) text-[#060709] hover:bg-white px-5 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-6px_rgba(255,255,255,0.2)] transition-all duration-180 active:scale-[0.98]"
				>
					${googleIcon}
					<span>${t("signInWithGoogle")}</span>
				</a>

				<!-- Footer note -->
				<div class="flex flex-col items-center gap-2.5">
					<p class="text-[11px] text-(--muted) leading-normal">
						${t("loginFooterRequestNote")}
					</p>
					<a
						href="/"
						class="inline-flex items-center gap-1.5 text-xs font-medium text-(--text-2) hover:text-(--text) transition-colors"
					>
						${Icons.chevronLeft(13)}
						<span>${t("backToPreview")}</span>
					</a>
				</div>
			</div>
		</div>
	`;

	container.replaceChildren(loginCard);

	return () => {
		loginCard.remove();
	};
}
