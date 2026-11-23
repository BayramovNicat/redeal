import {
	IS_DEV,
	SCRAPE_ADMIN_PASSWORD,
	SCRAPE_ADMIN_SESSION_SECRET,
	SCRAPE_ADMIN_SESSION_TTL_SECONDS,
} from "@/config.js";
import { ResponseHelper } from "@/utils/response.js";

const SESSION_COOKIE = "redeal_scrape_admin";
const CSRF_COOKIE = "redeal_scrape_csrf";
const CSRF_HEADER = "x-scrape-csrf-token";
const COOKIE_PATH = "/api/scrape";
const encoder = new TextEncoder();

type SessionPayload = {
	exp: number;
	nonce: string;
};

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlEncodeString(value: string): string {
	return base64UrlEncode(encoder.encode(value));
}

function base64UrlDecodeString(value: string): string | null {
	try {
		const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

async function signingKey(): Promise<CryptoKey | null> {
	if (!SCRAPE_ADMIN_SESSION_SECRET) return null;
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(SCRAPE_ADMIN_SESSION_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

async function sign(value: string): Promise<string | null> {
	const key = await signingKey();
	if (!key) return null;
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(value),
	);
	return base64UrlEncode(new Uint8Array(signature));
}

async function createSessionCookieValue(): Promise<string | null> {
	const payload: SessionPayload = {
		exp: Date.now() + SCRAPE_ADMIN_SESSION_TTL_SECONDS * 1000,
		nonce: randomToken(),
	};
	const body = base64UrlEncodeString(JSON.stringify(payload));
	const signature = await sign(body);
	return signature ? `${body}.${signature}` : null;
}

async function verifySessionCookie(value: string): Promise<boolean> {
	const [body, signature, extra] = value.split(".");
	if (!body || !signature || extra !== undefined) return false;
	const expected = await sign(body);
	if (!expected || !safeEqual(signature, expected)) return false;
	const decoded = base64UrlDecodeString(body);
	if (!decoded) return false;
	try {
		const payload = JSON.parse(decoded) as Partial<SessionPayload>;
		return typeof payload.exp === "number" && payload.exp > Date.now();
	} catch {
		return false;
	}
}

function safeEqual(a: string, b: string): boolean {
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	let diff = aBytes.length ^ bBytes.length;
	const len = Math.max(aBytes.length, bBytes.length);
	for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	return diff === 0;
}

function getCookie(req: Request, name: string): string {
	const cookie = req.headers.get("cookie") ?? "";
	for (const part of cookie.split(";")) {
		const [rawKey, ...rawValue] = part.trim().split("=");
		if (rawKey === name) return rawValue.join("=");
	}
	return "";
}

function serializeCookie(
	name: string,
	value: string,
	options: { httpOnly?: boolean; maxAge: number },
): string {
	const parts = [
		`${name}=${value}`,
		`Max-Age=${options.maxAge}`,
		`Path=${COOKIE_PATH}`,
		"SameSite=Strict",
	];
	if (options.httpOnly) parts.push("HttpOnly");
	if (!IS_DEV) parts.push("Secure");
	return parts.join("; ");
}

function appendCookies(headers: Headers, session: string, csrf: string): void {
	headers.append(
		"Set-Cookie",
		serializeCookie(SESSION_COOKIE, session, {
			httpOnly: true,
			maxAge: SCRAPE_ADMIN_SESSION_TTL_SECONDS,
		}),
	);
	headers.append(
		"Set-Cookie",
		serializeCookie(CSRF_COOKIE, csrf, {
			maxAge: SCRAPE_ADMIN_SESSION_TTL_SECONDS,
		}),
	);
}

function clearCookies(headers: Headers): void {
	headers.append(
		"Set-Cookie",
		serializeCookie(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0 }),
	);
	headers.append("Set-Cookie", serializeCookie(CSRF_COOKIE, "", { maxAge: 0 }));
}

function jsonWithHeaders(
	body: unknown,
	headers: Headers,
	status = 200,
): Response {
	headers.set("Cache-Control", "no-store");
	return Response.json(body, { status, headers });
}

function sameOrigin(req: Request): boolean {
	const origin = req.headers.get("origin");
	if (!origin) return IS_DEV;
	try {
		const reqUrl = new URL(req.url);
		const originUrl = new URL(origin);
		if (originUrl.origin === reqUrl.origin) return true;

		const forwardedProto = req.headers
			.get("x-forwarded-proto")
			?.split(",")[0]
			?.trim();
		const forwardedHost = req.headers
			.get("x-forwarded-host")
			?.split(",")[0]
			?.trim();
		const host = forwardedHost || req.headers.get("host")?.trim();
		if (
			host &&
			(forwardedProto === "http" || forwardedProto === "https") &&
			originUrl.origin === `${forwardedProto}://${host}`
		) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

export function adminPasswordConfigured(): boolean {
	return Boolean(SCRAPE_ADMIN_PASSWORD && SCRAPE_ADMIN_SESSION_SECRET);
}

export function verifyScrapeAdminPassword(password: string): boolean {
	return (
		Boolean(SCRAPE_ADMIN_PASSWORD) && safeEqual(password, SCRAPE_ADMIN_PASSWORD)
	);
}

export async function createScrapeAdminSessionResponse(): Promise<Response> {
	const session = await createSessionCookieValue();
	if (!session)
		return ResponseHelper.error("SCRAPE_ADMIN_PASSWORD is not configured", 503);
	const csrf = randomToken();
	const headers = new Headers();
	appendCookies(headers, session, csrf);
	return jsonWithHeaders({ ok: true, csrfToken: csrf }, headers);
}

export function clearScrapeAdminSessionResponse(): Response {
	const headers = new Headers();
	clearCookies(headers);
	return jsonWithHeaders({ ok: true }, headers);
}

export async function getScrapeAdminSession(req: Request): Promise<{
	authenticated: boolean;
	csrfToken: string;
}> {
	const session = getCookie(req, SESSION_COOKIE);
	if (!session || !(await verifySessionCookie(session))) {
		return { authenticated: false, csrfToken: "" };
	}
	return { authenticated: true, csrfToken: getCookie(req, CSRF_COOKIE) };
}

export async function requireScrapeAdminSession(
	req: Request,
): Promise<Response | null> {
	if (!adminPasswordConfigured()) {
		return ResponseHelper.error("SCRAPE_ADMIN_PASSWORD is not configured", 503);
	}
	const session = getCookie(req, SESSION_COOKIE);
	if (session && (await verifySessionCookie(session))) return null;
	return ResponseHelper.error("Unauthorized", 401);
}

export async function requireScrapeAdminSameOriginSession(
	req: Request,
): Promise<Response | null> {
	const authError = await requireScrapeAdminSession(req);
	if (authError) return authError;
	if (!sameOrigin(req)) return ResponseHelper.error("Forbidden", 403);
	return null;
}

export async function requireScrapeAdminMutation(
	req: Request,
): Promise<Response | null> {
	const authError = await requireScrapeAdminSameOriginSession(req);
	if (authError) return authError;
	const csrfCookie = getCookie(req, CSRF_COOKIE);
	const csrfHeader = req.headers.get(CSRF_HEADER) ?? "";
	if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)) {
		return ResponseHelper.error("Forbidden", 403);
	}
	return null;
}
