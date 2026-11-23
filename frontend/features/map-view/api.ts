import { state as globalState } from "@/core/state";
import type { MapPin } from "@/core/types";
import { toast } from "@/core/utils";
import { isUserAuthenticated, openLoginModal } from "@/features/auth/api";
import type { MapViewState } from "./types";

/**
 * Fetches map pins based on current URL search parameters.
 */
export async function fetchMapPins(
	state: MapViewState,
): Promise<MapPin[] | null> {
	const params = isUserAuthenticated()
		? new URLSearchParams(window.location.search)
		: new URLSearchParams({
				location: globalState.getFilters().location || "__all__",
				threshold: String(globalState.getFilters().threshold ?? 10),
			});

	if (!params.get("location")) {
		params.set("location", "__all__");
		if (!params.get("threshold")) params.set("threshold", "10");
	}

	if (state.abortController) state.abortController.abort();
	const controller = new AbortController();
	state.abortController = controller;

	try {
		const res = await fetch(`/api/deals/map-pins?${params}`, {
			signal: controller.signal,
		});
		const d = (await res.json()) as {
			error?: string;
			code?: string;
			data?: MapPin[];
		};

		if (res.status === 401 || d.code === "AUTH_REQUIRED") {
			openLoginModal("filter");
			return null;
		}

		if (d.error) {
			toast(d.error, true);
			return null;
		}

		return d.data ?? [];
	} catch (e) {
		if ((e as Error).name !== "AbortError") {
			toast((e as Error).message, true);
		}
		return null;
	} finally {
		if (state.abortController === controller) {
			state.abortController = null;
		}
	}
}
