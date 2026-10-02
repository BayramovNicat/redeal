import {
	AUTH_SESSION_SECRET,
	AUTH_SESSION_TTL_SECONDS,
	IS_DEV,
} from "@/config.js";

export const SESSION_COOKIE_NAME = "redeal_session";
export const OAUTH_STATE_COOKIE_NAME = "redeal_oauth_state";

const encoder = new TextEncoder();

export function getCookie(req: Request, name: string): string {
	const cookieHeader = req.headers.get("cookie");
	if (!cookieHeader) return "";

	for (const part of cookieHeader.split(";")) {
		const [rawKey, ...rawValue] = part.trim().split("=");
		if (rawKey === name) return rawValue.join("=");
	}
	return "";
}

export function serializeCookie(
	name: string,
	value: string,
	options: {
		httpOnly?: boolean;
		maxAge: number;
		path?: string;
		sameSite?: "Strict" | "Lax" | "None";
	},
): string {
	const parts = [
		`${name}=${value}`,
		`Max-Age=${options.maxAge}`,
		`Path=${options.path ?? "/"}`,
		`SameSite=${options.sameSite ?? "Lax"}`,
	];
	if (options.httpOnly !== false) parts.push("HttpOnly");
	if (!IS_DEV) parts.push("Secure");
	return parts.join("; ");
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function safeEqual(a: string, b: string): boolean {
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	let diff = aBytes.length ^ bBytes.length;
	const len = Math.max(aBytes.length, bBytes.length);
	for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	return diff === 0;
}

export async function signValue(
	value: string,
	secret = AUTH_SESSION_SECRET,
): Promise<string> {
	const key = await getSigningKey(secret);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(value),
	);
	const sigBase64 = base64UrlEncode(new Uint8Array(signature));
	return `${value}.${sigBase64}`;
}

export async function verifyAndExtractSignedValue(
	signedValue: string,
	secret = AUTH_SESSION_SECRET,
): Promise<string | null> {
	const [val, signature, extra] = signedValue.split(".");
	if (!val || !signature || extra !== undefined) return null;

	const key = await getSigningKey(secret);
	const expectedSigBytes = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(val),
	);
	const expectedSig = base64UrlEncode(new Uint8Array(expectedSigBytes));

	if (!safeEqual(signature, expectedSig)) return null;
	return val;
}

export function createSessionCookieHeader(signedSessionToken: string): string {
	return serializeCookie(SESSION_COOKIE_NAME, signedSessionToken, {
		httpOnly: true,
		maxAge: AUTH_SESSION_TTL_SECONDS,
		path: "/",
		sameSite: "Lax",
	});
}

export function createClearSessionCookieHeader(): string {
	return serializeCookie(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "Lax",
	});
}

export function createOAuthStateCookieHeader(stateValue: string): string {
	return serializeCookie(OAUTH_STATE_COOKIE_NAME, stateValue, {
		httpOnly: true,
		maxAge: 15 * 60, // 15 minutes
		path: "/api/auth",
		sameSite: "Lax",
	});
}

export function createClearOAuthStateCookieHeader(): string {
	return serializeCookie(OAUTH_STATE_COOKIE_NAME, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/api/auth",
		sameSite: "Lax",
	});
}
