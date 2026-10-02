import { html } from "@/core/utils";
import {
	addWhitelistEmail,
	fetchWhitelist,
	removeWhitelistEmail,
	type WhitelistItem,
} from "@/features/auth/api";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";

export function WhitelistManager(): HTMLElement {
	const container = html`
		<div class="w-full flex flex-col gap-5 rounded-xl border border-(--border) bg-(--surface) p-6 shadow-sm mt-6">
			<div class="flex items-center justify-between border-b border-(--border) pb-4">
				<div>
					<h2 class="text-lg font-bold text-(--text)">Allowed Google Accounts</h2>
					<p class="text-xs text-(--muted) mt-0.5">
						Only whitelisted Google emails can access this application.
					</p>
				</div>
				<span class="rounded-full bg-(--accent-dim) px-2.5 py-1 text-xs font-semibold text-(--accent)" id="whitelist-count">
					Loading…
				</span>
			</div>

			<!-- Add Email Form -->
			<form class="flex flex-col sm:flex-row gap-2.5" id="add-email-form">
				<input
					type="email"
					required
					placeholder="Google email (e.g. user@gmail.com)"
					id="new-email-input"
					class="flex-1 rounded-(--r) border border-(--border) bg-(--surface-2) px-3.5 py-2 text-xs text-(--text) outline-none transition-colors focus:border-(--accent-b)"
				/>
				<input
					type="text"
					placeholder="Optional note / name"
					id="new-note-input"
					class="sm:w-44 rounded-(--r) border border-(--border) bg-(--surface-2) px-3.5 py-2 text-xs text-(--text) outline-none transition-colors focus:border-(--accent-b)"
				/>
				<button
					type="submit"
					id="add-email-btn"
					class="flex items-center justify-center gap-1.5 rounded-(--r) bg-(--accent) hover:bg-(--accent-hover) px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
				>
					Add Email
				</button>
			</form>

			<div id="whitelist-feedback" class="hidden text-xs py-1.5 px-3 rounded-(--r)"></div>

			<!-- Whitelist Items List -->
			<div class="flex flex-col gap-2" id="whitelist-list">
				<div class="py-4 text-center text-xs text-(--muted)">Loading whitelist…</div>
			</div>
		</div>
	` as HTMLElement;

	const countBadge = container.querySelector("#whitelist-count") as HTMLElement;
	const form = container.querySelector("#add-email-form") as HTMLFormElement;
	const emailInput = container.querySelector(
		"#new-email-input",
	) as HTMLInputElement;
	const noteInput = container.querySelector(
		"#new-note-input",
	) as HTMLInputElement;
	const submitBtn = container.querySelector(
		"#add-email-btn",
	) as HTMLButtonElement;
	const feedback = container.querySelector(
		"#whitelist-feedback",
	) as HTMLElement;
	const list = container.querySelector("#whitelist-list") as HTMLElement;

	function showFeedback(msg: string, isError = false) {
		feedback.textContent = msg;
		feedback.className = `text-xs py-2 px-3 rounded-(--r) ${
			isError
				? "border border-(--red-b) bg-(--red-dim) text-(--red)"
				: "border border-(--accent-b)/30 bg-(--accent-dim) text-(--accent)"
		}`;
		feedback.classList.remove("hidden");
		setTimeout(() => {
			feedback.classList.add("hidden");
		}, 4000);
	}

	async function refreshList() {
		try {
			const items = await fetchWhitelist();
			countBadge.textContent = `${items.length} accounts`;

			if (items.length === 0) {
				list.innerHTML = `
					<div class="rounded-lg border border-dashed border-(--border) py-8 text-center text-xs text-(--muted)">
						No emails on whitelist yet. Add one above to grant access.
					</div>
				`;
				return;
			}

			list.replaceChildren(
				...items.map((item: WhitelistItem) => {
					const row = html`
						<div class="flex items-center justify-between gap-3 rounded-lg border border-(--border)/70 bg-(--surface-2)/40 px-3.5 py-2.5 transition-colors hover:bg-(--surface-2)">
							<div class="flex flex-col min-w-0">
								<span class="text-xs font-bold text-(--text) truncate">${item.email}</span>
								<div class="flex items-center gap-2 text-[10px] text-(--muted) mt-0.5">
									${item.note ? html`<span class="text-(--accent) font-medium">${item.note}</span><span>•</span>` : ""}
									<span>Added ${new Date(item.created_at).toLocaleDateString()}</span>
								</div>
							</div>
						</div>
					`;

					const deleteBtn = Button({
						title: `Remove ${item.email}`,
						color: "red",
						variant: "square",
						content: Icons.trash(12),
						className: "size-7 shrink-0",
						onclick: async () => {
							if (
								!confirm(
									`Remove "${item.email}" from whitelist? They will immediately lose access.`,
								)
							) {
								return;
							}
							deleteBtn.disabled = true;
							try {
								await removeWhitelistEmail(item.email);
								showFeedback(`Removed ${item.email}`);
								await refreshList();
							} catch (err) {
								showFeedback(
									err instanceof Error ? err.message : "Failed to remove",
									true,
								);
								deleteBtn.disabled = false;
							}
						},
					});

					row.appendChild(deleteBtn);
					return row;
				}),
			);
		} catch (err) {
			list.innerHTML = `
				<div class="text-xs text-(--red) py-2">
					Failed to load whitelist: ${err instanceof Error ? err.message : "Network error"}
				</div>
			`;
		}
	}

	form.onsubmit = async (e) => {
		e.preventDefault();
		const email = emailInput.value.trim().toLowerCase();
		const note = noteInput.value.trim();
		if (!email) return;

		submitBtn.disabled = true;
		try {
			await addWhitelistEmail(email, note || undefined);
			showFeedback(`Added ${email} to whitelist`);
			emailInput.value = "";
			noteInput.value = "";
			await refreshList();
		} catch (err) {
			showFeedback(
				err instanceof Error ? err.message : "Failed to add email",
				true,
			);
		} finally {
			submitBtn.disabled = false;
		}
	};

	void refreshList();
	return container;
}
