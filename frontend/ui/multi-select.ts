import { html } from "../core/utils";
import { Icons } from "./icons";

export interface MultiSelectOption {
	value: string;
	label: string;
}

export interface MultiSelectElement extends HTMLElement {
	getValue: () => string[];
	setValue: (vals: string[]) => void;
	setOptions: (options: MultiSelectOption[]) => void;
}

interface MultiSelectProps {
	id: string;
	options: MultiSelectOption[];
	placeholder?: string;
	className?: string;
	onChange?: (values: string[]) => void;
}

export function MultiSelect({
	id,
	options,
	placeholder = "Select options...",
	className = "",
	onChange,
}: MultiSelectProps): HTMLElement {
	let selectedValues: string[] = [];
	let isOpen = false;
	let searchQuery = "";

	const el = html<HTMLElement>`
    <div id="${id}" class="relative ${className}">
      <button
        type="button"
        id="${id}-trigger"
        class="w-full flex items-center justify-between gap-2 px-3 py-2 bg-(--surface-2) border border-(--border) rounded-(--r-sm) text-sm text-(--text) text-left transition-all hover:border-(--border-h) focus:outline-none focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-dim)]"
      >
        <span id="${id}-label" class="truncate text-(--text-2)"
          >${placeholder}</span
        >
        ${Icons.chevron(12, "transition-transform duration-200")}
      </button>

      <div
        id="${id}-dropdown"
        class="absolute top-full left-0 right-0 mt-1.5 bg-(--surface) border border-(--border) rounded-(--r-sm) shadow-[0_8px_24px_rgba(0,0,0,0.3)] z-50 overflow-hidden hidden animate-[fadeUp_0.2s_ease]"
      >
        <div class="p-2 border-b border-(--border)">
          <div class="relative">
            <span
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--muted)"
            >
              ${Icons.search(12)}
            </span>
            <input
              type="text"
              id="${id}-search"
              placeholder="Search..."
              class="w-full pl-8 pr-3 py-1.5 bg-(--surface-2) border border-(--border) rounded-(--r-xs) text-xs text-(--text) focus:outline-none focus:border-(--accent)"
            />
          </div>
        </div>
        <div
          id="${id}-options"
          class="max-h-55 overflow-y-auto p-1 custom-scrollbar"
        >
          <!-- options injected here -->
        </div>
        <div
          class="p-1.5 border-t border-(--border) bg-(--surface-2) flex items-center justify-between"
        >
          <button
            type="button"
            id="${id}-clear"
            class="px-2 py-1 text-[11px] font-medium text-(--muted) hover:text-(--text) transition-colors"
          >
            Clear all
          </button>
          <span
            id="${id}-count"
            class="px-2 py-0.5 text-[10px] font-bold bg-(--accent-dim) text-(--accent) rounded-full"
          >
            0 selected
          </span>
        </div>
      </div>
    </div>
  `;

	const trigger = el.querySelector(`#${id}-trigger`) as HTMLButtonElement;
	const label = el.querySelector(`#${id}-label`) as HTMLElement;
	const dropdown = el.querySelector(`#${id}-dropdown`) as HTMLElement;
	const search = el.querySelector(`#${id}-search`) as HTMLInputElement;
	const optionsList = el.querySelector(`#${id}-options`) as HTMLElement;
	const clearBtn = el.querySelector(`#${id}-clear`) as HTMLButtonElement;
	const countBadge = el.querySelector(`#${id}-count`) as HTMLElement;
	const chevron = trigger.querySelector("svg") as SVGElement;

	function updateUI() {
		// Update options list
		const filtered = options.filter((o) =>
			o.label.toLowerCase().includes(searchQuery.toLowerCase()),
		);

		optionsList.innerHTML = "";
		if (filtered.length === 0) {
			optionsList.innerHTML = `<div class="p-4 text-center text-xs text-(--muted)">No results found</div>`;
		} else {
			for (const opt of filtered) {
				const isSelected = selectedValues.includes(opt.value);
				const item = html`
          <div
            class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-(--r-xs) cursor-pointer transition-colors ${
							isSelected
								? "bg-(--accent-dim) text-(--accent)"
								: "hover:bg-(--surface-2)"
						}"
            data-value="${opt.value}"
          >
            <span class="text-xs font-medium truncate">${opt.label}</span>
            ${isSelected ? Icons.check(12) : ""}
          </div>
        `;
				item.onclick = (e) => {
					e.stopPropagation();
					toggleValue(opt.value);
				};
				optionsList.appendChild(item);
			}
		}

		// Update trigger label
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

		// Update clear button
		clearBtn.style.visibility =
			selectedValues.length > 0 ? "visible" : "hidden";
	}

	function toggleValue(val: string) {
		if (selectedValues.includes(val)) {
			selectedValues = selectedValues.filter((v) => v !== val);
		} else {
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
			search.focus();
		} else {
			dropdown.classList.add("hidden");
			chevron.style.transform = "";
			searchQuery = "";
			search.value = "";
			updateUI();
		}
	}

	trigger.onclick = (e) => {
		e.stopPropagation();
		setOpen(!isOpen);
	};

	search.oninput = (e) => {
		searchQuery = (e.target as HTMLInputElement).value;
		updateUI();
	};

	clearBtn.onclick = (e) => {
		e.stopPropagation();
		selectedValues = [];
		updateUI();
		onChange?.(selectedValues);
	};

	// Close on click outside
	const handleOutside = (e: MouseEvent) => {
		if (!el.contains(e.target as Node)) {
			setOpen(false);
		}
	};
	document.addEventListener("click", handleOutside);

	// Expose methods via property on element
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

	updateUI();
	return multiEl;
}
