import type { Alert, AlertFilters } from "../core/types";
import { ge, toast } from "../core/utils";
import {
	buildFilterPreview,
	renderAlertModal,
	updateAlertList,
} from "../dialogs/alert";

export function initAlerts(root: HTMLElement): () => void {
	// 1. Render UI shell
	renderAlertModal(root);

	const modal = ge("alert-modal") as HTMLDialogElement;
	const trigger = ge("alert-btn");
	const saveBtn = ge("alert-save") as HTMLButtonElement;
	const chatIdInput = ge("alert-chat-id") as HTMLInputElement;
	const labelInput = ge("alert-label") as HTMLInputElement;
	const previewEl = ge("alert-filter-preview");

	if (!modal) return () => {};

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
			toast("Enter a valid Telegram Chat ID (digits only)", true);
			return;
		}

		const filters = getCurrentFilters();
		const label = labelInput.value.trim() || undefined;

		saveBtn.disabled = true;
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
			modal.close();
			toast(
				"Alert saved! You'll get a Telegram message when new deals appear.",
			);
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
		const itemsEl = ge("alert-list-items");
		if (itemsEl && itemsEl.children.length === 0) {
			ge("alert-list").style.display = "none";
		}
		toast("Alert deleted");
	};

	const fetchAlerts = async (chatId: string) => {
		if (!chatId || !/^\d+$/.test(chatId)) {
			updateAlertList([]);
			return;
		}
		try {
			const res = await fetch(
				`/api/alerts?chat_id=${encodeURIComponent(chatId)}`,
			);
			const d = (await res.json()) as { alerts?: Alert[] };
			updateAlertList(d.alerts ?? [], handleDelete);
		} catch {
			updateAlertList([]);
		}
	};

	// 3. Event Listeners
	const listeners: [HTMLElement | null, string, EventListener][] = [
		[trigger, "click", handleOpen],
		[chatIdInput, "change", handleChatIdChange],
		[ge("alert-cancel"), "click", () => modal.close()],
		[saveBtn, "click", handleSave],
	];

	listeners.forEach(([el, ev, fn]) => {
		el?.addEventListener(ev, fn);
	});

	return () => {
		listeners.forEach(([el, ev, fn]) => {
			el?.removeEventListener(ev, fn);
		});
	};
}

/**
 * Extracts current search filters from the DOM
 */
function getCurrentFilters(): AlertFilters {
	function v(id: string): string {
		return (ge(id) as HTMLInputElement)?.value.trim() ?? "";
	}
	function cb(id: string): boolean {
		return (ge(id) as HTMLInputElement)?.checked ?? false;
	}

	const filters: AlertFilters = {
		location: (ge("loc") as HTMLSelectElement)?.value ?? "__all__",
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
