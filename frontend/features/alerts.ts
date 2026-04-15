import { bus, EVENTS } from "../core/events";
import { t } from "../core/i18n";
import type { Alert, AlertFilters } from "../core/types";
import { ge, html, toast } from "../core/utils";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Icons } from "../ui/icons";
import { Input } from "../ui/input";
import type { MultiSelectElement } from "../ui/multi-select";

export function initAlerts(root: HTMLElement): () => void {
	// 1. Create UI Elements
	const chatIdInput = Input({
		id: "alert-chat-id",
		placeholder: t("chatIdPlaceholder"),
		className: "w-full",
		attrs: { inputmode: "numeric" },
	});

	const labelInput = Input({
		id: "alert-label",
		placeholder: t("alertLabelPlaceholder"),
		className: "w-full",
		attrs: { maxlength: "80" },
	});

	const previewEl = html`<div class="text-xs text-(--muted) bg-(--surface-2) border border-(--border) rounded-sm px-2.5 py-2"></div>`;
	const listEl = html`<div class="mb-4 hidden"></div>`;
	const itemsEl = html`<div class="flex flex-col gap-6"></div>`;

	listEl.append(
		html`<div class="text-xs font-semibold text-(--muted) uppercase tracking-[0.05em] mb-2">${t("activeAlerts")}</div>`,
		itemsEl,
		html`<div class="h-px bg-(--border) my-4"></div>`,
	);

	const cancelBtn = Button({
		content: t("cancel"),
		variant: "base",
		color: "indigo",
	});

	const saveBtn = Button({
		content: t("saveAlert"),
		variant: "base",
		color: "solid",
	});

	const modal = Dialog({
		id: "alert-modal",
		maxWidth: "440px",
		className: "p-6",
		content: html`
      <div>
        <div class="text-base font-semibold text-(--text) mb-4">${t("telegramAlerts")}</div>
        ${listEl}
        <div class="text-xs text-(--muted) leading-[1.6] mb-3.5">
          ${t("botInstruction", {
						bot: '<a href="https://t.me/BakuDealsBot" target="_blank" rel="noopener" class="text-(--blue)">@BakuDealsBot</a>',
						start:
							'<code class="bg-(--surface-3) px-1 py-0.5 rounded-sm">/start</code>',
					})}
        </div>
        <div class="flex flex-col gap-3">
          ${Field({ htmlFor: "alert-chat-id", label: t("chatIdLabel"), input: chatIdInput })}
          ${Field({ htmlFor: "alert-label", label: t("alertLabel"), input: labelInput })}
          ${previewEl}
          <div class="flex gap-2 justify-end mt-1">
            ${cancelBtn}
            ${saveBtn}
          </div>
        </div>
      </div>
    `,
	});

	root.appendChild(modal);

	const trigger = ge("alert-btn");

	// 2. Logic Handlers
	const handleOpen = () => {
		const filters = getCurrentFilters();
		previewEl.textContent = buildFilterPreview(filters);

		const savedChatId = localStorage.getItem("re-chatid") ?? "";
		chatIdInput.value = savedChatId;
		labelInput.value = "";

		void fetchAlerts(savedChatId);
		modal.showModal();
	};

	const handleChatIdChange = () => {
		const chatId = chatIdInput.value.trim();
		if (/^\d+$/.test(chatId)) void fetchAlerts(chatId);
	};

	const handleSave = async () => {
		const chatId = chatIdInput.value.trim();
		if (!/^\d+$/.test(chatId)) {
			toast(t("invalidChatId"), true);
			return;
		}

		saveBtn.disabled = true;
		try {
			const res = await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					label: labelInput.value.trim() || undefined,
					filters: getCurrentFilters(),
				}),
			});
			const d = (await res.json()) as { error?: string };
			if (!res.ok || d.error) {
				toast(d.error ?? t("failedAlert"), true);
				return;
			}
			localStorage.setItem("re-chatid", chatId);
			modal.close();
			toast(t("alertSaved"));
		} catch (e) {
			toast((e as Error).message, true);
		} finally {
			saveBtn.disabled = false;
		}
	};

	const handleDelete = async (token: string, rowEl: HTMLElement) => {
		try {
			await fetch(`/api/alerts/${token}`, { method: "DELETE" });
		} catch {
			/* best effort */
		}
		rowEl.remove();
		if (itemsEl.children.length === 0) {
			listEl.style.display = "none";
		}
		toast(t("alertDeleted"));
	};

	const fetchAlerts = async (chatId: string) => {
		if (!chatId || !/^\d+$/.test(chatId)) {
			updateAlertList([], itemsEl, listEl, handleDelete);
			return;
		}
		try {
			const res = await fetch(
				`/api/alerts?chat_id=${encodeURIComponent(chatId)}`,
			);
			const d = (await res.json()) as { alerts?: Alert[] };
			updateAlertList(d.alerts ?? [], itemsEl, listEl, handleDelete);
		} catch {
			updateAlertList([], itemsEl, listEl, handleDelete);
		}
	};

	// 3. Listeners
	const offDeals = bus.on(EVENTS.DEALS_UPDATED, () => {
		if (modal.open) {
			previewEl.textContent = buildFilterPreview(getCurrentFilters());
		}
	});

	trigger?.addEventListener("click", handleOpen);
	chatIdInput.addEventListener("change", handleChatIdChange);
	saveBtn.addEventListener("click", handleSave);
	cancelBtn.addEventListener("click", () => modal.close());

	return () => {
		trigger?.removeEventListener("click", handleOpen);
		chatIdInput.removeEventListener("change", handleChatIdChange);
		saveBtn.removeEventListener("click", handleSave);
		cancelBtn.removeEventListener("click", () => modal.close());
		offDeals();
	};
}

/**
 * Updates the alerts list in the modal using direct element references
 */
function updateAlertList(
	alerts: Alert[],
	itemsEl: HTMLElement,
	listEl: HTMLElement,
	onDelete: (token: string, row: HTMLElement) => void,
): void {
	if (!alerts || alerts.length === 0) {
		listEl.style.display = "none";
		return;
	}

	listEl.style.display = "block";
	itemsEl.replaceChildren();


	for (const a of alerts) {
		const preview = buildFilterPreview({
			...(a.filters ?? {}),
			location: a.filters?.location ?? "",
			threshold: a.filters?.threshold ?? 10,
		});

		const row = html`
      <div class="flex items-center gap-2 bg-(--surface-2) border border-(--border) rounded-md px-2.5 py-2 transition-all">
        <div class="flex-1 min-w-0">
          <div class="text-[12px] font-semibold text-(--text) whitespace-nowrap overflow-hidden text-ellipsis">
            ${a.label ?? t("unnamed")}
          </div>
          <div class="text-[11px] text-(--muted) mt-px whitespace-nowrap overflow-hidden text-ellipsis">
            ${preview}
          </div>
        </div>
      </div>
    `;

		const delBtn = Button({
			content: Icons.trash(),
			variant: "ghost",
			color: "red",
			title: t("deleteAlert"),
			className: "shrink-0",
		});
		delBtn.addEventListener("click", () => onDelete(a.token, row));
		row.appendChild(delBtn);

		itemsEl.appendChild(row);
	}
}

/**
 * Extracts current search filters from the DOM
 */
function getCurrentFilters(): AlertFilters {
	const v = (id: string) => (ge(id) as HTMLInputElement)?.value.trim() ?? "";
	const cb = (id: string) => (ge(id) as HTMLInputElement)?.checked ?? false;

	const filters: AlertFilters = {
		location:
			(ge("loc") as MultiSelectElement)?.getValue().join(",") || "__all__",
		threshold: Number((ge("thresh") as HTMLInputElement)?.value ?? 10),
	};

	const numIds = [
		"minPrice",
		"maxPrice",
		"minArea",
		"maxArea",
		"minRooms",
		"maxRooms",
		"minFloor",
		"maxFloor",
		"minTotalFloors",
		"maxTotalFloors",
	] as const;

	for (const id of numIds) {
		const val = v(id);
		if (val) filters[id] = Number(val);
	}

	if (v("category")) filters.category = v("category");
	if (cb("hasRepair")) filters.hasRepair = true;
	if (cb("hasDocument")) filters.hasDocument = true;
	if (cb("hasMortgage")) filters.hasMortgage = true;
	if (cb("isUrgent")) filters.isUrgent = true;
	if (cb("notLastFloor")) filters.notLastFloor = true;

	const am = (ge("hasActiveMortgage") as HTMLSelectElement)?.value;
	if (am === "true") filters.hasActiveMortgage = true;
	else if (am === "false") filters.hasActiveMortgage = false;

	return filters;
}

/**
 * Formats filters into a short preview string
 */
function buildFilterPreview(f: AlertFilters): string {
	const parts = [
		`📍 ${f.location === "__all__" ? t("allLocsPrev") : f.location}`,
		`📉 ≥${f.threshold}% ${t("belowAvg")}`,
	];
	if (f.minPrice || f.maxPrice)
		parts.push(`₼ ${f.minPrice ?? ""}-${f.maxPrice ?? ""}`);
	if (f.minRooms || f.maxRooms)
		parts.push(`${f.minRooms ?? ""}-${f.maxRooms ?? ""} ${t("previewRooms")}`);
	if (f.minArea || f.maxArea)
		parts.push(`${f.minArea ?? ""}-${f.maxArea ?? ""}${t("previewArea")}`);
	if (f.hasRepair) parts.push(t("previewRepaired"));
	if (f.hasDocument) parts.push(t("previewDocument"));
	if (f.isUrgent) parts.push(t("previewUrgent"));
	if (f.hasActiveMortgage === false) parts.push(t("previewNoActiveMortgage"));
	return parts.join(" · ");
}
