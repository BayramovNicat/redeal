export const EVENTS = {
	DEALS_UPDATED: "deals_updated",
	SEARCH_STARTED: "search_started",
	LOCATION_CHANGED: "location_changed",
} as const;

export type EventPayloads = {
	[EVENTS.DEALS_UPDATED]: undefined;
	[EVENTS.SEARCH_STARTED]: { more: boolean };
	[EVENTS.LOCATION_CHANGED]: string;
};

type Callback<T> = (data: T) => void;

class EventBus {
	private listeners: {
		[K in keyof EventPayloads]?: Callback<EventPayloads[K]>[];
	} = {};

	on<K extends keyof EventPayloads>(
		event: K,
		cb: Callback<EventPayloads[K]>,
	): () => void {
		if (!this.listeners[event]) {
			(this.listeners as Record<string, unknown>)[event] = [];
		}
		(this.listeners[event] as Callback<EventPayloads[K]>[]).push(cb);
		return () => this.off(event, cb);
	}

	off<K extends keyof EventPayloads>(event: K, cb: Callback<EventPayloads[K]>) {
		const list = this.listeners[event];
		if (!list) return;
		(this.listeners as Record<string, unknown>)[event] = list.filter(
			(l) => l !== cb,
		);
	}

	emit<K extends keyof EventPayloads>(
		event: K,
		...args: EventPayloads[K] extends undefined ? [] : [EventPayloads[K]]
	) {
		const list = this.listeners[event];
		if (!list) return;
		const data = args[0] as EventPayloads[K];
		for (const cb of list) {
			(cb as (arg: EventPayloads[K]) => void)(data);
		}
	}
}

export const bus = new EventBus();
