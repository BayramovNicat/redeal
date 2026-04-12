const _template = document.createElement("template");

export const html = <T extends HTMLElement = HTMLElement>(
	strings: TemplateStringsArray,
	...values: unknown[]
): T => {
	const elementsMap = new Map<string, Node>();
	let idCounter = 0;

	// Helper to check and handle live DOM nodes or arrays
	const processValue = (val: unknown): string => {
		// If it's a live DOM node (Element, TextNode, Fragment)
		if (val instanceof Node) {
			const id = `__ref_${idCounter++}__`;
			elementsMap.set(id, val);
			// Use <template> because the browser parser allows it anywhere (even inside tables)
			return `<template data-ref="${id}"></template>`;
		}

		// If it's an array, recursively process each item
		if (Array.isArray(val)) {
			return val.map(processValue).join("");
		}

		// Normal primitive values (strings, numbers)
		return String(val ?? "");
	};

	// 1. Build the raw HTML string with placeholders
	const rawHtml = strings.reduce((result, str, i) => {
		return result + str + (i < values.length ? processValue(values[i]) : "");
	}, "");

	// 2. Parse into DOM
	_template.innerHTML = rawHtml.trim();
	const content = _template.content;

	// 3. Swap placeholders with the real, live nodes
	content.querySelectorAll("template[data-ref]").forEach((placeholder) => {
		const id = placeholder.getAttribute("data-ref");
		if (id) {
			const realNode = elementsMap.get(id);
			if (realNode) {
				// replaceWith physically moves the node, preserving all listeners
				placeholder.replaceWith(realNode);
			}
		}
	});

	const el = content.firstElementChild;
	if (!el)
		throw new Error("html`` utility requires at least one root element.");

	return el as T;
};
