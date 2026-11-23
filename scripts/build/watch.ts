import { watch } from "node:fs";
import { dirs, skippedWatchExtensions } from "./config";

export function watchFrontend(build: () => Promise<void>) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let building = false;
	let pending = false;

	const runBuild = async () => {
		if (building) {
			pending = true;
			return;
		}
		building = true;
		try {
			await build();
		} catch (err) {
			console.error("[watch] Build failed:", err);
		} finally {
			building = false;
			if (pending) {
				pending = false;
				void runBuild();
			}
		}
	};

	watch(dirs.frontend, { recursive: true }, (_event, filename) => {
		if (!filename) return;
		const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
		if (skippedWatchExtensions.has(ext)) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			process.stdout.write(`[watch] ${filename} → rebuilding...\n`);
			void runBuild();
		}, 80);
	});

	console.log("Watching frontend/ for changes...");
}
