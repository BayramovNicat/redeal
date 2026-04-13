import type { Alert, AlertFilters } from "../core/types";
import { ge, html } from "../core/utils";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Icons } from "../ui/icons";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * Renders the initial shell of the Alert modal
 */
export function renderAlertModal(root: HTMLElement): void {
	const modal = Dialog({
		id: "alert-modal",
		width: "min(440px,calc(100vw-2rem))",
		className: "p-6",
		content: html`<div>
      <div class="text-base font-semibold text-(--text) mb-4">
        Telegram alerts
      </div>

      <div id="alert-list" class="mb-4 hidden">
        <div
          class="text-xs font-semibold text-(--muted) uppercase tracking-[0.05em] mb-2"
        >
          Active alerts
        </div>
        <div id="alert-list-items" class="flex flex-col gap-6"></div>
        <div class="h-px bg-(--border) my-4"></div>
      </div>

      <div class="text-xs text-(--muted) leading-[1.6] mb-3.5">
        Open
        <a
          href="https://t.me/BakuDealsBot"
          target="_blank"
          rel="noopener"
          class="text-(--blue)"
          >@BakuDealsBot</a
        >
        and send
        <code class="bg-(--surface-3) px-1 py-0.5 rounded-sm">/start</code> to get
        your Chat ID.
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          ${Label({ htmlFor: "alert-chat-id", text: "Telegram Chat ID" })}
          ${Input({
						id: "alert-chat-id",
						placeholder: "e.g. 123456789",
						className: "w-full",
						attrs: { inputmode: "numeric" },
					})}
        </div>
        <div class="flex flex-col gap-1.5">
          ${Label({ htmlFor: "alert-label", text: "Label (optional)" })}
          ${Input({
						id: "alert-label",
						placeholder: "e.g. 2BR Nərimanov",
						className: "w-full",
						attrs: { maxlength: "80" },
					})}
        </div>
        <div
          class="text-xs text-(--muted) bg-(--surface-2) border border-(--border) rounded-sm px-2.5 py-2"
          id="alert-filter-preview"
        ></div>
        <div class="flex gap-2 justify-end mt-1">
          ${Button({
						id: "alert-cancel",
						content: "Cancel",
						variant: "base",
						color: "indigo",
					})}
          ${Button({
						id: "alert-save",
						content: "Save alert",
						variant: "base",
						color: "solid",
					})}
        </div>
      </div>
    </div> `,
	});

	root.appendChild(modal);
}

/**
 * Updates the alerts list in the modal
 */
export function updateAlertList(
	alerts: Alert[],
	onDelete?: (token: string, row: HTMLElement) => void,
): void {
	const listEl = ge("alert-list");
	const itemsEl = ge("alert-list-items");
	if (!listEl || !itemsEl) return;

	if (!alerts || alerts.length === 0) {
		listEl.style.display = "none";
		return;
	}

	listEl.style.display = "block";
	itemsEl.innerHTML = "";

	for (const a of alerts) {
		const preview = buildFilterPreview({
			...(a.filters ?? {}),
			location: a.filters?.location ?? "",
			threshold: a.filters?.threshold ?? 10,
		});

		const row = html`<div
      class="flex items-center gap-2 bg-(--surface-2) border border-(--border) rounded-md px-2.5 py-2 transition-all"
    >
      <div class="flex-1 min-w-0">
        <div
          class="text-[12px] font-semibold text-(--text) whitespace-nowrap overflow-hidden text-ellipsis"
        >
          ${a.label ?? "Unnamed"}
        </div>
        <div
          class="text-[11px] text-(--muted) mt-px whitespace-nowrap overflow-hidden text-ellipsis"
        >
          ${preview}
        </div>
      </div>

      ${Button({
				content: Icons.trash(),
				variant: "ghost",
				color: "red",
				title: "Delete alert",
				className: "shrink-0",
			})}
    </div>`;

		const delBtn = row.querySelector("button");
		if (delBtn && onDelete) {
			delBtn.addEventListener("click", () => onDelete(a.token, row));
		}
		itemsEl.appendChild(row);
	}
}

/**
 * Formats filters into a short preview string
 */
export function buildFilterPreview(f: AlertFilters): string {
	const parts = [
		`📍 ${f.location === "__all__" ? "All locations" : f.location}`,
		`📉 ≥${f.threshold}% below avg`,
	];
	if (f.minPrice || f.maxPrice)
		parts.push(`₼ ${f.minPrice ?? ""}-${f.maxPrice ?? ""}`);
	if (f.minRooms || f.maxRooms)
		parts.push(`${f.minRooms ?? ""}-${f.maxRooms ?? ""} rooms`);
	if (f.minArea || f.maxArea)
		parts.push(`${f.minArea ?? ""}-${f.maxArea ?? ""}m²`);
	if (f.hasRepair) parts.push("Repaired");
	if (f.hasDocument) parts.push("Document");
	if (f.isUrgent) parts.push("Urgent");
	if (f.hasActiveMortgage === false) parts.push("No active mortgage");
	return parts.join(" · ");
}
