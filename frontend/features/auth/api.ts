export interface AuthUser {
	id: string;
	email: string;
	name?: string | null;
	avatar?: string | null;
	role: string;
}

export interface WhitelistItem {
	id: string;
	email: string;
	note?: string | null;
	created_at: string;
}

let cachedUserPromise: Promise<{
	authenticated: boolean;
	user: AuthUser | null;
}> | null = null;

export async function fetchAuthUser(forceRefresh = false): Promise<{
	authenticated: boolean;
	user: AuthUser | null;
}> {
	if (!cachedUserPromise || forceRefresh) {
		cachedUserPromise = (async () => {
			try {
				const res = await fetch("/api/auth/me", {
					headers: { Accept: "application/json" },
					credentials: "same-origin",
				});
				if (!res.ok) return { authenticated: false, user: null };
				const data = (await res.json()) as {
					authenticated: boolean;
					user: AuthUser | null;
				};
				return {
					authenticated: Boolean(data.authenticated),
					user: data.user ?? null,
				};
			} catch {
				return { authenticated: false, user: null };
			}
		})();
	}
	return cachedUserPromise;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
	const { user } = await fetchAuthUser();
	return user?.role === "admin";
}

export async function deleteDealApi(url: string): Promise<void> {
	const res = await fetch("/api/deals/item", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify({ url }),
	});
	if (!res.ok) {
		const err = (await res.json()) as { error?: string };
		throw new Error(err.error || `Failed to delete deal (${res.status})`);
	}
}

export async function logoutUser(): Promise<void> {
	try {
		await fetch("/api/auth/logout", {
			method: "POST",
			credentials: "same-origin",
		});
	} finally {
		window.location.href = "/login";
	}
}

export async function fetchWhitelist(): Promise<WhitelistItem[]> {
	const res = await fetch("/api/auth/whitelist", {
		credentials: "same-origin",
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch whitelist (${res.status})`);
	}
	const json = (await res.json()) as { data: WhitelistItem[] };
	return json.data ?? [];
}

export async function addWhitelistEmail(
	email: string,
	note?: string,
): Promise<WhitelistItem> {
	const res = await fetch("/api/auth/whitelist", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify({ email, note }),
	});
	if (!res.ok) {
		const err = (await res.json()) as { error?: string };
		throw new Error(err.error || `Failed to add email (${res.status})`);
	}
	const json = (await res.json()) as { data: WhitelistItem };
	return json.data;
}

export async function removeWhitelistEmail(email: string): Promise<void> {
	const res = await fetch(`/api/auth/whitelist/${encodeURIComponent(email)}`, {
		method: "DELETE",
		credentials: "same-origin",
	});
	if (!res.ok) {
		throw new Error(`Failed to remove email (${res.status})`);
	}
}
