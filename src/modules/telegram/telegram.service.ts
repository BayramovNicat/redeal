const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const BASE = `https://api.telegram.org/bot${TOKEN}`;

export function escapeTelegramHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export async function sendMessage(
	chatId: string,
	text: string,
): Promise<boolean> {
	if (!TOKEN) return false;
	try {
		const res = await fetch(`${BASE}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			console.error(
				`[Telegram] sendMessage failed (${res.status}): ${body.slice(0, 300)}`,
			);
			return false;
		}
		return true;
	} catch (err) {
		console.error("[Telegram] sendMessage failed:", err);
		return false;
	}
}
