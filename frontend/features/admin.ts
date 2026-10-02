import { html } from "@/core/utils";
import { WhitelistManager } from "@/features/auth/whitelist-manager";
import {
	fetchScrapeAdminSession,
	loginScrapeAdmin,
	logoutScrapeAdmin,
} from "@/features/scrape-ops/api";
import { Button } from "@/ui/button";

export function initAdmin(container: HTMLElement): () => void {
	let busy = false;

	const error = html`<div class="hidden rounded-(--r) border border-(--red-b) bg-(--red-dim) px-4 py-3 text-sm text-(--red)"></div>`;
	const password = html`<input
		type="password"
		autocomplete="current-password"
		placeholder="Admin password"
		class="w-full rounded-(--r) border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text) outline-none transition-colors focus:border-(--accent-b)"
	/>` as HTMLInputElement;
	const submit = Button({
		content: "Sign in",
		variant: "base",
		color: "solid",
		className: "w-full justify-center",
	});
	submit.type = "submit";
	const logout = Button({
		content: "Log out",
		variant: "base",
		color: "red",
		className: "w-full justify-center",
	});
	logout.type = "button";
	const signedOutText = html`<p class="text-sm text-(--muted)">Sign in to access scrape ops.</p>`;
	const loadingText = html`<p class="text-sm text-(--muted)">Checking admin session…</p>`;
	const status = html`<p class="text-sm text-(--muted)">Signed in. Scrape Ops is enabled.</p>`;
	signedOutText.hidden = true;
	status.hidden = true;
	password.hidden = true;
	submit.hidden = true;
	logout.hidden = true;
	const whitelistArea = html`<div class="w-full mt-4"></div>`;
	whitelistArea.hidden = true;
	const form = html`
		<form class="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-4 px-5">
			<div class="flex flex-col gap-1 text-center">
				<h1 class="text-2xl font-extrabold text-(--text)">Admin</h1>
				${loadingText}
				${signedOutText}
				${status}
			</div>
			${error}
			${password}
			${submit}
			${whitelistArea}
			${logout}
		</form>
	` as HTMLFormElement;

	const setError = (message: string) => {
		error.textContent = message;
		error.classList.toggle("hidden", !message);
	};
	const setSignedIn = (signedIn: boolean) => {
		loadingText.hidden = true;
		signedOutText.hidden = signedIn;
		status.hidden = !signedIn;
		password.hidden = signedIn;
		submit.hidden = signedIn;
		logout.hidden = !signedIn;
		whitelistArea.hidden = !signedIn;
		if (signedIn) {
			whitelistArea.replaceChildren(WhitelistManager());
		} else {
			whitelistArea.replaceChildren();
		}
	};

	form.onsubmit = async (event) => {
		event.preventDefault();
		if (busy) return;
		busy = true;
		submit.disabled = true;
		setError("");
		try {
			await loginScrapeAdmin(password.value);
			window.location.href = "/";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign in failed");
		} finally {
			busy = false;
			submit.disabled = false;
		}
	};

	logout.onclick = async () => {
		if (busy) return;
		busy = true;
		logout.disabled = true;
		setError("");
		try {
			await logoutScrapeAdmin();
			setSignedIn(false);
			password.focus();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Logout failed");
		} finally {
			busy = false;
			logout.disabled = false;
		}
	};

	container.replaceChildren(form);
	void fetchScrapeAdminSession().then((authenticated) => {
		setSignedIn(authenticated);
		if (!authenticated) password.focus();
	});
	password.focus();

	return () => form.remove();
}
