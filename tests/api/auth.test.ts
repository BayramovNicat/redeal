import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { handleGoogleCallback } from "../../src/modules/auth/auth.controller.js";
import {
	OAUTH_STATE_COOKIE_NAME,
	signValue,
} from "../../src/modules/auth/auth.cookies.js";
import {
	addWhitelistedEmail,
	createSession,
	getAccessRequests,
	isEmailWhitelisted,
	recordAccessRequest,
	removeWhitelistedEmail,
	setAdminRole,
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
				where: {
					email: {
						in: [
							testEmail,
							"nonwhitelisted@redeal.local",
							"regular-user@redeal.local",
						],
					},
				},
			})
			.catch(() => {});
		await prisma.user
			.deleteMany({
				where: {
					email: {
						in: [
							testEmail,
							"nonwhitelisted@redeal.local",
							"regular-user@redeal.local",
						],
					},
				},
			})
			.catch(() => {});

		// Whitelist test user as admin and create account
		await addWhitelistedEmail(testEmail, "Auth Unit Test Suite");
		const user = await upsertGoogleUser({
			sub: "google-uid-test-123",
			email: testEmail,
			name: "Test Auth User",
		});
		await setAdminRole(testEmail, true);
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
		const dropsRes = await fetch(
			`${baseUrl}/api/deals/price-drops?location=Yasamal`,
		);
		expect(dropsRes.status).toBe(401);

		const dropsBody = (await dropsRes.json()) as { error?: string };
		expect(dropsBody.error).toContain("Unauthorized");

		const alertsRes = await fetch(`${baseUrl}/api/alerts?chatId=123456`);
		expect(alertsRes.status).toBe(401);
	});

	test("public preview endpoints work without authentication (including location & discount threshold)", async () => {
		const locRes = await fetch(`${baseUrl}/api/deals/locations`);
		expect(locRes.status).toBe(200);
		const locBody = (await locRes.json()) as { data?: unknown[] };
		expect(Array.isArray(locBody.data)).toBe(true);

		const heatRes = await fetch(`${baseUrl}/api/heatmap`);
		expect(heatRes.status).toBe(200);
		const heatBody = (await heatRes.json()) as { data?: unknown[] };
		expect(Array.isArray(heatBody.data)).toBe(true);

		const trendRes = await fetch(`${baseUrl}/api/deals/trend?location=Yasamal`);
		expect(trendRes.status).toBe(200);

		for (const query of [
			"location=__all__&threshold=10",
			"location=Yasamal&threshold=25",
		]) {
			const dealsRes = await fetch(
				`${baseUrl}/api/deals/undervalued?${query}&limit=200`,
			);
			expect(dealsRes.status).toBe(200);
			const dealsBody = (await dealsRes.json()) as {
				preview?: boolean;
				preview_limit?: number;
				limit?: number;
				data?: unknown[];
			};
			expect(dealsBody.preview).toBe(true);
			expect(dealsBody.preview_limit).toBe(50);
			expect(dealsBody.limit).toBe(50);
			expect(Array.isArray(dealsBody.data)).toBe(true);

			const mapRes = await fetch(`${baseUrl}/api/deals/map-pins?${query}`);
			expect(mapRes.status).toBe(200);
			const mapBody = (await mapRes.json()) as {
				preview?: boolean;
				data?: unknown[];
			};
			expect(mapBody.preview).toBe(true);
			expect(Array.isArray(mapBody.data)).toBe(true);
		}
	});

	test("unauthenticated filtered, sorted, or paginated deal requests return 401", async () => {
		const restrictedUrls = [
			"/api/deals/undervalued?location=Yasamal&threshold=10&minPrice=50000",
			"/api/deals/undervalued?location=__all__&threshold=10&hasDocument=true",
			"/api/deals/undervalued?location=__all__&threshold=10&listingType=rent",
			"/api/deals/undervalued?location=__all__&threshold=10&sort=price-asc",
			"/api/deals/undervalued?location=__all__&threshold=10&descriptionSearch=metro",
			"/api/deals/undervalued?location=Yasamal&threshold=20&offset=50",
			"/api/deals/map-pins?location=Yasamal&threshold=20&minRooms=3",
			"/api/deals/map-pins?location=__all__&threshold=10&category=new",
		];

		for (const path of restrictedUrls) {
			const res = await fetch(`${baseUrl}${path}`);
			expect(res.status).toBe(401);
			const body = (await res.json()) as { code?: string; error?: string };
			expect(body.code).toBe("AUTH_REQUIRED");
			expect(body.error).toContain("Unauthorized");
		}
	});

	test("authenticated requests with valid session cookie can filter and paginate", async () => {
		const res = await fetch(
			`${baseUrl}/api/deals/undervalued?location=Yasamal&threshold=15&minPrice=10000&sort=price-asc`,
			{
				headers: { cookie: validSessionCookie },
			},
		);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			preview?: boolean;
			data?: unknown[];
		};
		expect(body.preview).toBeUndefined();
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

	test("regular non-admin user cannot manage whitelist via API (receives 403 Forbidden)", async () => {
		const regularEmail = "regular-user@redeal.local";
		await addWhitelistedEmail(regularEmail);
		const regUser = await upsertGoogleUser({
			sub: "regular-sub-123",
			email: regularEmail,
			name: "Regular Guy",
		});
		const { signedCookieValue } = await createSession(regUser.id);
		const regularCookie = `redeal_session=${signedCookieValue}`;

		const addRes = await fetch(`${baseUrl}/api/auth/whitelist`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: regularCookie,
			},
			body: JSON.stringify({ email: "shouldfail@evil.com" }),
		});
		expect(addRes.status).toBe(403);

		// Clean up
		await removeWhitelistedEmail(regularEmail);
		await prisma.user
			.deleteMany({ where: { email: regularEmail } })
			.catch(() => {});
	});

	test("setAdminRole grants and revokes admin privileges", async () => {
		const targetEmail = "promoted-user@redeal.local";
		await addWhitelistedEmail(targetEmail);
		const user = await upsertGoogleUser({
			sub: "promo-sub",
			email: targetEmail,
		});
		expect(user.role).toBe("user");

		// Grant admin
		await setAdminRole(targetEmail, true);
		const promoted = await prisma.user.findUnique({
			where: { email: targetEmail },
		});
		expect(promoted?.role).toBe("admin");

		// Revoke admin
		await setAdminRole(targetEmail, false);
		const demoted = await prisma.user.findUnique({
			where: { email: targetEmail },
		});
		expect(demoted?.role).toBe("user");

		// Clean up
		await removeWhitelistedEmail(targetEmail);
		await prisma.user
			.deleteMany({ where: { email: targetEmail } })
			.catch(() => {});
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

	test("non-whitelisted sign-in attempts are stored as pending access requests and can be approved or dismissed by admin", async () => {
		const pendingEmail = "pending-applicant@redeal.local";
		const dismissEmail = "dismiss-applicant@redeal.local";
		const manualEmail = "manual-whitelist-clears-req@redeal.local";

		await prisma.accessRequest
			.deleteMany({
				where: { email: { in: [pendingEmail, dismissEmail, manualEmail] } },
			})
			.catch(() => {});
		await prisma.whitelistedEmail
			.deleteMany({
				where: { email: { in: [pendingEmail, dismissEmail, manualEmail] } },
			})
			.catch(() => {});

		try {
			// 1. Record non-whitelisted sign-in attempt (with mixed case)
			const firstAttempt = await recordAccessRequest({
				sub: "google-sub-pending-1",
				email: `  ${pendingEmail.toUpperCase()} `,
				name: "Pending Applicant",
				picture: "https://example.com/avatar.png",
			});
			expect(firstAttempt.email).toBe(pendingEmail);
			expect(firstAttempt.name).toBe("Pending Applicant");
			expect(firstAttempt.avatar).toBe("https://example.com/avatar.png");
			expect(firstAttempt.attempts).toBe(1);

			// 2. Repeat sign-in attempt increments attempts without throwing away data
			const secondAttempt = await recordAccessRequest({
				sub: "google-sub-pending-1",
				email: pendingEmail,
				name: "Pending Applicant",
			});
			expect(secondAttempt.attempts).toBe(2);
			expect(secondAttempt.avatar).toBe("https://example.com/avatar.png");

			// Record a second request to test dismissal
			await recordAccessRequest({
				sub: "google-sub-dismiss-1",
				email: dismissEmail,
				name: "Dismiss Me",
			});

			// 3. Unauthenticated request to /api/auth/requests returns 401
			const unauthRes = await fetch(`${baseUrl}/api/auth/requests`);
			expect(unauthRes.status).toBe(401);

			// 4. Regular non-admin user gets 403
			const regularEmail = "regular-req-checker@redeal.local";
			await addWhitelistedEmail(regularEmail);
			const regUser = await upsertGoogleUser({
				sub: "regular-req-checker-sub",
				email: regularEmail,
				name: "Regular Checker",
			});
			const { signedCookieValue: regToken } = await createSession(regUser.id);
			const regularCookie = `redeal_session=${regToken}`;

			try {
				const forbiddenList = await fetch(`${baseUrl}/api/auth/requests`, {
					headers: { cookie: regularCookie },
				});
				expect(forbiddenList.status).toBe(403);

				const forbiddenApprove = await fetch(
					`${baseUrl}/api/auth/requests/${encodeURIComponent(pendingEmail)}/approve`,
					{
						method: "POST",
						headers: { cookie: regularCookie },
					},
				);
				expect(forbiddenApprove.status).toBe(403);
			} finally {
				await removeWhitelistedEmail(regularEmail);
				await prisma.user
					.deleteMany({ where: { email: regularEmail } })
					.catch(() => {});
			}

			// 5. Admin lists pending requests
			const listRes = await fetch(`${baseUrl}/api/auth/requests`, {
				headers: { cookie: validSessionCookie },
			});
			expect(listRes.status).toBe(200);
			const listBody = (await listRes.json()) as {
				data: Array<{ email: string; name?: string; attempts: number }>;
			};
			const foundPending = listBody.data.find((r) => r.email === pendingEmail);
			expect(foundPending).toBeDefined();
			expect(foundPending?.attempts).toBe(2);
			expect(foundPending?.name).toBe("Pending Applicant");

			// 6. Admin approves pending request -> added to whitelist & removed from requests
			const approveRes = await fetch(
				`${baseUrl}/api/auth/requests/${encodeURIComponent(pendingEmail)}/approve`,
				{
					method: "POST",
					headers: { cookie: validSessionCookie },
				},
			);
			expect(approveRes.status).toBe(200);
			const approveBody = (await approveRes.json()) as {
				data: { email: string; note: string | null };
			};
			expect(approveBody.data.email).toBe(pendingEmail);
			expect(approveBody.data.note).toBe("Pending Applicant");
			expect(await isEmailWhitelisted(pendingEmail)).toBe(true);

			const remainingAfterApprove = await getAccessRequests();
			expect(remainingAfterApprove.some((r) => r.email === pendingEmail)).toBe(
				false,
			);

			// Approving again (non-existent request) returns 404
			const approveAgainRes = await fetch(
				`${baseUrl}/api/auth/requests/${encodeURIComponent(pendingEmail)}/approve`,
				{
					method: "POST",
					headers: { cookie: validSessionCookie },
				},
			);
			expect(approveAgainRes.status).toBe(404);

			// 7. Admin dismisses second request -> removed without whitelisting
			const dismissRes = await fetch(
				`${baseUrl}/api/auth/requests/${encodeURIComponent(dismissEmail)}`,
				{
					method: "DELETE",
					headers: { cookie: validSessionCookie },
				},
			);
			expect(dismissRes.status).toBe(200);
			const dismissBody = (await dismissRes.json()) as { removed: boolean };
			expect(dismissBody.removed).toBe(true);
			expect(await isEmailWhitelisted(dismissEmail)).toBe(false);

			// 8. Manually adding an email to whitelist clears any pending request for that email
			await recordAccessRequest({
				sub: "google-sub-manual-1",
				email: manualEmail,
				name: "Manual User",
			});
			await addWhitelistedEmail(manualEmail, "Manually added");
			const remainingAfterManual = await getAccessRequests();
			expect(remainingAfterManual.some((r) => r.email === manualEmail)).toBe(
				false,
			);
		} finally {
			await prisma.accessRequest
				.deleteMany({
					where: { email: { in: [pendingEmail, dismissEmail, manualEmail] } },
				})
				.catch(() => {});
			await prisma.whitelistedEmail
				.deleteMany({
					where: { email: { in: [pendingEmail, dismissEmail, manualEmail] } },
				})
				.catch(() => {});
		}
	});

	test("Google OAuth callback saves non-whitelisted sign-in as a pending access request", async () => {
		const callbackEmail = "oauth-pending-user@redeal.local";
		await prisma.accessRequest
			.deleteMany({ where: { email: callbackEmail } })
			.catch(() => {});
		await prisma.whitelistedEmail
			.deleteMany({ where: { email: callbackEmail } })
			.catch(() => {});

		const statePayload = Buffer.from(
			JSON.stringify({ n: "test-nonce-1", r: "/" }),
			"utf8",
		).toString("base64url");
		const signedState = await signValue(statePayload);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://oauth2.googleapis.com/token") {
				return Response.json({ access_token: "mock-google-token" });
			}
			if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
				return Response.json({
					sub: "google-sub-callback-1",
					email: callbackEmail,
					name: "OAuth Pending User",
					picture: "https://example.com/oauth-avatar.png",
				});
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		try {
			const req = new Request(
				`http://localhost:3000/api/auth/google/callback?code=mock-code&state=${encodeURIComponent(signedState)}`,
				{
					headers: {
						cookie: `${OAUTH_STATE_COOKIE_NAME}=${signedState}`,
					},
				},
			);

			const res = await handleGoogleCallback(req);
			expect(res.status).toBe(302);
			const location = res.headers.get("location") ?? "";
			expect(location).toContain("/login?error=not_whitelisted");
			expect(location).toContain(encodeURIComponent(callbackEmail));

			const saved = await prisma.accessRequest.findUnique({
				where: { email: callbackEmail },
			});
			expect(saved).not.toBeNull();
			expect(saved?.name).toBe("OAuth Pending User");
			expect(saved?.avatar).toBe("https://example.com/oauth-avatar.png");
			expect(saved?.google_id).toBe("google-sub-callback-1");
			expect(saved?.attempts).toBe(1);
		} finally {
			globalThis.fetch = originalFetch;
			await prisma.accessRequest
				.deleteMany({ where: { email: callbackEmail } })
				.catch(() => {});
		}
	});
});
