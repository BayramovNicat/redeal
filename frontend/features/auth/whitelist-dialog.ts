import { html } from "@/core/utils";
import { WhitelistManager } from "@/features/auth/whitelist-manager";
import { Dialog } from "@/ui/dialog";

let dialogEl: HTMLDialogElement | null = null;

export function initWhitelistDialog(root: HTMLElement): () => void {
	if (dialogEl) return () => {};

	const content = html`<div class="max-h-[70vh] overflow-y-auto px-1">${WhitelistManager()}</div>`;

	dialogEl = Dialog({
		maxWidth: "600px",
		title: "Access Whitelist",
		description: "Manage Google accounts approved to access redeal.",
		content,
	});

	root.appendChild(dialogEl);

	return () => {
		dialogEl?.remove();
		dialogEl = null;
	};
}

export function openWhitelistDialog(): void {
	if (!dialogEl) {
		const root = document.getElementById("app") as HTMLElement;
		if (root) initWhitelistDialog(root);
	}
	dialogEl?.showModal();
}
