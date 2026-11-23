import { TELEGRAM_WEBHOOK_SECRET } from "@/config.js";
import { readJsonBody } from "@/utils/json-body.js";
import { prisma } from "@/utils/prisma.js";
import { escapeTelegramHtml, sendMessage } from "./telegram.service.js";

export async function handleWebhook(req: Request): Promise<Response> {
	if (
		TELEGRAM_WEBHOOK_SECRET &&
		req.headers.get("x-telegram-bot-api-secret-token") !==
			TELEGRAM_WEBHOOK_SECRET
	) {
		return Response.json({ ok: false }, { status: 401 });
	}

	const parsed = await readJsonBody<Record<string, unknown>>(req);
	if (!parsed.ok) return Response.json({ ok: true });

	const message = parsed.data?.message as Record<string, unknown> | undefined;
	if (!message) return Response.json({ ok: true });

	const chatId = String((message.chat as Record<string, unknown>)?.id ?? "");
	const text = String(message.text ?? "").trim();

	if (text.startsWith("/start")) {
		await sendMessage(
			chatId,
			`Welcome to <b>Redeal</b>!\n\nYour Chat ID is: <code>${escapeTelegramHtml(chatId)}</code>\n\nCopy this and paste it into the <b>Alert me</b> form on the website to receive deal notifications.`,
		);
	} else if (text.startsWith("/stop")) {
		try {
			const count = await prisma.alert.updateMany({
				where: { chat_id: chatId, is_active: true },
				data: { is_active: false },
			});
			if (count.count > 0) {
				await sendMessage(chatId, `All ${count.count} alert(s) stopped.`);
			} else {
				await sendMessage(chatId, "You have no active alerts.");
			}
		} catch {
			await sendMessage(chatId, "Failed to stop alerts. Please try again.");
		}
	} else if (text.startsWith("/list")) {
		try {
			const alerts = await prisma.alert.findMany({
				where: { chat_id: chatId, is_active: true },
				select: { label: true, created_at: true },
			});
			if (alerts.length === 0) {
				await sendMessage(
					chatId,
					"You have no active alerts.\n\nUse the website to create one.",
				);
			} else {
				const lines = alerts.map((a, i) => {
					const name = escapeTelegramHtml(a.label ?? "Unnamed");
					const since = a.created_at.toLocaleDateString("en-GB");
					return `${i + 1}. ${name} (since ${since})`;
				});
				await sendMessage(
					chatId,
					`<b>Active alerts (${alerts.length}):</b>\n\n${lines.join("\n")}\n\n/stop to stop all.`,
				);
			}
		} catch {
			await sendMessage(chatId, "Failed to fetch alerts. Please try again.");
		}
	}

	return Response.json({ ok: true });
}
