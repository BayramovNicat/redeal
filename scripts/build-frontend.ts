import { cpSync, mkdirSync, watch } from "node:fs";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

const watchMode = process.argv.includes("--watch");

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

	// Copy HTML
	await Bun.write("./public/index.html", Bun.file("./frontend/index.html"));

	const jsSizeKB = (Bun.file("./public/app.js").size / 1024).toFixed(1);
	const cssSizeKB = (Bun.file("./public/styles.css").size / 1024).toFixed(1);
	console.log(
		`Built public/  app.js ${jsSizeKB} KB  styles.css ${cssSizeKB} KB  index.html ✓`,
	);
}

await build();

if (watchMode) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	watch("./frontend", { recursive: true }, (_event, filename) => {
		if (!filename) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			process.stdout.write(`[watch] ${filename} → rebuilding...\n`);
			await build();
		}, 80);
	});
	console.log("Watching frontend/ for changes...");
}
