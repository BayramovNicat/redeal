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

export async function fetchAuthUser(): Promise<{
	authenticated: boolean;
	user: AuthUser | null;
}> {
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
