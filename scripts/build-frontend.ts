import { cpSync, mkdirSync, watch } from "node:fs";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

const watchMode = process.argv.includes("--watch");

const reloadClients = new Set<{
	send(data: string): void;
	readyState: number;
}>();

if (watchMode) {
	Bun.serve({
		port: 3001,
		fetch(req, server) {
			if (server.upgrade(req)) return undefined as unknown as Response;
			return new Response("WS reload server", { status: 200 });
		},
		websocket: {
			open(ws) {
				reloadClients.add(ws);
			},
			close(ws) {
				reloadClients.delete(ws);
			},
			message() {},
		},
	});
}

mkdirSync("./public", { recursive: true });

async function build() {
	// Copy Leaflet assets
	cpSync("./node_modules/leaflet/dist/images", "./public/images", {
		recursive: true,
	});

	// Bundle + minify TS → app.js
	const jsResult = await Bun.build({
		entrypoints: ["./frontend/main.ts"],
		outdir: "./public",
		naming: "app.js",
		minify: true,
		target: "browser",
		define: { __DEV__: watchMode ? "true" : "false" },
	});
	if (!jsResult.success) {
		for (const log of jsResult.logs) console.error(log);
		throw new Error("JS build failed");
	}

	// PostCSS runs Tailwind JIT scanner → Bun minifies → styles.css
	const cssSource = await Bun.file("./frontend/styles.css").text();
	const postcssResult = await postcss([tailwindcss]).process(cssSource, {
		from: "./frontend/styles.css",
	});

	const tmpPath = "./public/.styles-tmp.css";
	await Bun.write(tmpPath, postcssResult.css);

	const cssResult = await Bun.build({
		entrypoints: [tmpPath],
		outdir: "./public",
		naming: "styles.css",
		minify: true,
	});
	if (!cssResult.success) {
		for (const log of cssResult.logs) console.error(log);
		throw new Error("CSS build failed");
	}

	await Bun.file(tmpPath).delete?.();

	// Bundle Service Worker
	const swResult = await Bun.build({
		entrypoints: ["./frontend/sw.ts"],
		outdir: "./public",
		naming: "sw.js",
		minify: true,
		target: "browser",
	});
	if (!swResult.success) {
		for (const log of swResult.logs) console.error(log);
		throw new Error("Service Worker build failed");
	}

	// Copy HTML & Static Assets
	await Bun.write("./public/index.html", Bun.file("./frontend/index.html"));
	await Bun.write("./public/robots.txt", Bun.file("./frontend/robots.txt"));
	await Bun.write("./public/favicon.png", Bun.file("./frontend/favicon.png"));
	const faviconIco = Bun.file("./frontend/favicon.ico");
	if (await faviconIco.exists()) {
		await Bun.write("./public/favicon.ico", faviconIco);
	}
	await Bun.write(
		"./public/manifest.json",
		Bun.file("./frontend/manifest.json"),
	);

	// Copy PWA Icons and Screenshots
	cpSync("./frontend/icons", "./public/icons", {
		recursive: true,
	});
	cpSync("./frontend/screenshots", "./public/screenshots", {
		recursive: true,
	});

	const jsSizeKB = (Bun.file("./public/app.js").size / 1024).toFixed(1);
	const cssSizeKB = (Bun.file("./public/styles.css").size / 1024).toFixed(1);
	const swSizeKB = (Bun.file("./public/sw.js").size / 1024).toFixed(1);
	console.log(
		`Built public/  app.js ${jsSizeKB} KB  styles.css ${cssSizeKB} KB  sw.js ${swSizeKB} KB  index.html ✓  manifest.json ✓`,
	);

	for (const client of reloadClients) {
		try {
			client.send("reload");
		} catch {}
	}
}

await build();

if (watchMode) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const SKIP_EXTS = new Set([
		".png",
		".jpg",
		".jpeg",
		".webp",
		".gif",
		".ico",
		".svg",
	]);
	watch("./frontend", { recursive: true }, (_event, filename) => {
		if (!filename) return;
		const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
		if (SKIP_EXTS.has(ext)) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			process.stdout.write(`[watch] ${filename} → rebuilding...\n`);
			await build();
		}, 80);
	});
	console.log("Watching frontend/ for changes...");
}
