export function ge(id: string): HTMLElement {
	return document.getElementById(id) as HTMLElement;
}

export function show(id: string, d?: string): void {
	const e = ge(id);
	if (e) e.style.display = d ?? "";
}

export function hide(id: string): void {
	const e = ge(id);
	if (e) e.style.display = "none";
}

export function fmt(n: number | string, d = 0): string {
	return Number(n).toLocaleString("az-AZ", { maximumFractionDigits: d });
}

export function timeAgo(s: string | null | undefined): string | null {
	if (!s) return null;
	const sec = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
	if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
	if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
	if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
	return new Date(s).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
	});
}

export function toast(msg: string, err = false): void {
	const el = document.createElement("div");
	el.className = `toast${err ? " err" : ""}`;
	el.textContent = msg;
	ge("toasts").appendChild(el);
	setTimeout(() => el.remove(), 3800);
}

export function fmtFloor(
	f: number | null | undefined,
	t: number | null | undefined,
): string {
	if (f != null && t != null) return `${f}/${t}`;
	return f?.toString() ?? "—";
}
