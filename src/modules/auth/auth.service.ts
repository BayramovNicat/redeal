import {
	AUTH_SESSION_TTL_SECONDS,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GOOGLE_REDIRECT_URI,
} from "@/config.js";
import {
	signValue,
	verifyAndExtractSignedValue,
} from "@/modules/auth/auth.cookies.js";
import { prisma } from "@/utils/prisma.js";

export interface GoogleUserProfile {
	sub: string;
	email: string;
	email_verified?: boolean;
	name?: string;
	picture?: string;
}

export function isGoogleConfigured(): boolean {
	return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function resolveRedirectUri(req: Request): string {
	if (GOOGLE_REDIRECT_URI) return GOOGLE_REDIRECT_URI;
	const url = new URL(req.url);
	return `${url.origin}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "openid email profile",
		state,
		prompt: "select_account",
		access_type: "online",
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
	code: string,
	redirectUri: string,
): Promise<{ access_token: string; id_token?: string }> {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			code,
			client_id: GOOGLE_CLIENT_ID,
			client_secret: GOOGLE_CLIENT_SECRET,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}),
	});

	if (!response.ok) {
		const errBody = await response.text();
		throw new Error(
			`Google OAuth token exchange failed (${response.status}): ${errBody}`,
		);
	}

	const data = (await response.json()) as {
		access_token?: string;
		id_token?: string;
	};
	if (!data.access_token) {
		throw new Error("No access_token returned by Google OAuth");
	}

	return {
		access_token: data.access_token,
		id_token: data.id_token,
	};
}

export async function fetchGoogleUserProfile(
	accessToken: string,
): Promise<GoogleUserProfile> {
	const response = await fetch(
		"https://www.googleapis.com/oauth2/v3/userinfo",
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(
			`Failed to fetch Google user profile (${response.status}): ${errText}`,
		);
	}

	const profile = (await response.json()) as GoogleUserProfile;
	if (!profile.email) {
		throw new Error("Google user profile did not return an email address");
	}

	return profile;
}

// Whitelist management
export async function isEmailWhitelisted(email: string): Promise<boolean> {
	if (!email) return false;
	const normalized = email.trim().toLowerCase();
	const record = await prisma.whitelistedEmail.findUnique({
		where: { email: normalized },
	});
	return Boolean(record);
}

export async function addWhitelistedEmail(
	email: string,
	note?: string,
): Promise<{ email: string; note: string | null; created_at: Date }> {
	const normalized = email.trim().toLowerCase();
	return prisma.whitelistedEmail.upsert({
		where: { email: normalized },
		update: { note: note ?? null },
		create: {
			email: normalized,
			note: note ?? null,
		},
	});
}

export async function removeWhitelistedEmail(email: string): Promise<boolean> {
	const normalized = email.trim().toLowerCase();
	try {
		await prisma.whitelistedEmail.delete({
			where: { email: normalized },
		});
		return true;
	} catch {
		return false;
	}
}

export async function getWhitelistedEmails() {
	return prisma.whitelistedEmail.findMany({
		orderBy: { created_at: "desc" },
	});
}

// User & session management
export async function upsertGoogleUser(profile: GoogleUserProfile) {
	const normalizedEmail = profile.email.trim().toLowerCase();
	return prisma.user.upsert({
		where: { email: normalizedEmail },
		update: {
			name: profile.name ?? null,
			avatar: profile.picture ?? null,
			google_id: profile.sub ?? null,
		},
		create: {
			email: normalizedEmail,
			name: profile.name ?? null,
			avatar: profile.picture ?? null,
			google_id: profile.sub ?? null,
		},
	});
}

function generateRandomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export async function createSession(userId: string): Promise<{
	signedCookieValue: string;
	expiresAt: Date;
}> {
	const token = generateRandomToken();
	const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000);

	await prisma.session.create({
		data: {
			token,
			user_id: userId,
			expires_at: expiresAt,
		},
	});

	const signedCookieValue = await signValue(token);
	return { signedCookieValue, expiresAt };
}

export async function validateSession(signedCookieValue: string) {
	if (!signedCookieValue) return null;

	const rawToken = await verifyAndExtractSignedValue(signedCookieValue);
	if (!rawToken) return null;

	const session = await prisma.session.findUnique({
		where: { token: rawToken },
		include: { user: true },
	});

	if (!session) return null;

	if (session.expires_at.getTime() <= Date.now()) {
		// Session expired
		await prisma.session.delete({ where: { token: rawToken } }).catch(() => {});
		return null;
	}

	// Verify user's email is STILL whitelisted
	const whitelisted = await isEmailWhitelisted(session.user.email);
	if (!whitelisted) {
		// Revoke session immediately if email removed from whitelist
		await prisma.session.delete({ where: { token: rawToken } }).catch(() => {});
		return null;
	}

	return session.user;
}

export async function destroySession(signedCookieValue: string): Promise<void> {
	if (!signedCookieValue) return;
	const rawToken = await verifyAndExtractSignedValue(signedCookieValue);
	if (!rawToken) return;

	await prisma.session.delete({ where: { token: rawToken } }).catch(() => {});
}
