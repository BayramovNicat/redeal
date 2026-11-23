import { type CircleMarker, circleMarker, type Renderer } from "leaflet";
import { bus, EVENTS } from "@/core/events";
import type { MapPin, Property } from "@/core/types";
import { fmt, fmtFloor, html, toast, tTier } from "@/core/utils";
import { openLoginModal } from "@/features/auth/api";
import { ts } from "@/ui/tier";
import type { MapViewState } from "./types";

function getBaseRadius(tier: string): number {
	if (tier === "High Value Deal") return 7.5;
	if (tier === "Good Deal") return 6.5;
	return 5.5;
}

/**
 * Creates a crisp, contrast-ringed circle marker for a map pin.
 * Uses a shared Canvas renderer for large datasets and lazy tooltip generation.
 */
export function createPinMarker(
	pin: MapPin,
	state: MapViewState,
	renderer?: Renderer,
): CircleMarker {
	const tStyle = ts(pin.tier);
	const baseRadius = getBaseRadius(pin.tier);

	const cm = circleMarker([pin.lat, pin.lng], {
		renderer,
		radius: baseRadius,
		color: "#090b10",
		fillColor: tStyle.hex,
		fillOpacity: 0.94,
		weight: 2,
		opacity: 0.95,
	});

	let tipContent: HTMLElement | null = null;

	cm.on("mouseover", () => {
		cm.bringToFront();
		cm.setStyle({
			radius: baseRadius + 3.5,
			color: "#ffffff",
			weight: 2.5,
			fillOpacity: 1,
			opacity: 1,
		});
		if (state.lmap) {
			if (tipContent === null) {
				tipContent = getTooltipContent(pin, tStyle);
			}
			state.sharedTooltip.setContent(tipContent);
			state.sharedTooltip.setLatLng([pin.lat, pin.lng]);
			state.sharedTooltip.addTo(state.lmap);
		}
	});

	cm.on("mouseout", () => {
		cm.setStyle({
			radius: baseRadius,
			color: "#090b10",
			weight: 2,
			fillOpacity: 0.94,
			opacity: 0.95,
		});
		state.sharedTooltip.remove();
	});

	cm.on("click", async () => {
		state.sharedTooltip.remove();
		try {
			const r = await fetch("/api/deals/by-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ urls: [pin.source_url] }),
			});
			const json = (await r.json()) as {
				data?: Property[];
				error?: string;
				code?: string;
			};
			if (r.status === 401 || json.code === "AUTH_REQUIRED") {
				openLoginModal("general");
				return;
			}
			if (!r.ok || json.error) {
				toast(json.error ?? `Request failed (${r.status})`, true);
				return;
			}
			if (json.data?.[0]) bus.emit(EVENTS.PROPERTY_OPEN, json.data[0]);
		} catch (e) {
			if ((e as Error).name !== "AbortError") toast((e as Error).message, true);
		}
	});

	return cm;
}

/**
 * Formats the mini architectural preview card tooltip for a pin (computed lazily on hover).
 */
function getTooltipContent(
	pin: MapPin,
	tStyle: { hex: string; c: string; bg: string; b: string },
): HTMLElement {
	const discSign = pin.discount_percent >= 0 ? "-" : "+";
	const discAbs = Math.abs(Math.round(pin.discount_percent));
	const floorStr = fmtFloor(pin.floor, pin.total_floors);
	const meta = [
		pin.area_sqm ? `${fmt(pin.area_sqm, 0)}m²` : null,
		pin.rooms ? `${pin.rooms}br` : null,
		floorStr && floorStr !== "—" ? `fl ${floorStr}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	const safeImageUrl =
		pin.image_url && /^https?:\/\//i.test(pin.image_url) ? pin.image_url : null;
	const thumbEl = safeImageUrl
		? html`<img src="${safeImageUrl}" referrerpolicy="no-referrer" style="width:62px;height:62px;object-fit:cover;flex-shrink:0;border-radius:9px;border:1px solid rgba(255,255,255,0.1)" alt="">`
		: "";

	const locEl = pin.location_name
		? html`<div style="font-size:10.5px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pin.location_name}</div>`
		: "";

	return html`<div style="padding:10px 13px;min-width:235px;max-width:305px">
		<div style="display:flex;align-items:center;gap:10px">
			${thumbEl}
			<div style="min-width:0;flex:1">
				<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
					<span style="font-size:15px;font-weight:800;font-family:var(--font-mono);color:var(--text);line-height:1.1">
						₼ ${fmt(pin.price)}
					</span>
					<span style="font-size:10.5px;font-weight:800;font-family:var(--font-mono);color:${tStyle.c};background:${tStyle.bg};border:1px solid ${tStyle.b};padding:1px 6px;border-radius:999px;line-height:1.4">
						${discSign}${discAbs}%
					</span>
				</div>
				<div style="font-size:11px;font-family:var(--font-mono);color:var(--text-2);display:flex;align-items:center;gap:6px">
					<span>₼${fmt(pin.price_per_sqm, 0)}/m²</span>
					<span style="font-size:10px;color:${tStyle.c};font-family:var(--font-sans);font-weight:600">${tTier(pin.tier, true)}</span>
				</div>
				${meta ? html`<div style="font-size:10.5px;font-family:var(--font-mono);color:var(--muted);margin-top:2px">${meta}</div>` : ""}
				${locEl}
			</div>
		</div>
	</div>`;
}
