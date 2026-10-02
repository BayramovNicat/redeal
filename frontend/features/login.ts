import { html } from "@/core/utils";
import { Icons } from "@/ui/icons";

export function initLogin(container: HTMLElement): () => void {
	const params = new URLSearchParams(window.location.search);
	const errorType = params.get("error");
	const deniedEmail = params.get("email");

	let errorMessage = "";
	let errorTitle = "";

	if (errorType === "not_whitelisted") {
		errorTitle = "Access Denied";
		errorMessage = deniedEmail
			? `The Google account "${deniedEmail}" is not on the whitelist. Access to redeal is restricted to authorized accounts.`
			: "Your Google account is not on the whitelist. Please contact the administrator to request access.";
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

	const errorBox = errorMessage
		? html`
			<div class="w-full rounded-(--r) border border-(--red-b) bg-(--red-dim) p-4 text-left animate-in fade-in zoom-in-95 duration-200">
				<div class="flex items-start gap-3">
					<div class="mt-0.5 text-(--red) shrink-0">
						<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
					<div class="flex flex-col gap-1 text-sm">
						<span class="font-bold text-(--red)">${errorTitle}</span>
						<p class="text-(--text) opacity-90 leading-relaxed text-xs">
							${errorMessage}
						</p>
					</div>
				</div>
			</div>
		`
		: "";

	const googleIcon = html`
		<svg class="size-5 shrink-0" viewBox="0 0 24 24">
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
		<div class="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-12">
			<div class="w-full rounded-2xl border border-(--border) bg-(--surface) p-8 shadow-2xl flex flex-col items-center text-center gap-6 backdrop-blur-md">
				<!-- Brand Header -->
				<div class="flex flex-col items-center gap-3">
					<div
						class="w-14 h-14 rounded-2xl bg-(--accent-dim) border border-(--accent-b)/40 flex items-center justify-center text-(--accent) shadow-[0_0_25px_rgba(99,102,241,0.2)]"
					>
						${Icons.home(28)}
					</div>
					<div>
						<h1 class="text-2xl font-extrabold tracking-tight text-(--text)">
							redeal
						</h1>
						<p class="text-xs font-semibold text-(--muted) uppercase tracking-widest mt-0.5">
							Baku Real Estate Aggregator
						</p>
					</div>
				</div>

				<!-- Whitelist Notice -->
				<div class="rounded-lg border border-(--border)/60 bg-(--surface-2)/60 px-3.5 py-2 text-xs text-(--muted)">
					<span class="inline-block size-1.5 rounded-full bg-(--accent) mr-1.5 align-middle"></span>
					Private Preview • Whitelist Only
				</div>

				<!-- Description -->
				<p class="text-sm text-(--muted) leading-relaxed">
					Sign in with your approved Google account to analyze undervalued real estate deals and trends.
				</p>

				${errorBox}

				<!-- Sign in Button -->
				<a
					href="/api/auth/google"
					class="w-full flex items-center justify-center gap-3 rounded-(--r) border border-(--border) bg-(--surface-2) hover:bg-(--surface-3) px-5 py-3.5 text-sm font-semibold text-(--text) transition-all duration-200 hover:border-(--accent-b)/60 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] active:scale-[0.98]"
				>
					${googleIcon}
					<span>Continue with Google</span>
				</a>

				<!-- Footer note -->
				<p class="text-[11px] text-(--muted)/80 leading-normal">
					Accounts not on the whitelist will be denied access automatically.
				</p>
			</div>
		</div>
	`;

	container.replaceChildren(loginCard);

	return () => {
		loginCard.remove();
	};
}
