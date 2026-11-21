import {
	cleanPublicDir,
	copyLeafletAssets,
	copyStaticAssets,
} from "./build/assets";
import {
	buildJavaScript,
	buildServiceWorker,
	buildStyles,
} from "./build/bundles";
import { dirs, watchMode } from "./build/config";
import { writeIndexHtml } from "./build/html";
import { notifyReloadClients, startReloadServer } from "./build/reload";
import { watchFrontend } from "./build/watch";

const reloadPort = watchMode ? startReloadServer() : 0;

async function build() {
	copyLeafletAssets();

	const jsResult = await buildJavaScript(reloadPort);
	logJavaScriptOutputs(jsResult);

	await buildStyles();
	await buildServiceWorker();
	await writeIndexHtml();
	await copyStaticAssets();
	await logBuildSummary();

	notifyReloadClients();
}

function logJavaScriptOutputs(result: Bun.BuildOutput) {
	if (watchMode) return;

	for (const output of result.outputs) {
		if (output.path.endsWith(".js")) {
			const size = (output.size / 1024).toFixed(2);
			console.log(`  → ${output.path.split("/").pop()} (${size} KB)`);
		}
	}
}

async function logBuildSummary() {
	if (watchMode) return;

	const jsSizeKB = (Bun.file(`${dirs.public}/main.js`).size / 1024).toFixed(1);
	const cssSizeKB = (Bun.file(`${dirs.public}/styles.css`).size / 1024).toFixed(
		1,
	);
	const swSizeKB = (Bun.file(`${dirs.public}/sw.js`).size / 1024).toFixed(1);
	console.log(
		`Built public/  main.js ${jsSizeKB} KB  styles.css ${cssSizeKB} KB  sw.js ${swSizeKB} KB  index.html ✓  manifest.json ✓`,
	);
}

cleanPublicDir();
await build();

if (watchMode) {
	console.log(`Live reload WS listening on ws://localhost:${reloadPort}`);
	watchFrontend(build);
}
