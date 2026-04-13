import { ge, html } from "../core/utils";
import { Dialog } from "../ui/dialog";

export function renderDescModal(root: HTMLElement): void {
	root.appendChild(
		Dialog({
			id: "desc-modal",
			maxWidth: "560px",
			content: html`<div class="p-5 overflow-y-auto max-h-[60vh]">
        <p
          id="desc-body"
          class="text-sm text-(--text-2) leading-[1.75] whitespace-pre-wrap"
        ></p>
      </div>`,
		}),
	);
}

export function openDesc(text: string): void {
	ge("desc-body").textContent = text;
	(ge("desc-modal") as HTMLDialogElement).showModal();
}
