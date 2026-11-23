import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { dirs, watchMode } from "./config";

function assertBuildSuccess(result: Bun.BuildOutput, label: string) {
	if (result.success) return;
	for (const log of result.logs) console.error(log);
	throw new Error(`${label} build failed`);
}

export async function buildJavaScript(reloadPort = 0) {
	const result = await Bun.build({
		entrypoints: [`${dirs.frontend}/main.ts`],
		outdir: dirs.public,
		splitting: true,
		format: "esm",
		minify: true,
		target: "browser",
		define: {
			__DEV__: watchMode ? "true" : "false",
			__DEV_RELOAD_PORT__: String(reloadPort),
		},
	});
	assertBuildSuccess(result, "JS");
	return result;
}

export async function buildStyles() {
	const stylesEntry = `${dirs.frontend}/styles.css`;
	const stylesTemp = `${dirs.public}/.styles-tmp.css`;
	const cssSource = await Bun.file(stylesEntry).text();
	const postcssResult = await postcss([tailwindcss]).process(cssSource, {
		from: stylesEntry,
	});

	await Bun.write(stylesTemp, postcssResult.css);
	try {
		const result = await Bun.build({
			entrypoints: [stylesTemp],
			outdir: dirs.public,
			naming: "styles.css",
			minify: true,
		});
		assertBuildSuccess(result, "CSS");
	} finally {
		await Bun.file(stylesTemp)
			.delete?.()
			.catch(() => {});
	}
}

export async function buildServiceWorker() {
	const result = await Bun.build({
		entrypoints: [`${dirs.frontend}/sw.ts`],
		outdir: dirs.public,
		naming: "sw.js",
		minify: true,
		target: "browser",
	});
	assertBuildSuccess(result, "Service Worker");
}
