const DEFAULT_RELOAD_PORT = 35729;
const MAX_RELOAD_PORT_ATTEMPTS = 20;

const reloadClients = new Set<{
	send(data: string): void;
	readyState: number;
}>();

function createReloadServer(port: number) {
	return Bun.serve({
		port,
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

export function startReloadServer(): number {
	const initialPort = Number(process.env.RELOAD_PORT ?? DEFAULT_RELOAD_PORT);

	for (let offset = 0; offset < MAX_RELOAD_PORT_ATTEMPTS; offset++) {
		const port = initialPort + offset;
		try {
			const server = createReloadServer(port);
			return server.port ?? port;
		} catch (error) {
			const code = (error as { code?: string })?.code;
			if (code !== "EADDRINUSE") throw error;
		}
	}

	const server = createReloadServer(0);
	return server.port ?? 0;
}

export function notifyReloadClients() {
	for (const client of reloadClients) {
		try {
			client.send("reload");
		} catch {}
	}
}
