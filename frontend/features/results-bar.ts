import { frag, html } from "../core/utils";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";
import { Select } from "../ui/select";

export function renderResultsBar(container: HTMLElement): void {
	const bar = html`<div
    class="flex items-center justify-between mb-4 gap-2.5 flex-wrap"
    id="results-bar"
    style="display: none"
  >
    <div
      class="text-sm text-(--text-2) [&_strong]:text-(--text) [&_strong]:font-semibold"
      id="results-meta"
    ></div>
    <div class="flex items-center gap-1.75">
      ${Button({
				id: "alert-btn",
				title: "Get Telegram alerts for new matches",
				content: frag`${Icons.bell()} Alert me`,
			})}
      ${Button({
				id: "saved-btn",
				className: "hidden",
				content: frag`${Icons.bookmark(false)} Saved
          <span id="saved-badge"></span>`,
			})}
      ${Select({
				id: "sort-sel",
				variant: "xs",
				options: [
					{ value: "disc", label: "Most discounted" },
					{ value: "price-asc", label: "Price: low → high" },
					{ value: "price-desc", label: "Price: high → low" },
					{ value: "area", label: "Largest first" },
					{ value: "ppsm", label: "Cheapest ₼/m²" },
				],
			})}
      ${Button({
				id: "vgrid",
				variant: "square",
				color: "indigo",
				active: true,
				title: "Grid view",
				content: Icons.grid(),
			})}
      ${Button({
				id: "vlist",
				variant: "square",
				color: "indigo",
				title: "List view",
				content: Icons.list(),
			})}
    </div>
  </div>`;

	container.appendChild(bar);
}
