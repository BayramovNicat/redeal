import type { Prisma } from "@prisma/client";
import { readJsonBody } from "@/utils/json-body.js";
import { prisma } from "@/utils/prisma.js";
import { ResponseHelper } from "@/utils/response.js";

export async function getAlerts(req: Request): Promise<Response> {
	const chatId = new URL(req.url).searchParams.get("chat_id") ?? "";
	if (!/^-?\d+$/.test(chatId)) {
		return ResponseHelper.error(
			"chat_id must be a numeric Telegram chat ID",
			400,
		);
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
		return ResponseHelper.privateJson({ ok: true, alerts });
	} catch (err) {
		console.error("[AlertsController] getAlerts:", err);
		return ResponseHelper.error("Failed to fetch alerts");
	}
}

export async function createAlert(req: Request): Promise<Response> {
	const parsed = await readJsonBody<Record<string, unknown>>(req);
	if (!parsed.ok) {
		return ResponseHelper.error(
			parsed.status === 413 ? "JSON body too large" : "Invalid JSON body",
			parsed.status,
		);
	}

	const body = parsed.data;
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return ResponseHelper.error("JSON body must be an object", 400);
	}
	const chatId = String(body.chat_id ?? "").trim();
	if (!/^-?\d+$/.test(chatId)) {
		return ResponseHelper.error(
			"chat_id must be a numeric Telegram chat ID",
			400,
		);
	}

	const filters = body.filters;
	if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
		return ResponseHelper.error('"filters" object is required', 400);
	}

	const f = filters as Prisma.JsonObject;
	const location = String(f.location ?? "").trim();
	if (!location) {
		return ResponseHelper.error('"filters.location" is required', 400);
	}

	const label = body.label ? String(body.label).slice(0, 80) : undefined;

	try {
		const alert = await prisma.alert.create({
			data: { chat_id: chatId, label: label ?? null, filters: f },
			select: { id: true, token: true },
		});
		return ResponseHelper.privateJson({
			ok: true,
			id: alert.id,
			token: alert.token,
		});
	} catch (err) {
		console.error("[AlertsController] createAlert:", err);
		return ResponseHelper.error("Failed to create alert");
	}
}

export async function deleteAlert(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const token = url.pathname.split("/").pop() ?? "";
	if (!token) {
		return ResponseHelper.error("Token is required", 400);
	}

	const chatId = url.searchParams.get("chat_id") ?? "";
	if (!/^-?\d+$/.test(chatId)) {
		return ResponseHelper.error(
			"chat_id must be a numeric Telegram chat ID",
			400,
		);
	}

	try {
		const { count } = await prisma.alert.updateMany({
			where: { token, chat_id: chatId, is_active: true },
			data: { is_active: false },
		});

		if (count === 0) {
			return ResponseHelper.error("Alert not found", 404);
		}

		return ResponseHelper.privateJson({ ok: true });
	} catch (err) {
		console.error("[AlertsController] deleteAlert:", err);
		return ResponseHelper.error("Failed to delete alert");
	}
}
