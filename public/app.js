// ── State ──────────────────────────────────────────────────────────────────
let allResults = [];
let currentTotal = 0;
let currentOffset = 0;
let currentView = "grid";
let showingSaved = false;
const renderedSet = new Set();
const bookmarks = new Set(JSON.parse(localStorage.getItem("re-bm") || "[]"));
const PAGE = 50;

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n, d = 0) {
	return Number(n).toLocaleString("az-AZ", { maximumFractionDigits: d });
}

function timeAgo(s) {
	if (!s) return null;
	const sec = Math.floor((Date.now() - new Date(s)) / 1000);
	if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
	if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
	if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
	return new Date(s).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
	});
}

function saveBM() {
	localStorage.setItem("re-bm", JSON.stringify([...bookmarks]));
}

function toast(msg, err = false) {
	const el = document.createElement("div");
	el.className = `toast${err ? " err" : ""}`;
	el.textContent = msg;
	document.getElementById("toasts").appendChild(el);
	setTimeout(() => el.remove(), 3800);
}

function show(id, d) {
	const e = ge(id);
	if (e) e.style.display = d ?? "";
}
function hide(id) {
	const e = ge(id);
	if (e) e.style.display = "none";
}
function ge(id) {
	return document.getElementById(id);
}

// ── Tier ──────────────────────────────────────────────────────────────────
function ts(tier) {
	if (tier === "High Value Deal")
		return {
			c: "var(--green)",
			bg: "var(--green-dim)",
			b: "var(--green-b)",
			hex: "#22c55e",
		};
	if (tier === "Good Deal")
		return {
			c: "var(--blue)",
			bg: "var(--blue-dim)",
			b: "var(--blue-b)",
			hex: "#3b82f6",
		};
	if (tier === "Fair Price")
		return {
			c: "var(--yellow)",
			bg: "var(--yellow-dim)",
			b: "var(--yellow-b)",
			hex: "#f59e0b",
		};
	return {
		c: "var(--red)",
		bg: "var(--red-dim)",
		b: "var(--red-b)",
		hex: "#ef4444",
	};
}

// ── Build card (grid) ─────────────────────────────────────────────────────
function buildCard(p) {
	const t = ts(p.tier);
	const bm = bookmarks.has(p.source_url);
	const barW = Math.min(100, Math.max(2, p.discount_percent * 2.5));
	const tags = [];
	if (p.is_urgent)
		tags.push(
			`<span class="tag" style="color:var(--red);border-color:var(--red-b);background:var(--red-dim)">⚡ Urgent</span>`,
		);
	if (p.has_document)
		tags.push(
			`<span class="tag" style="color:var(--blue);border-color:var(--blue-b);background:var(--blue-dim)">Document</span>`,
		);
	if (p.has_repair)
		tags.push(
			`<span class="tag" style="color:var(--green);border-color:var(--green-b);background:var(--green-dim)">Repaired</span>`,
		);
	if (p.has_mortgage)
		tags.push(
			`<span class="tag" style="color:var(--text-2);border-color:var(--border)">Mortgage</span>`,
		);
	const ago = timeAgo(p.posted_date);
	if (ago)
		tags.push(
			`<span class="tag" style="color:var(--muted);border-color:var(--border)">${ago}</span>`,
		);

	const el = document.createElement("article");
	el.className = "card";
	el.innerHTML = `
                                                                                                                                    <div class="card-top">
                                                                                                                                      <div style="min-width:0">
                                                                                                                                        <div class="card-loc">${p.location_name ?? p.district ?? "—"}</div>
                                                                                                                                        <div class="card-price">₼ ${fmt(p.price)}</div>
                                                                                                                                      </div>
                                                                                                                                      <div class="card-right">
                                                                                                                                        <span class="tier-badge" style="color:${t.c};background:${t.bg};border-color:${t.b}">${p.tier}</span>
                                                                                                                                        <button type="button" class="bmark-btn${bm ? " on" : ""}" title="${bm ? "Remove" : "Save"}" data-url="${p.source_url}">
                                                                                                                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="${bm ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                                                                                                                        </button>
                                                                                                                                      </div>
                                                                                                                                    </div>
                                                                                                                                    <div class="disc-wrap">
                                                                                                                                      <div class="disc-top">
                                                                                                                                        <span class="disc-lbl">Market avg ₼${fmt(p.location_avg_price_per_sqm, 0)}/m²</span>
                                                                                                                                        <span class="disc-val" style="color:${t.c}">-${p.discount_percent}%</span>
                                                                                                                                      </div>
                                                                                                                                      <div class="disc-bar"><div class="disc-fill" style="width:${barW}%;background:${t.hex}"></div></div>
                                                                                                                                    </div>
                                                                                                                                    <div class="card-stats">
                                                                                                                                      <div class="stat-c"><div class="stat-c-lbl">Area</div><div class="stat-c-val">${fmt(p.area_sqm, 1)} m²</div></div>
                                                                                                                                      <div class="stat-c"><div class="stat-c-lbl">₼/m²</div><div class="stat-c-val">${fmt(p.price_per_sqm, 0)}</div></div>
                                                                                                                                      <div class="stat-c"><div class="stat-c-lbl">Rooms</div><div class="stat-c-val">${p.rooms ?? "—"}</div></div>
                                                                                                                                      <div class="stat-c"><div class="stat-c-lbl">Floor</div><div class="stat-c-val">${p.floor != null && p.total_floors != null ? `${p.floor}/${p.total_floors}` : (p.floor ?? "—")}</div></div>
                                                                                                                                    </div>
                                                                                                                                    ${tags.length ? `<div class="card-tags">${tags.join("")}</div>` : ""}
                                                                                                                                    <div class="card-foot">
                                                                                                                                      <a class="card-link" href="${p.source_url}" target="_blank" rel="noopener">
                                                                                                                                        View listing
                                                                                                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                                                                                                                                      </a>
                                                                                                                                      <div class="card-btns">
                                                                                                                                        ${p.description ? `<button type="button" class="icon-btn desc-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Desc</button>` : ""}
                                                                                                                                        ${p.latitude != null ? `<button type="button" class="icon-btn map-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg> Map</button>` : ""}
                                                                                                                                      </div>
                                                                                                                                    </div>`;

	el.querySelector(".bmark-btn").addEventListener("click", () => toggleBM(p));
	if (p.description)
		el.querySelector(".desc-btn").addEventListener("click", () =>
			openDesc(p.description),
		);
	if (p.latitude != null)
		el.querySelector(".map-btn").addEventListener("click", () =>
			openMap(p.latitude, p.longitude),
		);
	return el;
}

// ── Build row (list) ──────────────────────────────────────────────────────
function buildRow(p) {
	const t = ts(p.tier);
	const bm = bookmarks.has(p.source_url);
	const el = document.createElement("div");
	el.className = "card-row";
	el.innerHTML = `
                                                                                                                                    <div class="row-disc">
                                                                                                                                      <div style="font-size:17px;font-weight:700;color:${t.c}">-${p.discount_percent}%</div>
                                                                                                                                      <div style="font-size:10px;color:var(--muted);margin-top:2px">${p.tier.replace(" Deal", "").replace(" Price", "")}</div>
                                                                                                                                    </div>
                                                                                                                                    <div style="min-width:0">
                                                                                                                                      <div class="row-price">₼ ${fmt(p.price)} <span style="font-weight:400;color:var(--muted);font-size:12px">· ${p.location_name ?? p.district ?? "—"}</span></div>
                                                                                                                                      <div class="row-meta">${fmt(p.area_sqm, 1)} m² · ${p.rooms ?? "—"} rooms · floor ${p.floor != null && p.total_floors != null ? `${p.floor}/${p.total_floors}` : (p.floor ?? "—")} · ₼${fmt(p.price_per_sqm, 0)}/m²${p.is_urgent ? " · ⚡" : ""}</div>
                                                                                                                                    </div>
                                                                                                                                    <div class="row-acts">
                                                                                                                                      <button type="button" class="bmark-btn${bm ? " on" : ""}" data-url="${p.source_url}" title="Save">
                                                                                                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="${bm ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                                                                                                                      </button>
                                                                                                                                      ${p.latitude != null ? `<button type="button" class="icon-btn map-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></button>` : ""}
                                                                                                                                    </div>
                                                                                                                                    <a class="card-link" href="${p.source_url}" target="_blank" rel="noopener" style="white-space:nowrap">View ↗</a>`;

	el.querySelector(".bmark-btn").addEventListener("click", () => toggleBM(p));
	if (p.latitude != null)
		el.querySelector(".map-btn").addEventListener("click", () =>
			openMap(p.latitude, p.longitude, p.location_name ?? p.district ?? ""),
		);
	return el;
}

// ── Sort ──────────────────────────────────────────────────────────────────
function sorted(arr) {
	const by = ge("sort-sel").value;
	return [...arr].sort((a, b) => {
		if (by === "disc") return b.discount_percent - a.discount_percent;
		if (by === "price-asc") return a.price - b.price;
		if (by === "price-desc") return b.price - a.price;
		if (by === "area") return b.area_sqm - a.area_sqm;
		if (by === "ppsm") return a.price_per_sqm - b.price_per_sqm;
		return 0;
	});
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
	const ct = ge("cards");
	ct.innerHTML = "";

	let list = showingSaved
		? allResults.filter((p) => bookmarks.has(p.source_url))
		: allResults;
	list = sorted(list);

	if (!list.length) {
		hide("results-bar");
		show("s-empty");
		return;
	}

	show("results-bar");
	hide("s-empty");

	const wrap = document.createElement("div");
	wrap.className = currentView === "grid" ? "cards-grid" : "cards-list";
	let newCount = 0;
	list.forEach((p) => {
		const el = currentView === "grid" ? buildCard(p) : buildRow(p);
		if (renderedSet.has(p.source_url)) {
			el.style.animation = "none";
		} else {
			el.style.animationDelay = `${Math.min(newCount, 15) * 22}ms`;
			renderedSet.add(p.source_url);
			newCount++;
		}
		wrap.appendChild(el);
	});
	ct.appendChild(wrap);

	// meta
	const showing = list.length;
	ge("results-meta").innerHTML = showingSaved
		? `<strong>${showing}</strong> saved deal${showing !== 1 ? "s" : ""}`
		: `<strong>${showing}</strong> result${showing !== 1 ? "s" : ""}${currentTotal > allResults.length ? ` <span style="color:var(--muted)">· ${fmt(currentTotal)} total</span>` : ""}`;

	// load more
	if (!showingSaved && allResults.length < currentTotal) {
		show("load-more");
		ge("load-info").textContent =
			`Showing ${allResults.length} of ${fmt(currentTotal)}`;
	} else {
		hide("load-more");
	}

	// saved button
	if (bookmarks.size > 0) {
		show("saved-btn", "inline-flex");
		ge("saved-badge").textContent = bookmarks.size;
	} else {
		hide("saved-btn");
	}
}

// ── Bookmark ──────────────────────────────────────────────────────────────
function toggleBM(p) {
	if (bookmarks.has(p.source_url)) {
		bookmarks.delete(p.source_url);
		toast("Removed from saved");
	} else {
		bookmarks.add(p.source_url);
		toast("★ Deal saved");
	}
	saveBM();
	render();
}

// ── Chips ─────────────────────────────────────────────────────────────────
function updateChips() {
	const row = ge("chips-row");
	const chips = [];
	const checks = [
		["hasRepair", "Repaired"],
		["hasDocument", "Has document"],
		["hasMortgage", "Mortgage"],
		["isUrgent", "Urgent only"],
	];
	checks.forEach(([id, lbl]) => {
		if (ge(id).checked)
			chips.push(
				`<span class="chip">${lbl}<button type="button" class="chip-x" onclick="ge('${id}').checked=false;updateChips()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`,
			);
	});
	const nums = [
		["minPrice", "Min ₼"],
		["maxPrice", "Max ₼"],
		["minArea", "Min m²"],
		["maxArea", "Max m²"],
		["minRooms", "Min rooms"],
		["maxRooms", "Max rooms"],
		["minFloor", "Min flr"],
		["maxFloor", "Max flr"],
		["minTotalFloors", "Min bldg flr"],
		["maxTotalFloors", "Max bldg flr"],
	];
	nums.forEach(([id, lbl]) => {
		const v = ge(id).value;
		if (v)
			chips.push(
				`<span class="chip">${lbl}: ${v}<button type="button" class="chip-x" onclick="ge('${id}').value='';updateChips()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`,
			);
	});
	const cat = ge("category").value;
	if (cat)
		chips.push(
			`<span class="chip">Category: ${cat}<button type="button" class="chip-x" onclick="ge('category').value='';updateChips()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`,
		);
	row.innerHTML = chips.join("");
	row.style.display = chips.length ? "flex" : "none";
	const cnt = ge("adv-cnt");
	if (chips.length) {
		cnt.textContent = chips.length;
		cnt.style.display = "inline-block";
	} else cnt.style.display = "none";
}

// ── Search ────────────────────────────────────────────────────────────────
async function doSearch(more = false) {
	const loc = ge("loc").value;
	if (!loc) {
		ge("loc").focus();
		return;
	}
	const thresh = ge("thresh").value;
	if (!more) {
		allResults = [];
		currentOffset = 0;
		currentTotal = 0;
		showingSaved = false;
		renderedSet.clear();
		ge("saved-btn").classList.remove("on");
		hide("s-welcome");
		hide("s-empty");
		hide("results-bar");
		hide("load-more");
		hide("trend-panel");
		ge("cards").innerHTML = "";
		show("s-loading");
	}
	ge("search-btn").disabled = true;
	const lmBtn = ge("load-more-btn");
	if (lmBtn) lmBtn.disabled = true;

	function v(id) {
		return ge(id).value.trim();
	}
	function cb(id) {
		return ge(id).checked;
	}

	try {
		const p = new URLSearchParams({
			location: loc,
			threshold: thresh,
			limit: PAGE,
			offset: currentOffset,
		});
		const set = (k, id) => {
			const val = v(id);
			if (val) p.set(k, val);
		};
		set("minPrice", "minPrice");
		set("maxPrice", "maxPrice");
		set("minArea", "minArea");
		set("maxArea", "maxArea");
		set("minRooms", "minRooms");
		set("maxRooms", "maxRooms");
		set("minFloor", "minFloor");
		set("maxFloor", "maxFloor");
		set("minTotalFloors", "minTotalFloors");
		set("maxTotalFloors", "maxTotalFloors");
		set("category", "category");
		if (cb("hasRepair")) p.set("hasRepair", "true");
		if (cb("hasDocument")) p.set("hasDocument", "true");
		if (cb("hasMortgage")) p.set("hasMortgage", "true");
		if (cb("isUrgent")) p.set("isUrgent", "true");

		const res = await fetch(`/api/deals/undervalued?${p}`);
		const d = await res.json();
		hide("s-loading");

		if (d.error) {
			toast(d.error, true);
			return;
		}

		allResults = [...allResults, ...d.data];
		currentTotal = d.total;
		currentOffset += d.data.length;

		if (!more) updateChips();

		const urlParams = new URLSearchParams(p);
		urlParams.delete("limit");
		urlParams.delete("offset");
		window.history.replaceState(
			null,
			"",
			`${window.location.pathname}?${urlParams.toString()}`,
		);

		if (!more) fetchTrend(loc);

		if (!allResults.length) {
			show("s-empty");
			hide("results-bar");
		} else render();
	} catch (e) {
		hide("s-loading");
		toast(e.message, true);
	} finally {
		ge("search-btn").disabled = false;
		if (lmBtn) lmBtn.disabled = false;
	}
}

// ── Price trend sparkline ─────────────────────────────────────────────────
const _trendCache = {};

async function fetchTrend(location) {
	const hit = _trendCache[location];
	if (hit && Date.now() - hit.at < 30 * 60_000) {
		renderTrend(hit.data, location);
		show("trend-panel");
		return;
	}
	try {
		const r = await fetch(
			`/api/deals/trend?location=${encodeURIComponent(location)}`,
		);
		const d = await r.json();
		if (!d.data || d.data.length < 2) {
			hide("trend-panel");
			return;
		}
		_trendCache[location] = { data: d.data, at: Date.now() };
		renderTrend(d.data, location);
		show("trend-panel");
	} catch {
		hide("trend-panel");
	}
}

function renderTrend(data, location) {
	const vals = data.map((p) => Number(p.avg_ppsm));
	const last = vals[vals.length - 1];
	const first = vals[0];
	const changePct = ((last - first) / first) * 100;
	const up = changePct > 2;
	const dn = changePct < -2;

	ge("trend-loc").textContent = location;
	ge("trend-cur").textContent = `₼ ${fmt(last, 0)}/m²`;

	const chgEl = ge("trend-chg");
	const sign = changePct >= 0 ? "+" : "";
	chgEl.textContent = `${sign}${changePct.toFixed(1)}% vs ${data.length}w ago`;
	chgEl.style.color = up ? "var(--red)" : dn ? "var(--green)" : "var(--muted)";
	chgEl.style.background = up
		? "var(--red-dim)"
		: dn
			? "var(--green-dim)"
			: "var(--surface-3)";
	chgEl.style.borderColor = up
		? "var(--red-b)"
		: dn
			? "var(--green-b)"
			: "var(--border)";

	ge("trend-weeks").textContent =
		`${data.length} week${data.length !== 1 ? "s" : ""} of data`;

	const dfmt = (s) =>
		new Date(s).toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
		});
	ge("trend-dates").innerHTML =
		`<span>${dfmt(data[0].week)}</span><span>${dfmt(data[data.length - 1].week)}</span>`;

	// Build SVG sparkline
	const ct = ge("trend-chart");
	const tip = ge("trend-tip");
	const old = ct.querySelector("svg");
	if (old) old.remove();

	const W = 600,
		H = 68,
		PAD = 6;
	const min = Math.min(...vals);
	const max = Math.max(...vals);
	const range = max - min || 1;
	const xv = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
	const yv = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
	const pts = vals.map((v, i) => [xv(i), yv(v)]);

	// Smooth cubic bezier
	function buildPath(pts) {
		let d = `M ${pts[0][0]},${pts[0][1]}`;
		for (let i = 1; i < pts.length; i++) {
			const mx = (pts[i - 1][0] + pts[i][0]) / 2;
			d += ` C ${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
		}
		return d;
	}

	const color = up ? "#ef4444" : dn ? "#22c55e" : "#6366f1";
	const lineD = buildPath(pts);
	const areaD = `${lineD} L ${pts[pts.length - 1][0]},${H} L ${pts[0][0]},${H} Z`;
	const lp = pts[pts.length - 1];

	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	svg.setAttribute("preserveAspectRatio", "none");
	svg.style.cssText = `width:100%;height:${H}px;display:block;cursor:crosshair`;
	svg.innerHTML = `
                                                                                                                                          <defs>
                                                                                                                                            <linearGradient id="spark-g" x1="0" y1="0" x2="0" y2="1">
                                                                                                                                              <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
                                                                                                                                              <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
                                                                                                                                            </linearGradient>
                                                                                                                                          </defs>
                                                                                                                                          <path d="${areaD}" fill="url(#spark-g)"/>
                                                                                                                                          <path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                                                                                                                          <circle cx="${lp[0]}" cy="${lp[1]}" r="6" fill="${color}" opacity="0.2"/>
                                                                                                                                          <circle cx="${lp[0]}" cy="${lp[1]}" r="3.5" fill="${color}"/>
                                                                                                                                        `;
	ct.insertBefore(svg, tip);

	svg.addEventListener("mousemove", (e) => {
		const svgW = svg.clientWidth;
		const normX = e.offsetX / svgW;
		const idx = Math.max(
			0,
			Math.min(data.length - 1, Math.round(normX * (data.length - 1))),
		);
		const p = data[idx];
		tip.innerHTML = `<span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">${dfmt(p.week)}</span><strong>₼ ${fmt(Number(p.avg_ppsm), 0)}/m²</strong><span style="font-size:10px;color:var(--muted);margin-left:5px">${p.listing_count} listings</span>`;
		tip.style.display = "block";
		const tipW = tip.offsetWidth || 160;
		const left = Math.min(e.offsetX + 12, svgW - tipW - 4);
		tip.style.left = `${left}px`;
		tip.style.top = `${Math.max(4, e.offsetY - tip.offsetHeight - 8)}px`;
	});
	svg.addEventListener("mouseleave", () => {
		tip.style.display = "none";
	});
}

// ── Map ───────────────────────────────────────────────────────────────────
let lmap = null,
	lmark = null;
function initMap() {
	if (lmap) return;
	lmap = L.map("map-ct", {
		zoomControl: true,
		attributionControl: false,
	});
	L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
		subdomains: "abcd",
		maxZoom: 19,
	}).addTo(lmap);
	const icon = L.divIcon({
		className: "",
		html: '<div class="map-dot"></div>',
		iconSize: [12, 12],
		iconAnchor: [6, 6],
	});
	lmark = L.marker([0, 0], { icon }).addTo(lmap);
}
function openMap(lat, lng) {
	ge("map-modal").showModal();
	requestAnimationFrame(() => {
		initMap();
		lmap.invalidateSize();
		lmark.setLatLng([lat, lng]);
		lmap.setView([lat, lng], 15, { animate: false });
	});
}
ge("map-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget) e.currentTarget.close();
});

// ── Desc ──────────────────────────────────────────────────────────────────
function openDesc(text) {
	ge("desc-body").textContent = text;
	ge("desc-modal").showModal();
}
ge("desc-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget) e.currentTarget.close();
});

// ── Events ────────────────────────────────────────────────────────────────
ge("search-btn").addEventListener("click", () => doSearch(false));
ge("load-more-btn").addEventListener("click", () => doSearch(true));
function updateThreshBg() {
	const t = ge("thresh");
	const p = ((t.value - t.min) / (t.max - t.min)) * 100;
	t.style.setProperty("--p", `${p}%`);
}
ge("thresh").addEventListener("input", (e) => {
	ge("tval").textContent = `${e.target.value}%`;
	updateThreshBg();
});
updateThreshBg();
ge("sort-sel").addEventListener("change", () => {
	renderedSet.clear();
	render();
});

ge("vgrid").addEventListener("click", () => {
	currentView = "grid";
	ge("vgrid").classList.add("on");
	ge("vlist").classList.remove("on");
	renderedSet.clear();
	render();
});
ge("vlist").addEventListener("click", () => {
	currentView = "list";
	ge("vlist").classList.add("on");
	ge("vgrid").classList.remove("on");
	renderedSet.clear();
	render();
});

ge("saved-btn").addEventListener("click", () => {
	showingSaved = !showingSaved;
	ge("saved-btn").classList.toggle("on", showingSaved);
	renderedSet.clear();
	render();
});

ge("adv-toggle").addEventListener("click", () => {
	const panel = ge("adv-panel");
	const open = panel.classList.toggle("open");
	ge("adv-toggle").setAttribute("aria-expanded", open);
});

// Enter to search, Escape to close modals
document.addEventListener("keydown", (e) => {
	if (
		e.key === "Enter" &&
		!["BUTTON", "A", "SELECT"].includes(e.target.tagName)
	)
		doSearch(false);
	if (e.key === "Escape") {
		ge("map-modal").close();
		ge("desc-modal").close();
	}
});

// Live chip updates
["hasRepair", "hasDocument", "hasMortgage", "isUrgent"].forEach((id) => {
	ge(id).addEventListener("change", updateChips);
});
[
	"minPrice",
	"maxPrice",
	"minArea",
	"maxArea",
	"minRooms",
	"maxRooms",
	"minFloor",
	"maxFloor",
	"minTotalFloors",
	"maxTotalFloors",
	"category",
].forEach((id) => {
	ge(id).addEventListener("input", updateChips);
});

// ── Restore Filters from URL ──────────────────────────────────────────────
const initParams = new URLSearchParams(window.location.search);
const setIfPresent = (k, id) => {
	if (initParams.has(k)) ge(id).value = initParams.get(k);
};
const checkIfPresent = (k, id) => {
	if (initParams.has(k) && initParams.get(k) === "true") ge(id).checked = true;
};

if (initParams.has("threshold")) {
	ge("thresh").value = initParams.get("threshold");
	ge("tval").textContent = `${initParams.get("threshold")}%`;
	updateThreshBg();
}

setIfPresent("minPrice", "minPrice");
setIfPresent("maxPrice", "maxPrice");
setIfPresent("minArea", "minArea");
setIfPresent("maxArea", "maxArea");
setIfPresent("minRooms", "minRooms");
setIfPresent("maxRooms", "maxRooms");
setIfPresent("minFloor", "minFloor");
setIfPresent("maxFloor", "maxFloor");
setIfPresent("minTotalFloors", "minTotalFloors");
setIfPresent("maxTotalFloors", "maxTotalFloors");
setIfPresent("category", "category");

checkIfPresent("hasRepair", "hasRepair");
checkIfPresent("hasDocument", "hasDocument");
checkIfPresent("hasMortgage", "hasMortgage");
checkIfPresent("isUrgent", "isUrgent");

updateChips();

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
	const sel = ge("loc");
	try {
		const r = await fetch("/api/deals/locations");
		const d = await r.json();
		sel.innerHTML = "";
		d.data.forEach((loc) => {
			const o = document.createElement("option");
			o.value = o.textContent = loc;
			sel.appendChild(o);
		});

		if (initParams.has("location")) {
			sel.value = initParams.get("location");
			doSearch(false);
		}
	} catch {
		sel.innerHTML =
			'<option value="" disabled selected>Failed to load</option>';
	}
})();

(async () => {
	try {
		const r = await fetch("/health");
		const d = await r.json();
		ge("health-txt").textContent =
			`${(d.properties || 0).toLocaleString()} listings`;
	} catch {
		ge("health-txt").textContent = "Down";
	}
})();

// ── Heatmap ───────────────────────────────────────────────────────────────
const DISTRICT_COORDS = {
	Nasimi: [40.3777, 49.8432],
	Yasamal: [40.3853, 49.8213],
	Nərimanov: [40.4109, 49.868],
	Sabunçu: [40.4352, 49.938],
	Nizami: [40.3924, 49.8528],
	Binəqədi: [40.4426, 49.8345],
	Xətai: [40.3777, 49.8792],
	Suraxanı: [40.3951, 49.9641],
	Səbail: [40.3642, 49.835],
	Qaradağ: [40.2032, 49.9462],
	Pirallahı: [40.5157, 49.9965],
	Abşeron: [40.5127, 49.8372],
};

let hmap = null;
const hmLayers = [];

function priceColor(val, min, max) {
	const t = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
	// green → yellow → red
	if (t < 0.5) {
		const r = Math.round(34 + (245 - 34) * (t * 2));
		const g = Math.round(197 + (158 - 197) * (t * 2));
		const b = Math.round(94 + (11 - 94) * (t * 2));
		return `rgb(${r},${g},${b})`;
	}
	const u = (t - 0.5) * 2;
	const r = Math.round(245 + (239 - 245) * u);
	const g = Math.round(158 + (68 - 158) * u);
	const b = Math.round(11 + (68 - 11) * u);
	return `rgb(${r},${g},${b})`;
}

function renderHeatmap(data) {
	hmap.invalidateSize();
	hmLayers.forEach((l) => {hmap.removeLayer(l)});
	hmLayers.length = 0;

	const prices = data.map((d) => d.avg_price_per_sqm);
	const minP = Math.min(...prices);
	const maxP = Math.max(...prices);
	const maxCount = Math.max(...data.map((d) => d.count));

	data.forEach((d) => {
		const coords = DISTRICT_COORDS[d.district];
		if (!coords) return;
		const color = priceColor(d.avg_price_per_sqm, minP, maxP);
		const radius = 350 + (d.count / maxCount) * 550;
		const circle = L.circle(coords, {
			radius,
			color,
			fillColor: color,
			fillOpacity: 0.55,
			weight: 1.5,
			opacity: 0.8,
		}).addTo(hmap);
		circle.bindTooltip(
			`<div class="hm-tip">
        <div class="hm-tip-name">${d.district}</div>
        <div class="hm-tip-price">₼ ${fmt(d.avg_price_per_sqm, 0)}<span>/m²</span></div>
        <div class="hm-tip-count">${d.count.toLocaleString()} listings</div>
      </div>`,
			{ sticky: true, opacity: 1, className: "hm-tooltip" },
		);
		hmLayers.push(circle);
	});

	// Fit to circles
	if (hmLayers.length) {
		const group = L.featureGroup(hmLayers);
		hmap.fitBounds(group.getBounds().pad(0.12));
	}

	// Legend
	const steps = 5;
	let legendHtml =
		'<div class="hm-legend-label">Avg ₼/m²</div><div class="hm-legend-scale">';
	for (let i = 0; i <= steps; i++) {
		const v = minP + (i / steps) * (maxP - minP);
		const c = priceColor(v, minP, maxP);
		legendHtml += `<div class="hm-legend-step"><div class="hm-legend-dot" style="background:${c}"></div><span>${fmt(v, 0)}</span></div>`;
	}
	legendHtml += "</div>";
	ge("heatmap-legend").innerHTML = legendHtml;
}

ge("heatmap-btn").addEventListener("click", () => {
	ge("heatmap-modal").showModal();
	// Wait one frame so the dialog has real pixel dimensions before Leaflet touches it
	requestAnimationFrame(() => {
		if (!hmap) {
			hmap = L.map("heatmap-ct", {
				zoomControl: true,
				attributionControl: false,
			});
			L.tileLayer(
				"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
				{ subdomains: "abcd", maxZoom: 19 },
			).addTo(hmap);
			hmap.setView([40.38, 49.87], 11);
		} else {
			hmap.invalidateSize();
		}

		fetch("/api/heatmap")
			.then((r) => r.json())
			.then((d) => {
				if (d.error) {
					toast(d.error, true);
					return;
				}
				renderHeatmap(d.data);
			})
			.catch((e) => toast(e.message, true));
	});
});

ge("heatmap-close").addEventListener("click", () =>
	ge("heatmap-modal").close(),
);
ge("heatmap-modal").addEventListener("click", (e) => {
	if (e.target === e.currentTarget) e.currentTarget.close();
});
