import { prisma } from "../utils/prisma.js";
import * as res from "../utils/response.js";

/** GET /api/alerts?chat_id=xxx — list active alerts for a Telegram chat */
export async function getAlerts(req: Request): Promise<Response> {
	const chatId = new URL(req.url).searchParams.get("chat_id") ?? "";
	if (!/^\d+$/.test(chatId)) {
		return res.error("chat_id must be a numeric Telegram chat ID", 400);
	}
	try {
		const alerts = await prisma.alert.findMany({
			where: { chat_id: chatId, is_active: true },
			select: {
				id: true,
				token: true,
				label: true,
				filters: true,
				created_at: true,
			},
			orderBy: { created_at: "desc" },
		});
		return res.json({ ok: true, alerts });
	} catch (err) {
		console.error("[AlertsController] getAlerts:", err);
		return res.error("Failed to fetch alerts");
	}
}

/** POST /api/alerts — create a new Telegram alert */
export async function createAlert(req: Request): Promise<Response> {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return res.error("Invalid JSON body", 400);
	}

	const chatId = String(body.chat_id ?? "").trim();
	if (!/^\d+$/.test(chatId)) {
		return res.error("chat_id must be a numeric Telegram chat ID", 400);
	}

	const filters = body.filters;
	if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
		return res.error('"filters" object is required', 400);
	}

	const f = filters as Record<string, unknown>;
	const location = String(f.location ?? "").trim();
	if (!location) {
		return res.error('"filters.location" is required', 400);
	}

	const label = body.label ? String(body.label).slice(0, 80) : undefined;

	try {
		const alert = await prisma.alert.create({
			data: { chat_id: chatId, label: label ?? null, filters: f },
			select: { id: true, token: true },
		});
		return res.json({ ok: true, id: alert.id, token: alert.token });
	} catch (err) {
		console.error("[AlertsController] createAlert:", err);
		return res.error("Failed to create alert");
	}
}

/** DELETE /api/alerts/:token — deactivate one alert */
export async function deleteAlert(req: Request): Promise<Response> {
	const token = new URL(req.url).pathname.split("/").pop() ?? "";
	if (!token) {
		return res.error("Token is required", 400);
	}
	try {
		const alert = await prisma.alert.findUnique({ where: { token } });
		if (!alert) {
			return res.error("Alert not found", 404);
		}
		await prisma.alert.update({ where: { token }, data: { is_active: false } });
		return res.json({ ok: true });
	} catch (err) {
		console.error("[AlertsController] deleteAlert:", err);
		return res.error("Failed to delete alert");
	}
}
