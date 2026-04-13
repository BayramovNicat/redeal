import { html } from "../core/utils";

const BACKDROP = `
	bg-transparent border-none p-0 
	max-w-screen max-h-screen w-full h-full 
	backdrop:bg-black/78 backdrop:backdrop-blur-sm
`;

const INNER = `
	fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
	flex flex-col overflow-hidden
	bg-(--surface) border border-(--border) rounded-(--r-lg)
	shadow-[0_24px_80px_rgba(0,0,0,0.6)]
`;

export function Dialog({
	id,
	width,
	className = "",
	content,
}: {
	id: string;
	width: string;
	className?: string;
	content: unknown;
}): HTMLDialogElement {
	const el = html<HTMLDialogElement>`
    <dialog id="${id}" class="${BACKDROP}">
      <div class="${INNER} w-[${width}] ${className}">${content}</div>
    </dialog>
  `;

	el.addEventListener("click", (e) => {
		if (e.target === e.currentTarget) el.close();
	});

	return el;
}
