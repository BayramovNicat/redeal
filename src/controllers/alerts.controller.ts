import { prisma } from "../utils/prisma.js";

/** GET /api/alerts?chat_id=xxx — list active alerts for a Telegram chat */
export async function getAlerts(req: Request): Promise<Response> {
	const chatId = new URL(req.url).searchParams.get("chat_id") ?? "";
	if (!/^\d+$/.test(chatId)) {
		return Response.json(
			{ error: "chat_id must be a numeric Telegram chat ID" },
			{ status: 400 },
		);
	}

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

	return Response.json({ ok: true, alerts });
}

/** POST /api/alerts — create a new Telegram alert */
export async function createAlert(req: Request): Promise<Response> {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const chatId = String(body.chat_id ?? "").trim();
	if (!/^\d+$/.test(chatId)) {
		return Response.json({ error: "chat_id must be a numeric Telegram chat ID" }, { status: 400 });
	}

	const filters = body.filters;
	if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
		return Response.json({ error: '"filters" object is required' }, { status: 400 });
	}

	const f = filters as Record<string, unknown>;
	const location = String(f.location ?? "").trim();
	if (!location) {
		return Response.json({ error: '"filters.location" is required' }, { status: 400 });
	}

	const label = body.label ? String(body.label).slice(0, 80) : undefined;

	const alert = await prisma.alert.create({
		data: {
			chat_id: chatId,
			label: label ?? null,
			filters: f,
		},
		select: { id: true, token: true },
	});

	return Response.json({ ok: true, id: alert.id, token: alert.token });
}

/** DELETE /api/alerts/:token — deactivate one alert */
export async function deleteAlert(req: Request): Promise<Response> {
	const token = new URL(req.url).pathname.split("/").pop() ?? "";
	if (!token) {
		return Response.json({ error: "Token is required" }, { status: 400 });
	}

	const alert = await prisma.alert.findUnique({ where: { token } });
	if (!alert) {
		return Response.json({ error: "Alert not found" }, { status: 404 });
	}

	await prisma.alert.update({ where: { token }, data: { is_active: false } });
	return Response.json({ ok: true });
}
