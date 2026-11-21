import { bus, EVENTS } from "@/core/events";
import { t } from "@/core/i18n";
import { cn, html, timeAgo } from "@/core/utils";
import {
	type AccessRequestItem,
	addWhitelistEmail,
	approveAccessRequestApi,
	dismissAccessRequestApi,
	fetchAccessRequests,
	fetchWhitelist,
	removeWhitelistEmail,
	type WhitelistItem,
} from "@/features/auth/api";
import { Button } from "@/ui/button";
import { Icons } from "@/ui/icons";

export interface WhitelistManagerHandle {
	element: HTMLElement;
	refresh: () => Promise<void>;
}

function renderAvatar(
	avatar: string | null | undefined,
	label: string,
): HTMLElement {
	if (avatar) {
		return html`
			<img
				src="${avatar}"
				alt="${label}"
				referrerpolicy="no-referrer"
				class="size-8 rounded-full object-cover ring-1 ring-white/15 shrink-0"
			/>
		`;
	}
	const initial = (label || "U")[0]?.toUpperCase() ?? "U";
	return html`
		<div
			class="size-8 rounded-full bg-(--yellow-dim) text-(--yellow) text-xs font-bold flex items-center justify-center ring-1 ring-(--yellow-b) shrink-0"
		>
			${initial}
		</div>
	`;
}

export function WhitelistManager(): WhitelistManagerHandle {
	const requestsBadge = html`
		<span
			class="rounded-full bg-(--surface-2) border border-(--border) px-2.5 py-1 text-[11px] font-semibold font-mono-num text-(--muted)"
		>
			…
		</span>
	`;

	const requestsList = html`
		<div class="flex flex-col gap-2">
			<div class="py-3 text-center text-xs text-(--muted)">
				${t("accessRequestsLoading")}
			</div>
		</div>
	`;

	const countBadge = html`
		<span
			class="rounded-full bg-(--accent-dim) border border-(--accent-b) px-2.5 py-1 text-[11px] font-semibold font-mono-num text-(--accent)"
		>
			…
		</span>
	`;

	const emailInput = html`
		<input
			type="email"
			required
			placeholder="${t("whitelistEmailPlaceholder")}"
			class="flex-1 h-9.5 rounded-(--r-sm) border border-(--border) bg-(--surface-2) px-3 text-xs text-(--text) placeholder:text-(--muted) outline-none transition-all focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-dim)]"
		/>
	` as HTMLInputElement;

	const noteInput = html`
		<input
			type="text"
			placeholder="${t("whitelistNotePlaceholder")}"
			class="sm:w-44 h-9.5 rounded-(--r-sm) border border-(--border) bg-(--surface-2) px-3 text-xs text-(--text) placeholder:text-(--muted) outline-none transition-all focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-dim)]"
		/>
	` as HTMLInputElement;

	const submitBtn = html`
		<button
			type="submit"
			class="flex items-center justify-center gap-1.5 h-9.5 rounded-(--r-sm) bg-(--accent-solid) hover:bg-(--accent-hover) px-4 text-xs font-semibold text-white transition-all disabled:opacity-50"
		>
			${t("whitelistAddBtn")}
		</button>
	` as HTMLButtonElement;

	const form = html`
		<form class="flex flex-col sm:flex-row gap-2.5">
			${emailInput}
			${noteInput}
			${submitBtn}
		</form>
	` as HTMLFormElement;

	const feedback = html`
		<div class="hidden text-xs py-2 px-3 rounded-(--r)"></div>
	`;

	const list = html`
		<div class="flex flex-col gap-2">
			<div class="py-4 text-center text-xs text-(--muted)">
				${t("whitelistLoading")}
			</div>
		</div>
	`;

	const container = html`
		<div class="w-full flex flex-col gap-6 p-6">
			${feedback}

			<!-- Pending Sign-in Requests Section -->
			<section class="flex flex-col gap-3.5">
				<div class="flex items-center justify-between gap-3 border-b border-(--border) pb-3.5">
					<div>
						<h2 class="text-sm font-bold text-(--text)">
							${t("accessRequestsTitle")}
						</h2>
						<p class="text-xs text-(--muted) mt-0.5">
							${t("accessRequestsSubtitle")}
						</p>
					</div>
					${requestsBadge}
				</div>
				${requestsList}
			</section>

			<!-- Whitelisted Accounts Section -->
			<section class="flex flex-col gap-4">
				<div class="flex items-center justify-between gap-3 border-b border-(--border) pb-3.5">
					<div>
						<h2 class="text-sm font-bold text-(--text)">
							${t("whitelistTitle")}
						</h2>
						<p class="text-xs text-(--muted) mt-0.5">
							${t("whitelistSubtitle")}
						</p>
					</div>
					${countBadge}
				</div>

				${form}
				${list}
			</section>
		</div>
	`;

	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	function showFeedback(msg: string, isError = false) {
		feedback.textContent = msg;
		feedback.className = cn(
			"text-xs py-2 px-3 rounded-(--r)",
			isError
				? "border border-(--red-b) bg-(--red-dim) text-(--red)"
				: "border border-(--green-b) bg-(--green-dim) text-(--green)",
		);
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => {
			feedback.classList.add("hidden");
		}, 4000);
	}

	async function refreshRequests() {
		try {
			const items = await fetchAccessRequests();
			bus.emit(EVENTS.ACCESS_REQUESTS_CHANGED, items.length);

			requestsBadge.textContent = t("accessRequestsCount", { n: items.length });
			requestsBadge.className = cn(
				"rounded-full border px-2.5 py-1 text-[11px] font-semibold font-mono-num shrink-0",
				items.length > 0
					? "bg-(--yellow-dim) border-(--yellow-b) text-(--yellow)"
					: "bg-(--surface-2) border-(--border) text-(--muted)",
			);

			if (items.length === 0) {
				requestsList.replaceChildren(
					html`
						<div class="rounded-lg border border-dashed border-(--border) py-4 text-center text-xs text-(--muted)">
							${t("accessRequestsEmpty")}
						</div>
					`,
				);
				return;
			}

			requestsList.replaceChildren(
				...items.map((item: AccessRequestItem) => {
					const label = item.name || item.email;
					const ago =
						timeAgo(item.last_attempt_at) ??
						new Date(item.last_attempt_at).toLocaleDateString();

					const approveBtn = Button({
						title: `${t("accessApprove")} ${item.email}`,
						color: "green",
						variant: "padded",
						content: html`
							<span class="flex items-center gap-1">
								${Icons.check(12)}
								<span>${t("accessApprove")}</span>
							</span>
						`,
						className: "h-7.5 px-2.5 shrink-0 font-semibold",
						onclick: async () => {
							approveBtn.disabled = true;
							dismissBtn.disabled = true;
							try {
								await approveAccessRequestApi(
									item.email,
									item.name || undefined,
								);
								showFeedback(
									t("accessApprovedFeedback", { email: item.email }),
								);
								await refreshAll();
							} catch (err) {
								showFeedback(
									err instanceof Error ? err.message : "Failed to approve",
									true,
								);
								approveBtn.disabled = false;
								dismissBtn.disabled = false;
							}
						},
					});

					const dismissBtn = Button({
						title: `${t("accessDismiss")} ${item.email}`,
						ariaLabel: `${t("accessDismiss")} ${item.email}`,
						color: "red",
						variant: "square",
						content: Icons.close(12),
						className: "size-7.5 shrink-0",
						onclick: async () => {
							approveBtn.disabled = true;
							dismissBtn.disabled = true;
							try {
								await dismissAccessRequestApi(item.email);
								showFeedback(
									t("accessDismissedFeedback", { email: item.email }),
								);
								await refreshRequests();
							} catch (err) {
								showFeedback(
									err instanceof Error ? err.message : "Failed to dismiss",
									true,
								);
								approveBtn.disabled = false;
								dismissBtn.disabled = false;
							}
						},
					});

					return html`
						<div class="flex items-center justify-between gap-3 rounded-lg border border-(--yellow-b)/45 bg-(--yellow-dim)/35 px-3.5 py-2.5 transition-colors hover:bg-(--yellow-dim)/55">
							<div class="flex items-center gap-3 min-w-0">
								${renderAvatar(item.avatar, label)}
								<div class="flex flex-col min-w-0">
									<div class="flex items-center gap-1.5 min-w-0">
										${
											item.name
												? html`<span class="text-xs font-bold text-(--text) truncate">${item.name}</span>`
												: ""
										}
										<span class="${cn(
											"text-xs truncate",
											item.name ? "text-(--text-2)" : "font-bold text-(--text)",
										)}">
											${item.email}
										</span>
									</div>
									<div class="flex items-center gap-2 text-[10px] text-(--muted) mt-0.5">
										<span>${ago}</span>
										${
											item.attempts > 1
												? html`<span>•</span><span class="text-(--yellow) font-medium">${t("accessAttemptCount", { n: item.attempts })}</span>`
												: ""
										}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-1.5 shrink-0">
								${approveBtn}
								${dismissBtn}
							</div>
						</div>
					`;
				}),
			);
		} catch (err) {
			requestsList.replaceChildren(
				html`
					<div class="text-xs text-(--red) py-2">
						${t("accessRequestsLoadError")}: ${err instanceof Error ? err.message : "Network error"}
					</div>
				`,
			);
		}
	}

	async function refreshWhitelist() {
		try {
			const items = await fetchWhitelist();
			countBadge.textContent = t("whitelistCount", { n: items.length });

			if (items.length === 0) {
				list.replaceChildren(
					html`
						<div class="rounded-lg border border-dashed border-(--border) py-8 text-center text-xs text-(--muted)">
							${t("whitelistEmpty")}
						</div>
					`,
				);
				return;
			}

			list.replaceChildren(
				...items.map((item: WhitelistItem) => {
					const deleteBtn = Button({
						title: `${t("btnDelete")} ${item.email}`,
						ariaLabel: `${t("btnDelete")} ${item.email}`,
						color: "red",
						variant: "square",
						content: Icons.trash(12),
						className: "size-7 shrink-0",
						onclick: async () => {
							if (
								!confirm(t("whitelistConfirmRemove", { email: item.email }))
							) {
								return;
							}
							deleteBtn.disabled = true;
							try {
								await removeWhitelistEmail(item.email);
								showFeedback(
									t("whitelistRemovedFeedback", { email: item.email }),
								);
								await refreshWhitelist();
							} catch (err) {
								showFeedback(
									err instanceof Error ? err.message : "Failed to remove",
									true,
								);
								deleteBtn.disabled = false;
							}
						},
					});

					const addedDate = new Date(item.created_at).toLocaleDateString();

					return html`
						<div class="flex items-center justify-between gap-3 rounded-lg border border-(--border)/70 bg-(--surface-2)/40 px-3.5 py-2.5 transition-colors hover:bg-(--surface-2)">
							<div class="flex flex-col min-w-0">
								<span class="text-xs font-bold text-(--text) truncate">${item.email}</span>
								<div class="flex items-center gap-2 text-[10px] text-(--muted) mt-0.5">
									${item.note ? html`<span class="text-(--accent) font-medium">${item.note}</span><span>•</span>` : ""}
									<span>${t("whitelistAddedDate", { date: addedDate })}</span>
								</div>
							</div>
							${deleteBtn}
						</div>
					`;
				}),
			);
		} catch (err) {
			list.replaceChildren(
				html`
					<div class="text-xs text-(--red) py-2">
						${t("whitelistLoadError")}: ${err instanceof Error ? err.message : "Network error"}
					</div>
				`,
			);
		}
	}

	async function refreshAll() {
		await Promise.all([refreshRequests(), refreshWhitelist()]);
	}

	form.onsubmit = async (e) => {
		e.preventDefault();
		const email = emailInput.value.trim().toLowerCase();
		const note = noteInput.value.trim();
		if (!email) return;

		submitBtn.disabled = true;
		try {
			await addWhitelistEmail(email, note || undefined);
			showFeedback(t("whitelistAddedFeedback", { email }));
			emailInput.value = "";
			noteInput.value = "";
			await refreshAll();
		} catch (err) {
			showFeedback(
				err instanceof Error ? err.message : "Failed to add email",
				true,
			);
		} finally {
			submitBtn.disabled = false;
		}
	};

	void refreshAll();
	return { element: container, refresh: refreshAll };
}
