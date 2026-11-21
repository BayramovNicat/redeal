import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirs } from "./config";

export function cleanPublicDir() {
	rmSync(dirs.public, { recursive: true, force: true });
	mkdirSync(dirs.public, { recursive: true });
}

export function copyLeafletAssets() {
	cpSync(`${dirs.leaflet}/images`, `${dirs.public}/images`, {
		recursive: true,
	});
	cpSync(`${dirs.leaflet}/leaflet.css`, `${dirs.public}/leaflet.css`);
}

export async function copyStaticAssets() {
	await Bun.write(
		`${dirs.public}/robots.txt`,
		Bun.file(`${dirs.frontend}/robots.txt`),
	);
	await Bun.write(
		`${dirs.public}/favicon.svg`,
		Bun.file(`${dirs.frontend}/favicon.svg`),
	);
	await Bun.write(
		`${dirs.public}/favicon.png`,
		Bun.file(`${dirs.frontend}/favicon.png`),
	);
	await Bun.write(
		`${dirs.public}/manifest.json`,
		Bun.file(`${dirs.frontend}/manifest.json`),
	);
	await Bun.write(
		`${dirs.public}/og-image.png`,
		Bun.file(`${dirs.frontend}/og-image.png`),
	);

	cpSync(`${dirs.frontend}/icons`, `${dirs.public}/icons`, { recursive: true });
	cpSync(`${dirs.frontend}/screenshots`, `${dirs.public}/screenshots`, {
		recursive: true,
	});
}
