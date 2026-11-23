import { describe, expect, test } from "bun:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { br } from "@/middleware/brotli.js";
import { routes } from "@/routes.js";

describe("br compression middleware", () => {
	const payload = { ok: true, items: Array.from({ length: 20 }, (_, i) => i) };
	const jsonHandler = br(() => Response.json(payload));

	test("compresses JSON with brotli when Accept-Encoding includes br", async () => {
		const res = await jsonHandler(
			new Request("http://localhost/test", {
				headers: { "Accept-Encoding": "gzip, deflate, br" },
			}),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Encoding")).toBe("br");
		expect(res.headers.get("Vary")).toContain("Accept-Encoding");
		expect(res.headers.get("Content-Length")).toBeNull();

		const decompressed = JSON.parse(
			brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString(
				"utf8",
			),
		);
		expect(decompressed).toEqual(payload);
	});

	test("falls back to gzip when Accept-Encoding includes gzip without br", async () => {
		const res = await jsonHandler(
			new Request("http://localhost/test", {
				headers: { "Accept-Encoding": "gzip, deflate" },
			}),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Encoding")).toBe("gzip");
		expect(res.headers.get("Vary")).toContain("Accept-Encoding");

		const decompressed = JSON.parse(
			gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"),
		);
		expect(decompressed).toEqual(payload);
	});

	test("leaves response uncompressed when Accept-Encoding has neither br nor gzip", async () => {
		const res = await jsonHandler(new Request("http://localhost/test"));

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Encoding")).toBeNull();
		expect(await res.json()).toEqual(payload);
	});

	test("skips compression for 302 redirects and 204 empty responses", async () => {
		const redirectHandler = br(
			() =>
				new Response(null, {
					status: 302,
					headers: { Location: "http://localhost/" },
				}),
		);
		const emptyHandler = br(() => new Response(null, { status: 204 }));

		const redirectRes = await redirectHandler(
			new Request("http://localhost/test", {
				headers: { "Accept-Encoding": "br" },
			}),
		);
		expect(redirectRes.status).toBe(302);
		expect(redirectRes.headers.get("Content-Encoding")).toBeNull();

		const emptyRes = await emptyHandler(
			new Request("http://localhost/test", {
				headers: { "Accept-Encoding": "br" },
			}),
		);
		expect(emptyRes.status).toBe(204);
		expect(emptyRes.headers.get("Content-Encoding")).toBeNull();
	});

	test("appends Accept-Encoding to existing Vary header without duplicating", async () => {
		const varyHandler = br(
			() =>
				new Response(JSON.stringify(payload), {
					headers: {
						"Content-Type": "application/json",
						Vary: "Origin",
					},
				}),
		);

		const res = await varyHandler(
			new Request("http://localhost/test", {
				headers: { "Accept-Encoding": "br" },
			}),
		);
		expect(res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
	});
});

describe("routes compression coverage", () => {
	test("unauthenticated requests to protected JSON routes still compress 401 responses", async () => {
		const res = await routes["/api/deals/price-drops"].GET(
			new Request("http://localhost/api/deals/price-drops", {
				headers: { "Accept-Encoding": "br" },
			}),
		);

		expect(res.status).toBe(401);
		expect(res.headers.get("Content-Encoding")).toBe("br");
		const body = JSON.parse(
			brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString(
				"utf8",
			),
		) as { error?: string };
		expect(body.error).toContain("Unauthorized");
	});

	test("/api/auth/me compresses JSON responses", async () => {
		const res = await routes["/api/auth/me"].GET(
			new Request("http://localhost/api/auth/me", {
				headers: { "Accept-Encoding": "gzip" },
			}),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Encoding")).toBe("gzip");
		const body = JSON.parse(
			gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"),
		) as { authenticated?: boolean };
		expect(typeof body.authenticated).toBe("boolean");
	});
});
