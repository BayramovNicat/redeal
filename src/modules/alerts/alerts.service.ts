import { getUndervalued } from "@/modules/deals/deals.service.js";
import { sendMessage } from "@/modules/telegram/telegram.service.js";
import type { AlertFilters, PaginationOptions } from "@/types/index.js";
import { classifyDeal } from "@/utils/deals.js";
import { prisma } from "@/utils/prisma.js";

function fmt(n: number, d = 0): string {
	return Number(n).toLocaleString("az-AZ", { maximumFractionDigits: d });
}

function formatListing(p: {
	source_url: string;
	price: number;
	area_sqm: number;
	price_per_sqm: number;
	location_name: string | null;
	district: string;
	rooms: number | null;
	floor: number | null;
	total_floors: number | null;
	has_document: boolean | null;
	has_repair: boolean | null;
	is_urgent: boolean;
	discount_percent: number;
	location_avg_price_per_sqm: number;
}): string {
	const loc = p.location_name ?? p.district;
	const rooms = p.rooms ? `${p.rooms}BR` : "";
	const floor =
		p.floor != null && p.total_floors != null
			? `Fl ${p.floor}/${p.total_floors}`
			: p.floor != null
				? `Fl ${p.floor}`
				: null;

	const tags: string[] = [];
	if (floor) tags.push(floor);
	if (p.has_document) tags.push("Document");
	if (p.has_repair) tags.push("Repaired");
	if (p.is_urgent) tags.push("Urgent");

	const tier = classifyDeal(p.discount_percent);

	const lines = [
		`🏠 <b>${[rooms, loc, `${fmt(Number(p.area_sqm), 1)}m²`].filter(Boolean).join(" · ")}</b>`,
		`💰 ₼${fmt(Number(p.price))} · ₼${fmt(Number(p.price_per_sqm), 0)}/m²`,
		`📉 -${Number(p.discount_percent).toFixed(1)}% below avg · ${tier}`,
	];
	if (tags.length) lines.push(`📋 ${tags.join(" · ")}`);
	lines.push(`🔗 ${p.source_url}`);

	return lines.join("\n");
}

export async function runAlerts(): Promise<void> {
	if (!process.env.TELEGRAM_BOT_TOKEN) return;

	const alerts = await prisma.alert.findMany({
		where: { is_active: true },
	});

	if (alerts.length === 0) return;

	console.log(`[Alerts] Checking ${alerts.length} active alert(s)`);

	for (const alert of alerts) {
		try {
			const { location: rawLocation, threshold: rawThreshold, ...propertyFilters } = alert.filters as AlertFilters;
			const location = rawLocation ?? "__all__";
			const threshold = Number(rawThreshold ?? 10);
			const filterArgs = { ...propertyFilters, since: alert.last_run_at ?? undefined };
			const pageArgs: PaginationOptions = { limit: 10 };

			const locations = location === "__all__" ? "__all__" : location.split(",").filter(Boolean);
			const { data } = await getUndervalued(locations, threshold, filterArgs, pageArgs);

			await prisma.alert.update({
				where: { id: alert.id },
				data: { last_run_at: new Date() },
			});

			if (data.length === 0) continue;

			const label = alert.label ?? "your alert";
			const header = `🔔 <b>${data.length} new deal${data.length !== 1 ? "s" : ""}</b> matching "${label}"`;
			const body = data.map(formatListing).join("\n\n");
			const footer = `\n\nSend /stop to stop all alerts.`;

			await sendMessage(alert.chat_id, `${header}\n\n${body}${footer}`);

			console.log(
				`[Alerts] Sent ${data.length} listing(s) to chat ${alert.chat_id} for alert "${label}"`,
			);
		} catch (err) {
			console.error(`[Alerts] Failed for alert ${alert.id}:`, err);
		}
	}
}
