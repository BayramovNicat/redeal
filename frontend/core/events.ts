export const EVENTS = {
	DEALS_UPDATED: "deals_updated",
	SEARCH_STARTED: "search_started",
	LOCATION_CHANGED: "location_changed",
	GALLERY_OPEN: "gallery_open",
	PROPERTY_OPEN: "property_open",
	ALERTS_OPEN: "alerts_open",
	HEATMAP_OPEN: "heatmap_open",
	ACCESS_REQUESTS_CHANGED: "access_requests_changed",
} as const;

export type EventPayloads = {
	[EVENTS.DEALS_UPDATED]: undefined;
	[EVENTS.SEARCH_STARTED]: { more: boolean };
	[EVENTS.LOCATION_CHANGED]: string;
	[EVENTS.GALLERY_OPEN]: { urls: string[]; index?: number };
	[EVENTS.PROPERTY_OPEN]: import("./types").Property;
	[EVENTS.ALERTS_OPEN]: undefined;
	[EVENTS.HEATMAP_OPEN]: {
		activeLocations: string[];
		onAction: (name: string, isToggle: boolean) => void;
		onSelectMany?: (names: string[]) => void;
	};
	[EVENTS.ACCESS_REQUESTS_CHANGED]: number;
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

	once<K extends keyof EventPayloads>(
		event: K,
		cb: Callback<EventPayloads[K]>,
	): () => void {
		const wrapper = (data: EventPayloads[K]) => {
			this.off(event, wrapper);
			cb(data);
		};
		return this.on(event, wrapper);
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
