import { html } from "@/core/utils";

export function SkeletonList(count: number, view: "grid" | "row"): HTMLElement {
	const wrap = document.createElement("div");
	wrap.className =
		view === "grid"
			? "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 max-[480px]:grid-cols-2 max-[480px]:gap-2"
			: "flex flex-col gap-2";
	const card = view === "grid" ? gridCard : rowCard;
	for (let i = 0; i < count; i++) wrap.appendChild(card());
	return wrap;
}

function gridCard(): HTMLElement {
	return html`
		<article
			class="re-skeleton bg-(--surface) border border-(--border) rounded-(--r-lg) p-4 max-[480px]:p-2.5 flex flex-col gap-3.5 max-[480px]:gap-2"
		>
			<div class="rounded-t-[calc(var(--r-lg)-1px)] -mx-4 -mt-4 mb-0.5 h-40 max-[480px]:-mx-2.5 max-[480px]:-mt-2.5 max-[480px]:h-28 shimmer"></div>
			<div class="flex justify-between items-start gap-2 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-1">
				<div class="flex flex-col gap-1.5 max-[480px]:gap-1">
					<div class="h-2.5 w-20 rounded shimmer"></div>
					<div class="h-6 w-28 max-[480px]:h-5 max-[480px]:w-20 rounded shimmer"></div>
				</div>
				<div class="h-5 w-16 max-[480px]:h-4.5 max-[480px]:w-14 rounded-full shimmer max-[480px]:mt-1"></div>
			</div>
			<div class="max-[480px]:hidden">
				<div class="flex justify-between mb-1.75">
					<div class="h-2.5 w-32 rounded shimmer"></div>
					<div class="h-4 w-10 rounded shimmer"></div>
				</div>
				<div class="h-2 shimmer rounded-full"></div>
			</div>
			<div class="hidden max-[480px]:block">
				<div class="h-3 w-28 rounded shimmer"></div>
			</div>
			<div class="grid grid-cols-4 gap-1.5 max-[480px]:hidden">
				<div class="h-12 rounded-(--r-sm) shimmer"></div>
				<div class="h-12 rounded-(--r-sm) shimmer"></div>
				<div class="h-12 rounded-(--r-sm) shimmer"></div>
				<div class="h-12 rounded-(--r-sm) shimmer"></div>
			</div>
		</article>
	`;
}

function rowCard(): HTMLElement {
	return html`
		<div
			class="re-skeleton bg-(--surface) border border-(--border) rounded-(--r) px-4 py-3 flex items-center gap-3.5"
		>
			<div class="h-10 w-10 rounded-(--r-sm) shimmer shrink-0"></div>
			<div class="w-16 shrink-0 flex flex-col gap-1.5">
				<div class="h-4 w-10 rounded shimmer"></div>
				<div class="h-2.5 w-12 rounded shimmer"></div>
			</div>
			<div class="flex-1 flex flex-col gap-1.5">
				<div class="h-3.5 w-40 rounded shimmer"></div>
				<div class="h-2.5 w-56 rounded shimmer"></div>
			</div>
			<div class="flex gap-1 shrink-0">
				<div class="h-8 w-8 rounded-(--r-sm) shimmer"></div>
				<div class="h-8 w-8 rounded-(--r-sm) shimmer"></div>
			</div>
			<div class="h-3 w-14 rounded shimmer shrink-0"></div>
		</div>
	`;
}
