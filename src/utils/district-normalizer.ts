/**
 * Canonical Baku district names and alias normalization.
 * Azerbaijani listings use many spellings, abbreviations, and Romanizations.
 * This module maps them all to a single standard string.
 */

export enum BakuDistrict {
	NASIMI = "Nasimi",
	YASAMAL = "Yasamal",
	NARIMANOV = "Nərimanov",
	SABUNCHU = "Sabunçu",
	NIZAMI = "Nizami",
	BINAGADI = "Binəqədi",
	KHATAI = "Xətai",
	SURAKHANI = "Suraxanı",
	SABAIL = "Səbail",
	GARADAGH = "Qaradağ",
	PIRALLAHI = "Pirallahı",
	ABSHERON = "Abşeron",
	UNKNOWN = "Unknown",
}

/** All known aliases mapped to their canonical district value */
const DISTRICT_ALIASES: Record<string, BakuDistrict> = {
	// Nərimanov
	nərimanov: BakuDistrict.NARIMANOV,
	nerimanov: BakuDistrict.NARIMANOV,
	narimanov: BakuDistrict.NARIMANOV,
	"nərimanov r.": BakuDistrict.NARIMANOV,
	"nərimanov ray.": BakuDistrict.NARIMANOV,
	"nərimanov rayonu": BakuDistrict.NARIMANOV,

	// Nasimi
	nasimi: BakuDistrict.NASIMI,
	"nasimi r.": BakuDistrict.NASIMI,
	"nasimi ray.": BakuDistrict.NASIMI,
	"nasimi rayonu": BakuDistrict.NASIMI,

	// Yasamal
	yasamal: BakuDistrict.YASAMAL,
	"yasamal r.": BakuDistrict.YASAMAL,
	"yasamal ray.": BakuDistrict.YASAMAL,
	"yasamal rayonu": BakuDistrict.YASAMAL,

	// Sabunçu
	sabunçu: BakuDistrict.SABUNCHU,
	sabunchu: BakuDistrict.SABUNCHU,
	sabuncu: BakuDistrict.SABUNCHU,
	"sabunçu r.": BakuDistrict.SABUNCHU,
	"sabunçu rayonu": BakuDistrict.SABUNCHU,

	// Nizami
	nizami: BakuDistrict.NIZAMI,
	"nizami r.": BakuDistrict.NIZAMI,
	"nizami ray.": BakuDistrict.NIZAMI,
	"nizami rayonu": BakuDistrict.NIZAMI,

	// Binəqədi
	binəqədi: BakuDistrict.BINAGADI,
	binagadi: BakuDistrict.BINAGADI,
	binaqadi: BakuDistrict.BINAGADI,
	"binəqədi r.": BakuDistrict.BINAGADI,
	"binəqədi rayonu": BakuDistrict.BINAGADI,

	// Xətai
	xətai: BakuDistrict.KHATAI,
	khatai: BakuDistrict.KHATAI,
	xetai: BakuDistrict.KHATAI,
	"xətai r.": BakuDistrict.KHATAI,
	"xətai rayonu": BakuDistrict.KHATAI,

	// Suraxanı
	suraxanı: BakuDistrict.SURAKHANI,
	surakhani: BakuDistrict.SURAKHANI,
	suraxani: BakuDistrict.SURAKHANI,

	// Səbail
	səbail: BakuDistrict.SABAIL,
	sabail: BakuDistrict.SABAIL,
	sebail: BakuDistrict.SABAIL,
	"səbail r.": BakuDistrict.SABAIL,

	// Qaradağ
	qaradağ: BakuDistrict.GARADAGH,
	garadagh: BakuDistrict.GARADAGH,
	qaradag: BakuDistrict.GARADAGH,

	// Pirallahı
	pirallahı: BakuDistrict.PIRALLAHI,
	pirallahi: BakuDistrict.PIRALLAHI,

	// Abşeron
	abşeron: BakuDistrict.ABSHERON,
	absheron: BakuDistrict.ABSHERON,
	abseron: BakuDistrict.ABSHERON,
};

/**
 * Maps bina.az district-level slug segments (second path component in 3-part slugs)
 * to canonical BakuDistrict values.
 * Confirmed from API: locations with locationGroupId=3 always follow
 * the pattern baki/{DISTRICT_SLUG}/{neighborhood-slug}.
 */
const DISTRICT_SLUG_MAP: Record<string, BakuDistrict> = {
	nesimi: BakuDistrict.NASIMI,
	nizami: BakuDistrict.NIZAMI,
	nerimanov: BakuDistrict.NARIMANOV,
	yasamal: BakuDistrict.YASAMAL,
	xetai: BakuDistrict.KHATAI,
	sabuncu: BakuDistrict.SABUNCHU,
	bineqedi: BakuDistrict.BINAGADI,
	sebail: BakuDistrict.SABAIL,
	abseron: BakuDistrict.ABSHERON,
	suraxani: BakuDistrict.SURAKHANI,
	pirallahi: BakuDistrict.PIRALLAHI,
	qaradag: BakuDistrict.GARADAGH,
};

/**
 * Maps 2-part bina.az location slugs (metro stations and named areas that don't
 * include the district prefix in their slug) to their parent district.
 * Derived from Baku metro geography and the bina.az location API.
 */
const METRO_AND_AREA_TO_DISTRICT: Record<string, BakuDistrict> = {
	// Nərimanov district
	"neriman-nerimanov": BakuDistrict.NARIMANOV,
	genclik: BakuDistrict.NARIMANOV,
	bakmil: BakuDistrict.NARIMANOV,
	"elmler-akademiyasi": BakuDistrict.NARIMANOV,
	insaatcilar: BakuDistrict.NARIMANOV,
	koroglu: BakuDistrict.NARIMANOV,
	"8-noyabr": BakuDistrict.NARIMANOV,

	// Nasimi district
	"20-yanvar": BakuDistrict.NASIMI,
	"28-may": BakuDistrict.NASIMI,
	sahil: BakuDistrict.NASIMI,
	neftcilar: BakuDistrict.NASIMI,
	"xalqlar-dostlugu": BakuDistrict.NASIMI,

	// Yasamal district
	"memar-ecemi": BakuDistrict.YASAMAL,
	narimanov: BakuDistrict.YASAMAL,

	// Xətai district
	"hezi-aslanov": BakuDistrict.KHATAI,
	"sah-ismayil-xetai": BakuDistrict.KHATAI,
	avtovagzal: BakuDistrict.KHATAI,

	// Binəqədi district
	"azadliq-prospekti": BakuDistrict.BINAGADI,

	// Abşeron district
	abseron: BakuDistrict.ABSHERON,
};

/**
 * Converts a bina.az location slug to a canonical BakuDistrict.
 *
 * Handles two slug shapes returned by the API:
 *  - 3 parts: `baki/{district-slug}/{neighborhood}` → extract parts[1]
 *  - 2 parts: `baki/{metro-or-area-slug}`            → look up in metro map
 *
 * @example
 * slugToDistrict("baki/nesimi/1-ci-mikrorayon")  // → "Nasimi"
 * slugToDistrict("baki/sabuncu/bakixanov")        // → "Sabunçu"
 * slugToDistrict("baki/neriman-nerimanov")        // → "Nərimanov"
 * slugToDistrict("baki/genclik")                  // → "Nərimanov"
 */
export function slugToDistrict(slug: string): BakuDistrict {
	const parts = slug.split("/");

	if (parts.length >= 3) {
		// baki/{district-slug}/{neighborhood} — district is always parts[1]
		return DISTRICT_SLUG_MAP[parts[1] ?? ""] ?? BakuDistrict.UNKNOWN;
	}

	if (parts.length === 2) {
		const loc = parts[1] ?? "";
		// Could be a district slug itself or a metro/area slug
		return (
			DISTRICT_SLUG_MAP[loc] ??
			METRO_AND_AREA_TO_DISTRICT[loc] ??
			BakuDistrict.UNKNOWN
		);
	}

	return BakuDistrict.UNKNOWN;
}

/**
 * Normalizes a raw district string scraped from a listing to a canonical BakuDistrict.
 * Strips leading/trailing whitespace and performs case-insensitive lookup.
 * Returns BakuDistrict.UNKNOWN if no alias matches.
 *
 * @example
 * normalizeDistrict("Nərimanov r.")  // → "Nərimanov"
 * normalizeDistrict("narimanov")     // → "Nərimanov"
 * normalizeDistrict("yasamal ray.")  // → "Yasamal"
 */
export function normalizeDistrict(raw: string): BakuDistrict {
	const key = raw.trim().toLowerCase();
	return DISTRICT_ALIASES[key] ?? BakuDistrict.UNKNOWN;
}
