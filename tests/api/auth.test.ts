import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	addWhitelistedEmail,
	createSession,
	isEmailWhitelisted,
	removeWhitelistedEmail,
	upsertGoogleUser,
	validateSession,
} from "../../src/modules/auth/auth.service.js";
import { prisma } from "../../src/utils/prisma.js";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

describe("Authentication & Whitelist System", () => {
	const testEmail = "test-auth-suite@redeal.local";
	let testUserId = "";
	let validSessionCookie = "";

	beforeAll(async () => {
		// Clean up any old test records
		await prisma.whitelistedEmail
			.deleteMany({
				where: { email: { in: [testEmail, "nonwhitelisted@redeal.local"] } },
			})
			.catch(() => {});
		await prisma.user
			.deleteMany({
				where: { email: { in: [testEmail, "nonwhitelisted@redeal.local"] } },
			})
			.catch(() => {});

		// Whitelist test user and create account
		await addWhitelistedEmail(testEmail, "Auth Unit Test Suite");
		const user = await upsertGoogleUser({
			sub: "google-uid-test-123",
			email: testEmail,
			name: "Test Auth User",
		});
		testUserId = user.id;

		const session = await createSession(testUserId);
		validSessionCookie = `redeal_session=${session.signedCookieValue}`;
	});

	afterAll(async () => {
		await prisma.whitelistedEmail
			.deleteMany({
				where: { email: { in: [testEmail, "nonwhitelisted@redeal.local"] } },
			})
			.catch(() => {});
		await prisma.user
			.deleteMany({
				where: { email: { in: [testEmail, "nonwhitelisted@redeal.local"] } },
			})
			.catch(() => {});
	});

	test("unauthenticated requests to protected endpoints return 401", async () => {
		const res = await fetch(`${baseUrl}/api/deals/locations`);
		expect(res.status).toBe(401);

		const body = (await res.json()) as { error?: string };
		expect(body.error).toContain("Unauthorized");
	});

	test("authenticated requests with valid session cookie are accepted", async () => {
		const res = await fetch(`${baseUrl}/api/deals/locations`, {
			headers: { cookie: validSessionCookie },
		});
		expect(res.status).toBe(200);

		const body = (await res.json()) as { data?: unknown[] };
		expect(Array.isArray(body.data)).toBe(true);
	});

	test("/api/auth/me returns authenticated: false when no session", async () => {
		const res = await fetch(`${baseUrl}/api/auth/me`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			authenticated: boolean;
			user: unknown;
		};
		expect(body.authenticated).toBe(false);
		expect(body.user).toBeNull();
	});

	test("/api/auth/me returns authenticated user details when session provided", async () => {
		const res = await fetch(`${baseUrl}/api/auth/me`, {
			headers: { cookie: validSessionCookie },
		});
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			authenticated: boolean;
			user: { email: string; name: string };
		};
		expect(body.authenticated).toBe(true);
		expect(body.user.email).toBe(testEmail);
		expect(body.user.name).toBe("Test Auth User");
	});

	test("whitelist system normalizes email casing and trimming", async () => {
		const mixedCaseEmail = "  TEST-AUTH-SUITE@redeal.local ";
		const isWhitelisted = await isEmailWhitelisted(mixedCaseEmail);
		expect(isWhitelisted).toBe(true);
	});

	test("non-whitelisted email is denied access", async () => {
		const isWhitelisted = await isEmailWhitelisted("random-stranger@gmail.com");
		expect(isWhitelisted).toBe(false);
	});

	test("removing an email from whitelist immediately revokes existing session", async () => {
		// Create a temporary user with whitelist
		const tempEmail = "temporary-user@redeal.local";
		await addWhitelistedEmail(tempEmail, "Temp");
		const tempUser = await upsertGoogleUser({
			sub: "temp-sub",
			email: tempEmail,
			name: "Temp User",
		});
		const { signedCookieValue } = await createSession(tempUser.id);

		// Valid while whitelisted
		const validUser = await validateSession(signedCookieValue);
		expect(validUser).not.toBeNull();
		expect(validUser?.email).toBe(tempEmail);

		// Remove from whitelist
		await removeWhitelistedEmail(tempEmail);

		// Now validateSession must immediately reject
		const revokedUser = await validateSession(signedCookieValue);
		expect(revokedUser).toBeNull();

		// Clean up
		await prisma.user
			.deleteMany({ where: { email: tempEmail } })
			.catch(() => {});
	});

	test("whitelist API endpoints allow authorized user to manage whitelist", async () => {
		const newEmail = "new-invited-agent@redeal.local";

		// 1. Add email
		const addRes = await fetch(`${baseUrl}/api/auth/whitelist`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: validSessionCookie,
			},
			body: JSON.stringify({ email: newEmail, note: "Agent invited by admin" }),
		});
		expect(addRes.status).toBe(200);

		// 2. Verify in list
		const listRes = await fetch(`${baseUrl}/api/auth/whitelist`, {
			headers: { cookie: validSessionCookie },
		});
		expect(listRes.status).toBe(200);
		const listBody = (await listRes.json()) as {
			data: Array<{ email: string; note?: string }>;
		};
		const found = listBody.data.find((e) => e.email === newEmail);
		expect(found).toBeDefined();
		expect(found?.note).toBe("Agent invited by admin");

		// 3. Remove email
		const delRes = await fetch(
			`${baseUrl}/api/auth/whitelist/${encodeURIComponent(newEmail)}`,
			{
				method: "DELETE",
				headers: { cookie: validSessionCookie },
			},
		);
		expect(delRes.status).toBe(200);

		// 4. Verify removed
		expect(await isEmailWhitelisted(newEmail)).toBe(false);
	});

	test("unauthenticated user cannot manage whitelist via API", async () => {
		const addRes = await fetch(`${baseUrl}/api/auth/whitelist`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "hacker@evil.com" }),
		});
		expect(addRes.status).toBe(401);
	});

	test("/api/auth/logout clears session", async () => {
		const tempEmail = "logout-test@redeal.local";
		await addWhitelistedEmail(tempEmail);
		const tempUser = await upsertGoogleUser({
			sub: "logout-sub",
			email: tempEmail,
		});
		const { signedCookieValue } = await createSession(tempUser.id);
		const sessionCookie = `redeal_session=${signedCookieValue}`;

		const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
			method: "POST",
			headers: { cookie: sessionCookie },
		});
		expect(logoutRes.status).toBe(200);
		const setCookie = logoutRes.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("redeal_session=;");

		// Clean up
		await removeWhitelistedEmail(tempEmail);
		await prisma.user
			.deleteMany({ where: { email: tempEmail } })
			.catch(() => {});
	});
});
