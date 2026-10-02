import {
	createClearOAuthStateCookieHeader,
	createClearSessionCookieHeader,
	createOAuthStateCookieHeader,
	createSessionCookieHeader,
	getCookie,
	OAUTH_STATE_COOKIE_NAME,
	SESSION_COOKIE_NAME,
	signValue,
	verifyAndExtractSignedValue,
} from "@/modules/auth/auth.cookies.js";
import { getUserFromRequest } from "@/modules/auth/auth.middleware.js";
import {
	addWhitelistedEmail,
	buildGoogleAuthUrl,
	createSession,
	destroySession,
	exchangeGoogleCode,
	fetchGoogleUserProfile,
	getWhitelistedEmails,
	isEmailWhitelisted,
	isGoogleConfigured,
	removeWhitelistedEmail,
	resolveRedirectUri,
	upsertGoogleUser,
} from "@/modules/auth/auth.service.js";
import { ResponseHelper } from "@/utils/response.js";

export async function handleGoogleLogin(req: Request): Promise<Response> {
	if (!isGoogleConfigured()) {
		return Response.redirect(
			new URL("/login?error=missing_config", req.url).toString(),
			302,
		);
	}

	const redirectUri = resolveRedirectUri(req);
	const rawNonce = crypto.randomUUID();
	const signedState = await signValue(rawNonce);

	const googleUrl = buildGoogleAuthUrl(signedState, redirectUri);
	const headers = new Headers();
	headers.set("Location", googleUrl);
	headers.append("Set-Cookie", createOAuthStateCookieHeader(signedState));

	return new Response(null, { status: 302, headers });
}

export async function handleGoogleCallback(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const errorParam = url.searchParams.get("error");
	if (errorParam) {
		return Response.redirect(
			new URL("/login?error=oauth_failed", req.url).toString(),
			302,
		);
	}

	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (!code || !state) {
		return Response.redirect(
			new URL("/login?error=invalid_request", req.url).toString(),
			302,
		);
	}

	// Verify OAuth state cookie matches returned state
	const savedState = getCookie(req, OAUTH_STATE_COOKIE_NAME);
	if (!savedState || savedState !== state) {
		return Response.redirect(
			new URL("/login?error=invalid_state", req.url).toString(),
			302,
		);
	}

	const validatedNonce = await verifyAndExtractSignedValue(state);
	if (!validatedNonce) {
		return Response.redirect(
			new URL("/login?error=invalid_state", req.url).toString(),
			302,
		);
	}

	const redirectUri = resolveRedirectUri(req);

	try {
		const tokens = await exchangeGoogleCode(code, redirectUri);
		const profile = await fetchGoogleUserProfile(tokens.access_token);

		if (!profile.email) {
			return Response.redirect(
				new URL("/login?error=no_email", req.url).toString(),
				302,
			);
		}

		const email = profile.email.toLowerCase().trim();

		// Whitelist check
		const whitelisted = await isEmailWhitelisted(email);
		if (!whitelisted) {
			const headers = new Headers();
			headers.set(
				"Location",
				new URL(
					`/login?error=not_whitelisted&email=${encodeURIComponent(email)}`,
					req.url,
				).toString(),
			);
			headers.append("Set-Cookie", createClearOAuthStateCookieHeader());
			return new Response(null, { status: 302, headers });
		}

		// User is whitelisted -> create / update user and session
		const user = await upsertGoogleUser(profile);
		const { signedCookieValue } = await createSession(user.id);

		const headers = new Headers();
		headers.set("Location", new URL("/", req.url).toString());
		headers.append("Set-Cookie", createSessionCookieHeader(signedCookieValue));
		headers.append("Set-Cookie", createClearOAuthStateCookieHeader());

		return new Response(null, { status: 302, headers });
	} catch (err) {
		console.error("Google OAuth error:", err);
		return Response.redirect(
			new URL("/login?error=oauth_failed", req.url).toString(),
			302,
		);
	}
}

export async function handleGetMe(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return Response.json(
			{ ok: true, authenticated: false, user: null },
			{ headers: { "Cache-Control": "no-store" } },
		);
	}

	return Response.json(
		{
			ok: true,
			authenticated: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				avatar: user.avatar,
				role: user.role,
			},
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}

export async function handleLogout(req: Request): Promise<Response> {
	const cookieValue = getCookie(req, SESSION_COOKIE_NAME);
	if (cookieValue) {
		await destroySession(cookieValue);
	}

	const headers = new Headers();
	headers.append("Set-Cookie", createClearSessionCookieHeader());

	// If request came as standard form or browser GET, redirect to /login
	if (
		req.method === "GET" ||
		req.headers.get("accept")?.includes("text/html")
	) {
		headers.set("Location", new URL("/login", req.url).toString());
		return new Response(null, { status: 302, headers });
	}

	return Response.json({ ok: true }, { headers });
}

// Whitelist management endpoints
export async function handleGetWhitelist(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const emails = await getWhitelistedEmails();
	return Response.json({ ok: true, data: emails });
}

export async function handleAddWhitelist(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	let body: { email?: unknown; note?: unknown } = {};
	try {
		body = (await req.json()) as { email?: unknown; note?: unknown };
	} catch {
		return ResponseHelper.error("Invalid JSON body", 400);
	}

	if (typeof body.email !== "string" || !body.email.includes("@")) {
		return ResponseHelper.error("A valid email address is required", 400);
	}

	const note = typeof body.note === "string" ? body.note : undefined;
	const result = await addWhitelistedEmail(body.email, note);
	return Response.json({ ok: true, data: result });
}

export async function handleRemoveWhitelist(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const url = new URL(req.url);
	const raw = url.pathname.split("/").pop() ?? "";
	const email = decodeURIComponent(raw).trim().toLowerCase();
	if (!email?.includes("@")) {
		return ResponseHelper.error("Invalid email specified", 400);
	}

	const removed = await removeWhitelistedEmail(email);
	return Response.json({ ok: true, removed });
}
