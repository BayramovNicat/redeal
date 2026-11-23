import { bus, EVENTS } from "@/core/events";
import { state } from "@/core/state";
import { deleteAlert, fetchAlerts, saveAlert } from "./api";
import { renderAlertList } from "./list";
import type { AlertsState, AlertsUI } from "./types";
import { buildFilterPreview, renderAlertsUI } from "./ui";

export function initAlerts(root: HTMLElement): () => void {
	const ui: AlertsUI = {
		modal: null as unknown as AlertsUI["modal"],
		chatIdInput: null as unknown as HTMLInputElement,
		labelInput: null as unknown as HTMLInputElement,
		previewEl: null as unknown as HTMLElement,
		itemsEl: null as unknown as HTMLElement,
		listEl: null as unknown as HTMLElement,
		cancelBtn: null as unknown as HTMLButtonElement,
		saveBtn: null as unknown as HTMLButtonElement,
	};

	const state_local: AlertsState = {
		isSaving: false,
		isLoadingAlerts: false,
	};

	let listReqId = 0;
	let loadedChatId = "";

	const refreshList = async (chatId: string) => {
		const reqId = ++listReqId;
		state_local.isLoadingAlerts = true;
		const alerts = await fetchAlerts(chatId);
		if (reqId !== listReqId) return;
		loadedChatId = chatId;
		renderAlertList(alerts, ui.itemsEl, ui.listEl, handleDelete);
		state_local.isLoadingAlerts = false;
	};

	const handleOpen = () => {
		const currentFilters = state.getFilters();
		ui.previewEl.textContent = buildFilterPreview(currentFilters);

		const savedChatId = localStorage.getItem("re-chatid") ?? "";
		ui.chatIdInput.value = savedChatId;
		ui.labelInput.value = "";

		void refreshList(savedChatId);
		ui.modal.showModal();
	};

	const handleSave = async () => {
		const chatId = ui.chatIdInput.value.trim();
		if (!chatId) return;

		state_local.isSaving = true;
		ui.saveBtn.disabled = true;

		const success = await saveAlert(chatId, ui.labelInput.value);
		if (success) {
			ui.modal.close();
		}

		state_local.isSaving = false;
		ui.saveBtn.disabled = false;
	};

	const handleDelete = async (token: string, rowEl: HTMLElement) => {
		const chatId = loadedChatId || ui.chatIdInput.value.trim();
		const success = await deleteAlert(token, chatId);
		if (success) {
			rowEl.remove();
			if (ui.itemsEl.children.length === 0) {
				ui.listEl.style.display = "none";
			}
		}
	};

	const layout = renderAlertsUI(ui, {
		onChatIdChange: () => void refreshList(ui.chatIdInput.value.trim()),
		onSave: () => void handleSave(),
		onCancel: () => ui.modal.close(),
	});

	root.appendChild(layout);

	const cleanups: (() => void)[] = [];
	cleanups.push(bus.on(EVENTS.ALERTS_OPEN, handleOpen));
	cleanups.push(
		bus.on(EVENTS.DEALS_UPDATED, () => {
			if (ui.modal.open) {
				ui.previewEl.textContent = buildFilterPreview(state.getFilters());
			}
		}),
	);

	return () => {
		cleanups.forEach((fn) => {
			fn();
		});
		ui.modal.remove();
	};
}
