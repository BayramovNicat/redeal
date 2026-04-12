import { prisma } from "../utils/prisma.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const BASE = `https://api.telegram.org/bot${TOKEN}`;

export async function sendMessage(chatId: string, text: string): Promise<void> {
	if (!TOKEN) return;
	try {
		await fetch(`${BASE}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
		});
	} catch (err) {
		console.error("[Telegram] sendMessage failed:", err);
	}
}

export async function handleWebhook(req: Request): Promise<Response> {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return Response.json({ ok: true });
	}

	const message = body?.message as Record<string, unknown> | undefined;
	if (!message) return Response.json({ ok: true });

	const chatId = String((message.chat as Record<string, unknown>)?.id ?? "");
	const text = String(message.text ?? "").trim();

	if (text.startsWith("/start")) {
		await sendMessage(
			chatId,
			`Welcome to <b>RE Finder</b>!\n\nYour Chat ID is: <code>${chatId}</code>\n\nCopy this and paste it into the <b>Alert me</b> form on the website to receive deal notifications.`,
		);
	} else if (text.startsWith("/stop")) {
		const count = await prisma.alert.updateMany({
			where: { chat_id: chatId, is_active: true },
			data: { is_active: false },
		});
		if (count.count > 0) {
			await sendMessage(chatId, `All ${count.count} alert(s) stopped.`);
		} else {
			await sendMessage(chatId, "You have no active alerts.");
		}
	} else if (text.startsWith("/list")) {
		const alerts = await prisma.alert.findMany({
			where: { chat_id: chatId, is_active: true },
			select: { label: true, created_at: true },
		});
		if (alerts.length === 0) {
			await sendMessage(chatId, "You have no active alerts.\n\nUse the website to create one.");
		} else {
			const lines = alerts.map((a, i) => {
				const name = a.label ?? "Unnamed";
				const since = a.created_at.toLocaleDateString("en-GB");
				return `${i + 1}. ${name} (since ${since})`;
			});
			await sendMessage(chatId, `<b>Active alerts (${alerts.length}):</b>\n\n${lines.join("\n")}\n\n/stop to stop all.`);
		}
	}

	return Response.json({ ok: true });
}
