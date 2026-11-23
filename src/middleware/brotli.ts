import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);

type Handler = (req: Request) => Response | Promise<Response>;

function appendVary(headers: Headers, value: string): void {
	const existing = headers.get("Vary");
	if (!existing) {
		headers.set("Vary", value);
		return;
	}
	const parts = existing.split(",").map((part) => part.trim().toLowerCase());
	if (!parts.includes(value.toLowerCase())) {
		headers.set("Vary", `${existing}, ${value}`);
	}
}

export function br(handler: Handler): Handler {
	return async (req) => {
		const res = await handler(req);
		if (
			!res.body ||
			res.status === 204 ||
			res.status === 304 ||
			(res.status >= 300 && res.status < 400) ||
			res.headers.get("Content-Encoding")
		) {
			return res;
		}

		const acceptEncoding = (
			req.headers.get("Accept-Encoding") ?? ""
		).toLowerCase();
		const useBrotli = acceptEncoding.includes("br");
		const useGzip = !useBrotli && acceptEncoding.includes("gzip");
		if (!useBrotli && !useGzip) return res;

		const body = await res.arrayBuffer();
		const compressed = useBrotli
			? await compressBrotli(Buffer.from(body), {
					params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
				})
			: await compressGzip(Buffer.from(body));

		const headers = new Headers(res.headers);
		headers.set("Content-Encoding", useBrotli ? "br" : "gzip");
		appendVary(headers, "Accept-Encoding");
		headers.delete("Content-Length");
		return new Response(compressed, { status: res.status, headers });
	};
}
