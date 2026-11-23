type ChromiumProfile = {
	userAgent: string;
	secChUa: string;
	platform: string;
};

const CHROMIUM_PROFILES: [ChromiumProfile, ...ChromiumProfile[]] = [
	{
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
		secChUa:
			'"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
		platform: '"macOS"',
	},
	{
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
		secChUa:
			'"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
		platform: '"Windows"',
	},
	{
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
		secChUa: '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
		platform: '"macOS"',
	},
	{
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
		secChUa: '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
		platform: '"Windows"',
	},
	{
		userAgent:
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
		secChUa:
			'"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
		platform: '"Linux"',
	},
];

const ACCEPT_LANGUAGES: [string, ...string[]] = [
	"az-AZ,az;q=0.9,en-US;q=0.8,en;q=0.7",
	"az-AZ,az;q=0.9,en;q=0.8",
	"az,en-US;q=0.9,en;q=0.8",
];

function pick<T>(arr: [T, ...T[]]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

export type BinaHeaderProfile = {
	graphql: (referer?: string) => Record<string, string>;
	html: () => Record<string, string>;
};

/**
 * Creates a consistent modern Chromium header profile for a single scrape or
 * status-check session so User-Agent, sec-ch-ua*, and Accept-Language match
 * across all requests in that run.
 */
export function createBinaHeaderProfile(): BinaHeaderProfile {
	const profile = pick(CHROMIUM_PROFILES);
	const acceptLanguage = pick(ACCEPT_LANGUAGES);

	return {
		graphql(referer = "https://bina.az/baki/alqi-satqi/menziller") {
			return {
				"Content-Type": "application/json",
				"User-Agent": profile.userAgent,
				Accept: "application/json, text/plain, */*",
				Origin: "https://bina.az",
				Referer: referer,
				"Accept-Language": acceptLanguage,
				"Accept-Encoding": "gzip, deflate, br",
				"sec-ch-ua": profile.secChUa,
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": profile.platform,
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-origin",
			};
		},
		html() {
			return {
				"User-Agent": profile.userAgent,
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
				"Accept-Language": acceptLanguage,
				"sec-ch-ua": profile.secChUa,
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": profile.platform,
				"sec-fetch-dest": "document",
				"sec-fetch-mode": "navigate",
				"sec-fetch-site": "none",
			};
		},
	};
}
