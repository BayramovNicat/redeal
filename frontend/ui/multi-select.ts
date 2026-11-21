import { ce, cn, frag, html } from "@/core/utils";
import { RawButton } from "./button";
import { Icons } from "./icons";
import { RawInput } from "./input";

export interface MultiSelectOption {
	value: string;
	label: string;
}

export interface MultiSelectElement extends HTMLElement {
	getValue: () => string[];
	setValue: (vals: string[]) => void;
	setOptions: (options: MultiSelectOption[]) => void;
	focus: (options?: FocusOptions) => void;
}

export type MultiSelectProps = {
	options: MultiSelectOption[];
	placeholder?: string;
	exclusiveValue?: string;
	variant?: "default" | "embedded";
	onChange?: (values: string[]) => void;
} & Partial<HTMLElement>;

/**
 * A stylized multi-select component with search and standardized branding.
 */
export function MultiSelect({
	options: initialOptions,
	placeholder = "Select options...",
	className = "",
	exclusiveValue,
	variant = "default",
	onChange,
	...props
}: MultiSelectProps): MultiSelectElement {
	let options = initialOptions;
	let selectedValues: string[] = [];
	let isOpen = false;
	let searchQuery = "";

	const label = html`<span class="truncate text-(--text-2)"
		>${placeholder}</span
	>`;
	const chevron = Icons.chevron(
		13,
		"text-(--muted) transition-transform duration-200 shrink-0",
	);
	const optionsList = html`<div
		class="max-h-60 overflow-y-auto p-1.5 space-y-0.5"
	></div>`;
	const countBadge = html`<span
		class="px-2 py-0.5 text-[10px] font-semibold font-mono-num bg-(--accent-dim) text-(--accent) border border-(--accent-b) rounded-full"
		>0 selected</span
	>`;

	const search = RawInput({
		name: "location-search",
		type: "text",
		placeholder: "Search...",
		ariaLabel: "Search locations",
		className:
			"w-full pl-8 pr-3 py-1.75 bg-(--surface-2) border border-(--border) rounded-(--r-sm) text-xs text-(--text) placeholder:text-(--muted) focus:outline-none focus:border-(--accent) focus:shadow-[0_0_0_2px_var(--accent-dim)] transition-all",
		oninput: (e) => {
			searchQuery = (e.target as HTMLInputElement).value;
			updateUI();
		},
	});

	const { id, ...rest } = props;

	const trigger = RawButton({
		id,
		role: "combobox",
		ariaExpanded: "false",
		ariaHasPopup: "listbox",
		className:
			variant === "embedded"
				? "w-full h-7 flex items-center justify-between gap-2 bg-transparent border-none text-[13.5px] text-(--text) text-left transition-colors duration-150 focus:outline-none p-0"
				: "w-full h-10 flex items-center justify-between gap-2.5 px-3.5 bg-(--surface-2)/90 border border-(--border) rounded-(--r) text-[13px] text-(--text) text-left transition-all duration-150 hover:border-(--border-h) hover:bg-(--surface-2) focus:outline-none focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-dim)]",
		content: html`
			<span class="flex items-center gap-2 min-w-0 flex-1">
				<span class="text-(--muted) shrink-0">${Icons.map(14)}</span>
				${label}
			</span>
			${chevron}
		`,
		onclick: (e) => {
			e.stopPropagation();
			setOpen(!isOpen);
		},
	});

	const clearBtn = RawButton({
		className:
			"px-2 py-1 text-[11px] font-medium text-(--muted) hover:text-(--text) transition-colors rounded-(--r-xs) hover:bg-(--surface-3)",
		content: "Clear all",
		onclick: (e) => {
			e.stopPropagation();
			selectedValues = [];
			updateUI();
			onChange?.(selectedValues);
		},
	});

	const dropdown = html`
		<div
			role="listbox"
			class="absolute top-full left-0 ${
				variant === "embedded" ? "min-w-64 right-0 mt-3.5" : "right-0 mt-2"
			} glass-panel bg-(--surface-glass-strong) border border-(--border-h) rounded-(--r) shadow-[var(--shadow-float)] z-50 overflow-hidden hidden animate-[fadeUp_0.16s_ease-out] pointer-events-auto"
		>
			<div class="p-2 border-b border-(--border)">
				<div class="relative">
					<span
						class="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--muted) pointer-events-none"
					>
						${Icons.search(13)}
					</span>
					${search}
				</div>
			</div>
			${optionsList}
			<div
				class="px-2.5 py-2 border-t border-(--border) bg-(--surface)/80 flex items-center justify-between"
			>
				${clearBtn} ${countBadge}
			</div>
		</div>
	`;

	const el = ce<MultiSelectElement>(
		html`
			<div class="${cn("relative", className)}">${trigger} ${dropdown}</div>
		`,
		rest,
	);

	function updateUI() {
		const filtered = options.filter((o) =>
			o.label.toLowerCase().includes(searchQuery.toLowerCase()),
		);

		optionsList.replaceChildren();
		if (filtered.length === 0) {
			optionsList.replaceChildren(
				frag`<div class="p-5 text-center text-xs text-(--muted)">No results found</div>`,
			);
		} else {
			for (const opt of filtered) {
				const isSelected = selectedValues.includes(opt.value);
				const item = html`
					<div
						role="option"
						aria-selected="${isSelected}"
						class="flex items-center justify-between gap-2 px-2.75 py-2 rounded-(--r-sm) cursor-pointer transition-colors ${
							isSelected
								? "bg-(--accent-dim) text-(--accent) font-semibold"
								: "text-(--text-2) hover:bg-(--surface-3)/70 hover:text-(--text)"
						}"
						data-value="${opt.value}"
					>
						<span class="text-xs truncate">${opt.label}</span>
						${isSelected ? Icons.check(13) : ""}
					</div>
				`;
				item.onclick = (e) => {
					e.stopPropagation();
					toggleValue(opt.value);
				};
				optionsList.appendChild(item);
			}
		}

		if (selectedValues.length === 0) {
			label.textContent = placeholder;
			label.className = "truncate text-(--text-2)";
			countBadge.style.display = "none";
		} else {
			const selectedLabels = options
				.filter((o) => selectedValues.includes(o.value))
				.map((o) => o.label);

			if (selectedLabels.length <= 2) {
				label.textContent = selectedLabels.join(", ");
			} else {
				label.textContent = `${selectedLabels[0]}, ${selectedLabels[1]} +${selectedLabels.length - 2}`;
			}
			label.className = "truncate text-(--text) font-medium";
			countBadge.textContent = `${selectedValues.length} selected`;
			countBadge.style.display = "inline-block";
		}

		clearBtn.style.visibility =
			selectedValues.length > 0 ? "visible" : "hidden";
	}

	function toggleValue(val: string) {
		if (selectedValues.includes(val)) {
			selectedValues = selectedValues.filter((v) => v !== val);
		} else if (exclusiveValue !== undefined && val === exclusiveValue) {
			selectedValues = [exclusiveValue];
		} else {
			selectedValues = selectedValues.filter((v) => v !== exclusiveValue);
			selectedValues.push(val);
		}
		updateUI();
		onChange?.(selectedValues);
	}

	function setOpen(open: boolean) {
		isOpen = open;
		if (isOpen) {
			dropdown.classList.remove("hidden");
			chevron.style.transform = "rotate(180deg)";
			trigger.setAttribute("aria-expanded", "true");
			search.focus({ preventScroll: true });
		} else {
			dropdown.classList.add("hidden");
			chevron.style.transform = "";
			trigger.setAttribute("aria-expanded", "false");
			searchQuery = "";
			search.value = "";
			updateUI();
		}
	}

	const handleOutside = (e: MouseEvent) => {
		if (!document.body.contains(el)) {
			document.removeEventListener("click", handleOutside);
			return;
		}
		if (!el.contains(e.target as Node)) {
			setOpen(false);
		}
	};
	document.addEventListener("click", handleOutside);

	const multiEl = el as MultiSelectElement;
	multiEl.getValue = () => selectedValues;
	multiEl.setValue = (vals: string[]) => {
		selectedValues = vals;
		updateUI();
	};
	multiEl.setOptions = (newOptions: MultiSelectOption[]) => {
		options = newOptions;
		updateUI();
	};
	multiEl.focus = (options?: FocusOptions) => trigger.focus(options);

	updateUI();
	return multiEl;
}
