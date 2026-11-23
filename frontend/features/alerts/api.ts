import { t } from "@/core/i18n";
import { state } from "@/core/state";
import type { Alert } from "@/core/types";
import { toast } from "@/core/utils";

import { openLoginModal } from "@/features/auth/api";

/**
 * Fetches active alerts for a given chatId.
 */
export async function fetchAlerts(chatId: string): Promise<Alert[]> {
	if (!chatId || !/^-?\d+$/.test(chatId)) {
		return [];
	}

	try {
		const res = await fetch(
			`/api/alerts?chat_id=${encodeURIComponent(chatId)}`,
		);
		const d = (await res.json()) as { alerts?: Alert[]; error?: string };
		if (res.status === 401) {
			openLoginModal("alerts");
			return [];
		}
		if (!res.ok) {
			toast(d.error ?? `Request failed (${res.status})`, true);
			return [];
		}
		return d.alerts ?? [];
	} catch (e) {
		console.error("[Alerts] fetchAlerts failed:", e);
		toast((e as Error).message, true);
		return [];
	}
}

/**
 * Saves a new alert subscription.
 */
export async function saveAlert(
	chatId: string,
	label: string,
): Promise<boolean> {
	try {
		const res = await fetch("/api/alerts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				label: label.trim() || undefined,
				filters: state.getFilters(),
			}),
		});

		const d = (await res.json()) as { error?: string };
		if (!res.ok || d.error) {
			toast(d.error ?? t("failedAlert"), true);
			return false;
		}

		localStorage.setItem("re-chatid", chatId);
		toast(t("alertSaved"));
		return true;
	} catch (e) {
		toast((e as Error).message, true);
		return false;
	}
}

/**
 * Deletes an alert by token.
 */
export async function deleteAlert(
	token: string,
	chatId: string,
): Promise<boolean> {
	try {
		const res = await fetch(
			`/api/alerts/${token}?chat_id=${encodeURIComponent(chatId)}`,
			{ method: "DELETE" },
		);
		if (!res.ok) throw new Error("Delete failed");
		toast(t("alertDeleted"));
		return true;
	} catch (e) {
		console.error("[Alerts] delete failed:", e);
		toast(t("failedDeleteAlert"), true);
		return false;
	}
}
