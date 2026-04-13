type Callback = (data?: unknown) => void;

class EventBus {
	private listeners: Record<string, Callback[]> = {};

	on(event: string, cb: Callback) {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(cb);
		return () => this.off(event, cb);
	}

	off(event: string, cb: Callback) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
	}

	emit(event: string, data?: unknown) {
		if (!this.listeners[event]) return;
		for (const cb of this.listeners[event]) {
			cb(data);
		}
	}
}

export const bus = new EventBus();

export const EVENTS = {
	DEALS_UPDATED: "deals_updated",
	SEARCH_STARTED: "search_started",
	LOCATION_CHANGED: "location_changed",
};
