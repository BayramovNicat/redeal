import type { Alert, AlertFilters } from "../core/types";
import { ge, toast } from "../core/utils";

export function getCurrentFilters(): AlertFilters {
	function v(id: string): string {
		return (ge(id) as HTMLInputElement).value.trim();
	}
	function cb(id: string): boolean {
		return (ge(id) as HTMLInputElement).checked;
	}

	const filters: AlertFilters = {
		location: (ge("loc") as HTMLSelectElement).value,
		threshold: Number((ge("thresh") as HTMLInputElement).value),
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
		if (val) (filters as unknown as Record<string, unknown>)[id] = Number(val);
	}

	if (v("category")) filters.category = v("category");
	if (cb("hasRepair")) filters.hasRepair = true;
	if (cb("hasDocument")) filters.hasDocument = true;
	if (cb("hasMortgage")) filters.hasMortgage = true;
	if (cb("isUrgent")) filters.isUrgent = true;
	if (cb("notLastFloor")) filters.notLastFloor = true;
	if (cb("noActiveMortgage")) filters.hasActiveMortgage = false;
	else if (cb("hasActiveMortgage")) filters.hasActiveMortgage = true;

	return filters;
}

export function buildFilterPreview(f: AlertFilters): string {
	const parts = [
		`📍 ${f.location === "__all__" ? "All locations" : f.location}`,
		`📉 ≥${f.threshold}% below avg`,
	];
	if (f.minPrice || f.maxPrice)
		parts.push(`₼ ${f.minPrice ?? ""}–${f.maxPrice ?? ""}`);
	if (f.minRooms || f.maxRooms)
		parts.push(`${f.minRooms ?? ""}–${f.maxRooms ?? ""} rooms`);
	if (f.minArea || f.maxArea)
		parts.push(`${f.minArea ?? ""}–${f.maxArea ?? ""}m²`);
	if (f.hasRepair) parts.push("Repaired");
	if (f.hasDocument) parts.push("Document");
	if (f.isUrgent) parts.push("Urgent");
	if (f.hasActiveMortgage === false) parts.push("No active mortgage");
	return parts.join(" · ");
}

export function renderAlertList(alerts: Alert[]): void {
	const listEl = ge("alert-list");
	const itemsEl = ge("alert-list-items");
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
		const row = document.createElement("div");
		row.style.cssText =
			"display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:8px 10px";
		row.innerHTML = `
			<div style="flex:1;min-width:0">
				<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.label ?? "Unnamed"}</div>
				<div style="font-size:11px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}</div>
			</div>
			<button type="button" class="inline-flex items-center gap-1 bg-transparent border-none p-0 text-[11px] text-(--muted) transition-colors duration-150 hover:text-(--text)" style="color:var(--red);flex-shrink:0" title="Delete alert">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
			</button>`;
		const btn = row.querySelector("button");
		if (btn) {
			btn.addEventListener("click", () => deleteAlertRow(a.token, row));
		}
		itemsEl.appendChild(row);
	}
}

export async function fetchAndRenderAlerts(chatId: string): Promise<void> {
	if (!chatId || !/^\d+$/.test(chatId)) {
		renderAlertList([]);
		return;
	}
	try {
		const res = await fetch(
			`/api/alerts?chat_id=${encodeURIComponent(chatId)}`,
		);
		const d = (await res.json()) as { alerts?: Alert[] };
		renderAlertList(d.alerts ?? []);
	} catch {
		renderAlertList([]);
	}
}

async function deleteAlertRow(
	token: string,
	rowEl: HTMLElement,
): Promise<void> {
	try {
		await fetch(`/api/alerts/${token}`, { method: "DELETE" });
	} catch {
		/* best effort */
	}
	rowEl.remove();
	const remaining = ge("alert-list-items").children.length;
	if (remaining === 0) ge("alert-list").style.display = "none";
	toast("Alert deleted");
}

export function initAlertModal(): void {
	ge("alert-btn").addEventListener("click", () => {
		const f = getCurrentFilters();
		ge("alert-filter-preview").textContent = buildFilterPreview(f);
		const savedChatId = localStorage.getItem("re-chatid") ?? "";
		(ge("alert-chat-id") as HTMLInputElement).value = savedChatId;
		(ge("alert-label") as HTMLInputElement).value = "";
		void fetchAndRenderAlerts(savedChatId);
		(ge("alert-modal") as HTMLDialogElement).showModal();
	});

	ge("alert-chat-id").addEventListener("change", () => {
		const chatId = (ge("alert-chat-id") as HTMLInputElement).value.trim();
		if (/^\d+$/.test(chatId)) void fetchAndRenderAlerts(chatId);
	});

	ge("alert-cancel").addEventListener("click", () =>
		(ge("alert-modal") as HTMLDialogElement).close(),
	);

	ge("alert-modal").addEventListener("click", (e) => {
		if (e.target === e.currentTarget)
			(e.currentTarget as HTMLDialogElement).close();
	});

	ge("alert-save").addEventListener("click", async () => {
		const chatId = (ge("alert-chat-id") as HTMLInputElement).value.trim();
		if (!/^\d+$/.test(chatId)) {
			toast("Enter a valid Telegram Chat ID (digits only)", true);
			return;
		}
		const filters = getCurrentFilters();
		const labelVal = (ge("alert-label") as HTMLInputElement).value.trim();
		const label = labelVal || undefined;

		(ge("alert-save") as HTMLButtonElement).disabled = true;
		try {
			const res = await fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ chat_id: chatId, label, filters }),
			});
			const d = (await res.json()) as { error?: string };
			if (!res.ok || d.error) {
				toast(d.error ?? "Failed to create alert", true);
				return;
			}
			localStorage.setItem("re-chatid", chatId);
			(ge("alert-modal") as HTMLDialogElement).close();
			toast(
				"Alert saved! You'll get a Telegram message when new deals appear.",
			);
		} catch (e) {
			toast((e as Error).message, true);
		} finally {
			(ge("alert-save") as HTMLButtonElement).disabled = false;
		}
	});
}
