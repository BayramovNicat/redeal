export const PORT = Number(process.env.PORT ?? 3000);
export const IS_DEV = process.env.NODE_ENV === "development";
export const SCRAPE_ADMIN_TOKEN = process.env.SCRAPE_ADMIN_TOKEN ?? "";
export const SCRAPE_ADMIN_PASSWORD =
	process.env.SCRAPE_ADMIN_PASSWORD ?? SCRAPE_ADMIN_TOKEN;
export const SCRAPE_ADMIN_SESSION_SECRET =
	process.env.SCRAPE_ADMIN_SESSION_SECRET ?? SCRAPE_ADMIN_PASSWORD;
export const SCRAPE_ADMIN_SESSION_TTL_SECONDS = Number(
	process.env.SCRAPE_ADMIN_SESSION_TTL_SECONDS ?? 8 * 60 * 60,
);
export const CSP =
	"require-trusted-types-for 'script'; trusted-types redeal default;";
export const TELEGRAM_WEBHOOK_SECRET =
	process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
export const AUTH_SESSION_SECRET =
	process.env.AUTH_SESSION_SECRET ??
	process.env.SCRAPE_ADMIN_SESSION_SECRET ??
	"redeal-auth-secret-key-change-in-production";
export const AUTH_SESSION_TTL_SECONDS = Number(
	process.env.AUTH_SESSION_TTL_SECONDS ?? 30 * 24 * 60 * 60, // 30 days
);
export const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";
