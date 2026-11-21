import { html } from "@/core/utils";

export function SkeletonList(count: number, view: "grid" | "row"): HTMLElement {
	const wrap = document.createElement("div");
	wrap.className =
		view === "grid"
			? "grid grid-cols-[repeat(auto-fill,minmax(275px,1fr))] gap-4 max-[520px]:grid-cols-2 max-[520px]:gap-2.5"
			: "flex flex-col gap-2.5";
	const card = view === "grid" ? gridCard : rowCard;
	for (let i = 0; i < count; i++) wrap.appendChild(card());
	return wrap;
}

function gridCard(): HTMLElement {
	return html`
		<article
			class="re-skeleton bg-(--surface) border border-(--border) rounded-(--r-lg) overflow-hidden flex flex-col"
		>
			<div class="h-48 max-[520px]:h-32 shimmer"></div>
			<div class="px-4 pt-3 pb-3.5 max-[520px]:px-2.75 max-[520px]:pt-2 max-[520px]:pb-2.75 flex flex-col gap-3 max-[520px]:gap-2">
				<div class="flex flex-col gap-1.5">
					<div class="flex justify-between items-center gap-2">
						<div class="h-6 w-28 max-[520px]:h-5 max-[520px]:w-20 rounded shimmer"></div>
						<div class="h-4.5 w-20 max-[520px]:w-14 rounded-full shimmer"></div>
					</div>
					<div class="h-3.5 w-40 rounded shimmer max-[520px]:hidden"></div>
				</div>
				<div class="grid grid-cols-3 gap-3 py-2 border-y border-(--border-subtle) max-[520px]:hidden">
					<div class="space-y-1.5">
						<div class="h-2.5 w-10 rounded shimmer"></div>
						<div class="h-4 w-12 rounded shimmer"></div>
					</div>
					<div class="space-y-1.5">
						<div class="h-2.5 w-10 rounded shimmer"></div>
						<div class="h-4 w-8 rounded shimmer"></div>
					</div>
					<div class="space-y-1.5">
						<div class="h-2.5 w-10 rounded shimmer"></div>
						<div class="h-4 w-10 rounded shimmer"></div>
					</div>
				</div>
				<div class="flex justify-between items-center">
					<div class="h-3.5 w-28 rounded shimmer"></div>
					<div class="h-3 w-10 rounded shimmer max-[520px]:hidden"></div>
				</div>
				<div class="flex gap-1.5 max-[520px]:hidden">
					<div class="h-5 w-16 rounded-md shimmer"></div>
					<div class="h-5 w-16 rounded-md shimmer"></div>
				</div>
			</div>
		</article>
	`;
}

function rowCard(): HTMLElement {
	return html`
		<div
			class="re-skeleton bg-(--surface) border border-(--border) rounded-(--r) px-3.5 py-2.75 grid items-center grid-cols-[92px_minmax(200px,1.5fr)_148px_76px_auto] lg:grid-cols-[92px_minmax(220px,1.4fr)_228px_156px_80px_auto] gap-4"
		>
			<div class="w-23 h-16.5 rounded-(--r-sm) shimmer"></div>
			<div class="flex flex-col gap-2">
				<div class="h-4.5 w-48 rounded shimmer"></div>
				<div class="flex gap-1.5">
					<div class="h-5 w-16 rounded-md shimmer"></div>
					<div class="h-5 w-16 rounded-md shimmer"></div>
				</div>
			</div>
			<div class="hidden lg:grid grid-cols-3 gap-3">
				<div class="space-y-1.5">
					<div class="h-2.5 w-8 rounded shimmer"></div>
					<div class="h-4 w-12 rounded shimmer"></div>
				</div>
				<div class="space-y-1.5">
					<div class="h-2.5 w-8 rounded shimmer"></div>
					<div class="h-4 w-8 rounded shimmer"></div>
				</div>
				<div class="space-y-1.5">
					<div class="h-2.5 w-8 rounded shimmer"></div>
					<div class="h-4 w-10 rounded shimmer"></div>
				</div>
			</div>
			<div class="flex flex-col items-end gap-1.5">
				<div class="h-4 w-24 rounded shimmer"></div>
				<div class="h-3 w-28 rounded shimmer"></div>
			</div>
			<div class="flex flex-col items-end gap-1">
				<div class="h-5 w-14 rounded-full shimmer"></div>
				<div class="h-2.5 w-12 rounded shimmer"></div>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="size-7.5 rounded-(--r-sm) shimmer"></div>
				<div class="size-7.5 rounded-(--r-sm) shimmer"></div>
				<div class="h-7.5 w-16 rounded-(--r-sm) shimmer ml-1"></div>
			</div>
		</div>
	`;
}
