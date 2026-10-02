import type { User } from "@prisma/client";
import { AUTH_ENABLED, IS_DEV, SCRAPE_ADMIN_TOKEN } from "@/config.js";
import { getCookie, SESSION_COOKIE_NAME } from "@/modules/auth/auth.cookies.js";
import { validateSession } from "@/modules/auth/auth.service.js";
import { ResponseHelper } from "@/utils/response.js";

export async function getUserFromRequest(req: Request): Promise<User | null> {
	if (!AUTH_ENABLED) {
		return {
			id: "auth-disabled",
			email: "anonymous@redeal.local",
			name: "Local User",
			avatar: null,
			google_id: null,
			role: "admin",
			created_at: new Date(),
			updated_at: new Date(),
		};
	}

	// 1. Check HTTP-only cookie
	const cookieValue = getCookie(req, SESSION_COOKIE_NAME);
	if (cookieValue) {
		const user = await validateSession(cookieValue);
		if (user) return user;
	}

	// 2. Check Bearer token / header
	const authHeader = req.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7).trim();
		if (token) {
			const user = await validateSession(token);
			if (user) return user;
		}
	}

	// 3. Optional dev/test bypass with Scrape Admin Token
	const testHeader =
		req.headers.get("x-auth-token") ?? req.headers.get("x-scrape-admin-token");
	if (
		(IS_DEV || process.env.NODE_ENV === "test") &&
		SCRAPE_ADMIN_TOKEN &&
		testHeader === SCRAPE_ADMIN_TOKEN
	) {
		return {
			id: "test-admin",
			email: "admin@redeal.local",
			name: "Test Admin",
			avatar: null,
			google_id: null,
			role: "admin",
			created_at: new Date(),
			updated_at: new Date(),
		};
	}

	return null;
}

export function requireAuth(
	handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
	return async (req: Request): Promise<Response> => {
		const user = await getUserFromRequest(req);
		if (!user) {
			return ResponseHelper.error(
				"Unauthorized: Please sign in with an authorized Google account",
				401,
			);
		}
		return handler(req);
	};
}

export function requireAdmin(
	handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
	return async (req: Request): Promise<Response> => {
		const user = await getUserFromRequest(req);
		if (!user) {
			return ResponseHelper.error(
				"Unauthorized: Please sign in with an authorized Google account",
				401,
			);
		}
		if (user.role !== "admin") {
			return ResponseHelper.error(
				"Forbidden: Admin privileges required",
				403,
			);
		}
		return handler(req);
	};
}
