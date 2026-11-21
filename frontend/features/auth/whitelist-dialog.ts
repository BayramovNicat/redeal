import { t } from "@/core/i18n";
import { html } from "@/core/utils";
import {
	WhitelistManager,
	type WhitelistManagerHandle,
} from "@/features/auth/whitelist-manager";
import { Dialog } from "@/ui/dialog";

let dialogEl: HTMLDialogElement | null = null;
let managerHandle: WhitelistManagerHandle | null = null;

export function initWhitelistDialog(root: HTMLElement): () => void {
	if (dialogEl) return () => {};

	managerHandle = WhitelistManager();
	const content = html`<div class="max-h-[75vh] overflow-y-auto px-1">${managerHandle.element}</div>`;

	dialogEl = Dialog({
		maxWidth: "640px",
		title: t("accessDialogTitle"),
		description: t("accessDialogDesc"),
		content,
	});

	root.appendChild(dialogEl);

	return () => {
		dialogEl?.remove();
		dialogEl = null;
		managerHandle = null;
	};
}

export function openWhitelistDialog(): void {
	if (!dialogEl) {
		const root = document.getElementById("app") as HTMLElement;
		if (root) initWhitelistDialog(root);
	} else {
		void managerHandle?.refresh();
	}
	dialogEl?.showModal();
}
