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
	approveAccessRequest,
	buildGoogleAuthUrl,
	createSession,
	destroySession,
	dismissAccessRequest,
	exchangeGoogleCode,
	fetchGoogleUserProfile,
	getAccessRequests,
	getWhitelistedEmails,
	isEmailWhitelisted,
	isGoogleConfigured,
	recordAccessRequest,
	removeWhitelistedEmail,
	resolveRedirectUri,
	upsertGoogleUser,
} from "@/modules/auth/auth.service.js";
import { ResponseHelper } from "@/utils/response.js";

function sanitizeReturnTo(raw: string | null): string {
	if (!raw) return "/";
	const trimmed = raw.trim();
	if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
	if (trimmed.startsWith("/login") || trimmed.startsWith("/api/")) return "/";
	return trimmed;
}

function encodeOAuthStatePayload(nonce: string, returnTo: string): string {
	const json = JSON.stringify({ n: nonce, r: returnTo });
	return Buffer.from(json, "utf8").toString("base64url");
}

function decodeOAuthStatePayload(payload: string): {
	nonce: string;
	returnTo: string;
} {
	try {
		const decoded = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as { n?: unknown; r?: unknown };
		if (typeof decoded.n === "string" && decoded.n.length > 0) {
			return {
				nonce: decoded.n,
				returnTo: sanitizeReturnTo(
					typeof decoded.r === "string" ? decoded.r : null,
				),
			};
		}
	} catch {
		// Backward compatibility for plain UUID nonces
	}
	return { nonce: payload, returnTo: "/" };
}

export async function handleGoogleLogin(req: Request): Promise<Response> {
	if (!isGoogleConfigured()) {
		return Response.redirect(
			new URL("/login?error=missing_config", req.url).toString(),
			302,
		);
	}

	const url = new URL(req.url);
	const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
	const redirectUri = resolveRedirectUri(req);
	const rawNonce = crypto.randomUUID();
	const statePayload = encodeOAuthStatePayload(rawNonce, returnTo);
	const signedState = await signValue(statePayload);

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

	const validatedPayload = await verifyAndExtractSignedValue(state);
	if (!validatedPayload) {
		return Response.redirect(
			new URL("/login?error=invalid_state", req.url).toString(),
			302,
		);
	}
	const { returnTo } = decodeOAuthStatePayload(validatedPayload);

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
			await recordAccessRequest(profile);
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
		headers.set("Location", new URL(returnTo, req.url).toString());
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

	// If request came as standard form or browser GET, redirect to public preview
	if (
		req.method === "GET" ||
		req.headers.get("accept")?.includes("text/html")
	) {
		headers.set("Location", new URL("/", req.url).toString());
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
	return Response.json(
		{ ok: true, data: emails },
		{ headers: { "Cache-Control": "no-store" } },
	);
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

function extractEmailParam(req: Request, fromEndOffset = 1): string | null {
	const paramEmail = (req as Request & { params?: { email?: string } }).params
		?.email;
	let raw = paramEmail;
	if (!raw) {
		const segments = new URL(req.url).pathname.split("/").filter(Boolean);
		raw = segments[segments.length - fromEndOffset] ?? "";
	}
	try {
		const email = decodeURIComponent(raw).trim().toLowerCase();
		return email.includes("@") ? email : null;
	} catch {
		return null;
	}
}

export async function handleRemoveWhitelist(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const email = extractEmailParam(req, 1);
	if (!email) {
		return ResponseHelper.error("Invalid email specified", 400);
	}

	const removed = await removeWhitelistedEmail(email);
	return Response.json({ ok: true, removed });
}

// Pending sign-in access request endpoints
export async function handleGetAccessRequests(req: Request): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const requests = await getAccessRequests();
	return Response.json(
		{ ok: true, data: requests },
		{ headers: { "Cache-Control": "no-store" } },
	);
}

export async function handleApproveAccessRequest(
	req: Request,
): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const email = extractEmailParam(req, 2);
	if (!email) {
		return ResponseHelper.error("Invalid email specified", 400);
	}

	let note: string | undefined;
	try {
		const text = await req.text();
		if (text.trim()) {
			const body = JSON.parse(text) as { note?: unknown };
			if (typeof body.note === "string") {
				note = body.note;
			}
		}
	} catch {
		return ResponseHelper.error("Invalid JSON body", 400);
	}

	const approved = await approveAccessRequest(email, note);
	if (!approved) {
		return ResponseHelper.error("Access request not found", 404);
	}

	return Response.json({ ok: true, data: approved });
}

export async function handleDismissAccessRequest(
	req: Request,
): Promise<Response> {
	const user = await getUserFromRequest(req);
	if (!user) {
		return ResponseHelper.error("Unauthorized", 401);
	}

	const email = extractEmailParam(req, 1);
	if (!email) {
		return ResponseHelper.error("Invalid email specified", 400);
	}

	const removed = await dismissAccessRequest(email);
	return Response.json({ ok: true, removed });
}
