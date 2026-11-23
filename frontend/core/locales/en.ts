export default {
	// App
	appName: "Redeal",
	appTagline: "Baku undervalued property scanner",

	// Header
	location: "Location",
	chooseLocs: "Choose locations...",
	allLocations: "All locations",
	all: "All",
	failedLocs: "Failed to load locations",
	priceMap: "Location Map",
	priceMapTitle: "Location map by district",
	discountThreshold: "Discount threshold",
	advancedFilters: "Advanced filters",

	// Num filter labels
	minPrice: "Min price (₼)",
	maxPrice: "Max price (₼)",
	minPriceSqm: "Min ₼/m²",
	maxPriceSqm: "Max ₼/m²",
	minArea: "Min area (m²)",
	maxArea: "Max area (m²)",
	minRooms: "Min rooms",
	maxRooms: "Max rooms",
	minFloor: "Min floor",
	maxFloor: "Max floor",
	minTotalFloors: "Min building floors",
	maxTotalFloors: "Max building floors",

	// Chip labels
	chipMinPrice: "Min ₼",
	chipMaxPrice: "Max ₼",
	chipMinPriceSqm: "Min ₼/m²",
	chipMaxPriceSqm: "Max ₼/m²",
	chipMinArea: "Min m²",
	chipMaxArea: "Max m²",
	chipMinRooms: "Min rooms",
	chipMaxRooms: "Max rooms",
	chipMinFloor: "Min flr",
	chipMaxFloor: "Max flr",
	chipMinTotalFloors: "Min bldg flr",
	chipMaxTotalFloors: "Max bldg flr",

	// Check filters
	hasRepair: "Repaired",
	hasDocument: "Has document",
	hasMortgage: "Mortgage eligible",
	isUrgent: "Urgent only",
	notLastFloor: "Not last floor",

	// Selects
	category: "Category",
	listingType: "Listing type",
	activeMortgage: "Active mortgage",
	any: "Any",
	sale: "Sale",
	newBuild: "New build",
	secondary: "Secondary",
	house: "House / villa",
	rent: "Rent",
	no: "No",
	yes: "Yes",

	// Description search
	descriptionSearch: "Keyword",
	descriptionSearchPlaceholder: "e.g. corner, sea view...",
	chipDescSearch: "Description",

	// Chip display
	chipCategory: "Category",
	chipActiveMortgage: "Active mortgage",

	// Products bar
	alertMe: "Alert me",
	saved: "Saved",
	exportBtn: "Export",
	exportCopied: "Copied to clipboard",
	validateBtn: "Validate",
	validating: "Validating…",
	validateDone: "Removed {deleted} ended listings. Fresh total: {total}.",
	validateDonePartial:
		"Removed {deleted} ended listings ({failed} could not be checked). Fresh total: {total}.",
	sortDisc: "Most discounted",
	sortPriceAsc: "Price: low → high",
	sortPriceDesc: "Price: high → low",
	sortArea: "Largest first",
	sortPpsm: "Cheapest ₼/m²",
	sortDrops: "Price drops first",
	sortNew: "Newest first",
	sortBy: "Sort by",
	gridView: "Grid view",
	listView: "List view",
	mapView: "Map view",

	// States
	searching: "Searching for deals…",
	noResults: "No results found",
	noResultsSub: "Try lowering the discount threshold or removing some filters.",
	welcome: "Discover undervalued properties",
	welcomeSub:
		"Pick a location and discount threshold to find listings priced below the local market average.",

	// Results meta
	savedDeal: "saved deal",
	savedDeals: "saved deals",
	result: "result",
	results: "results",
	total: "total",
	showing: "Showing",
	of: "of",

	// Product card
	marketAvg: "Market avg",
	area: "Area",
	ppsm: "₼/m²",
	rooms: "Rooms",
	floor: "Floor",
	viewListing: "View listing",
	price: "Price",
	viewShort: "View ↗",
	rooms_: "rooms",
	floor_: "floor",

	// Tags
	tagUrgent: "Urgent",
	tagDocument: "Document",
	tagRepaired: "Repaired",
	tagMortgage: "Mortgage",
	tagActiveMortgage: "Active mortgage",
	tagPriceDrop: "dropped {n}×",
	tagNew: "New",

	// Buttons
	btnSave: "Save",
	btnHide: "Hide",
	btnDelete: "Delete",
	confirmDelete: "Are you sure you want to permanently delete this listing?",
	btnDescription: "Description",
	btnMap: "Map",
	btnPhotos: "Photos",
	btnShare: "Share",
	shareCopied: "Link copied!",
	backToTop: "Top",
	tierFilter: "Deal type",
	tierFilterAll: "All types",

	// Alerts
	telegramAlerts: "Telegram alerts",
	activeAlerts: "Active alerts",
	cancel: "Cancel",
	saveAlert: "Save alert",
	chatIdLabel: "Telegram Chat ID",
	alertLabel: "Label (optional)",
	chatIdPlaceholder: "e.g. 123456789",
	alertLabelPlaceholder: "e.g. 2BR Nərimanov",
	deleteAlert: "Delete alert",
	unnamed: "Unnamed",
	alertSaved:
		"Alert saved! You'll get a Telegram message when new deals appear.",
	alertDeleted: "Alert deleted",
	invalidChatId: "Enter a valid Telegram Chat ID (digits only)",
	failedAlert: "Failed to create alert",
	failedDeleteAlert: "Failed to delete alert",
	botInstruction: "Open {bot} and send {start} to get your Chat ID.",
	toastRemoved: "Removed from saved",
	toastSaved: "★ Deal saved",
	toastHidden: "Item hidden",
	toastDeleted: "Item permanently deleted",
	deleteFailed: "Failed to delete item",
	listingEnded: "This listing has ended and was removed.",
	listingEndedBanner: "This listing has ended on bina.az.",

	// Units & Labels
	listing: "listing",
	listings: "listings",
	ago: "ago",
	unitMin: "m",
	unitHour: "h",
	unitDay: "d",
	unitWeek: "w",
	weeksOfData: "{n} weeks of data",
	weekOfData: "{n} week of data",
	statusLive: "Live",
	statusDown: "Down",
	allListings: "Live listings count",

	// Alert preview
	allLocsPrev: "All locations",
	belowAvg: "below avg",
	previewRooms: "rooms",
	previewArea: "m²",
	previewRepaired: "Repaired",
	previewDocument: "Document",
	previewUrgent: "Urgent",
	previewNoActiveMortgage: "No active mortgage",
	matchingFilters: "Matching filters",

	// Trend
	avgTrend: "Avg ₼/m² trend",

	// District stats
	districtStats: "District Stats",
	districtSubtitle: "{n} districts",
	districtCol: "District",
	districtAvgPpsm: "Avg ₼/m²",
	districtListings: "Listings",
	districtTrend: "4w Trend",
	districtLoading: "Loading stats…",
	districtError: "Failed to load stats",
	districtEmpty: "No district data yet",
	statsBtn: "Stats",
	scrapeOps: "Scrape Ops",
	runNow: "Run now",
	scrapeRuns: "Scrape runs",
	scrapeRunSubtitle: "Latest scrape activity",
	scrapeRunEmpty: "No scrape runs yet",
	scrapeRunLoading: "Loading scrape runs…",
	scrapeRunRunning: "Running…",
	scrapeRunError: "Failed to load scrape runs",
	scrapeRunStatus: "Status",
	scrapeRunTrigger: "Trigger",
	scrapeRunDuration: "Duration",
	scrapeRunFetched: "Fetched",
	scrapeRunPersisted: "Persisted",
	scrapeRunSkipped: "Skipped",
	scrapeRunErrors: "Errors",
	scrapeRunPlatform: "Platform",
	scrapeRunStarted: "Started",
	scrapeRunFinished: "Finished",
	scrapeRunOptions: "Options",
	scrapeAdminPasswordPrompt: "Enter scrape admin password",
	scrapeAdminPasswordRequired: "Scrape admin password required",
	searchDistrict: "Search district...",

	// Property detail modal
	viewDetails: "Details",
	propDetails: "Property Details",
	propNoImages: "No photos available",
	propNoDesc: "No description provided",
	propNoMap: "Location not available",
	propDiscount: "Discount",
	propMarketAvg: "Market avg",
	propPosted: "Posted",
	propPhotoAlt: "Property photo {n} of {total}",
	gallery: "Gallery",
	galleryPrev: "Previous photo",
	galleryNext: "Next photo",
	galleryExpand: "Expand photo",

	// Tiers
	tierHigh: "High Value Deal",
	tierGood: "Good Deal",
	tierFair: "Fair Price",
	tierNormal: "Market Price",
	tierOverpriced: "Overpriced",
	tierHighShort: "High Value",
	tierGoodShort: "Good",
	tierFairShort: "Fair",
	tierNormalShort: "Market",
	tierOverpricedShort: "Overpriced",
	clearFilters: "Clear filters",
	priceHistory: "Price history",
	tierTipBelow: "{n}% below market avg",
	tierTipAbove: "{n}% above market avg",

	// Public preview & auth prompt
	signIn: "Sign in",
	signInWithGoogle: "Continue with Google",
	loginRequiredTitle: "Sign in to unlock full access",
	loginRequiredFilter:
		"Sign in to filter listings by price, area, rooms, floor, mortgage, and keywords.",
	loginRequiredSort:
		"Sign in to sort deals by price, price drops, area, or ₼/m².",
	loginRequiredAlerts:
		"Sign in to set up instant Telegram alerts when matching deals appear.",
	loginRequiredMore:
		"Sign in to explore all {total} deals beyond the {limit}-listing public preview.",
	loginRequiredGeneral:
		"Sign in with your approved Google account to unlock advanced filters, sorting, alerts, and full listings.",
	loginBenefitFilters:
		"Filter by budget, area, rooms, floor, repair, mortgage & keywords",
	loginBenefitAll:
		"Browse all listings beyond the 50-deal preview & custom sorting",
	loginBenefitAlerts:
		"Get instant Telegram alerts when undervalued listings drop",
	loginWhitelistNote: "Private access · Whitelisted Google accounts only",
	continuePreview: "Continue browsing preview",
	previewBannerBadge: "Public preview",
	previewBannerText:
		"Location & discount threshold are free — sign in for price, room & keyword filters, sorting & alerts",
	previewLimitTitle: "You've reached the end of the {limit}-deal preview",
	previewLimitSub:
		"Sign in with Google to view all {total} deals and unlock advanced filters, sorting, and Telegram alerts.",
	backToPreview: "Back to public preview",

	// Access management & pending sign-in requests
	accessDialogTitle: "Access Management",
	accessDialogDesc:
		"Approve pending sign-in requests and manage whitelisted Google accounts.",
	accessRequestsTitle: "Pending Sign-in Requests",
	accessRequestsSubtitle:
		"Non-whitelisted Google accounts that tried to sign in.",
	accessRequestsCount: "{n} pending",
	accessRequestsEmpty: "No pending sign-in requests.",
	accessRequestsLoading: "Loading requests…",
	accessRequestsLoadError: "Failed to load requests",
	accessApprove: "Approve",
	accessDismiss: "Dismiss",
	accessApprovedFeedback: "Approved {email} and added to whitelist",
	accessDismissedFeedback: "Dismissed request from {email}",
	accessAttemptCount: "{n} attempts",
	whitelistTitle: "Allowed Google Accounts",
	whitelistSubtitle:
		"Only whitelisted Google emails can access this application.",
	whitelistCount: "{n} accounts",
	whitelistEmailPlaceholder: "Google email (e.g. user@gmail.com)",
	whitelistNotePlaceholder: "Optional note / name",
	whitelistAddBtn: "Add Email",
	whitelistLoading: "Loading whitelist…",
	whitelistEmpty: "No emails on whitelist yet. Add one above to grant access.",
	whitelistLoadError: "Failed to load whitelist",
	whitelistAddedFeedback: "Added {email} to whitelist",
	whitelistRemovedFeedback: "Removed {email}",
	whitelistConfirmRemove:
		'Remove "{email}" from whitelist? They will immediately lose access.',
	whitelistAddedDate: "Added {date}",
	loginRequestPendingTitle: "Access Request Received",
	loginRequestPendingMsg:
		'The Google account "{email}" is not whitelisted yet. Your sign-in request has been saved and is waiting for admin approval.',
	loginRequestPendingMsgGeneric:
		"Your Google account is not whitelisted yet. Your sign-in request has been saved for admin approval.",
	loginFooterRequestNote:
		"Not whitelisted yet? Sign in with Google to send an access request for admin approval.",
} as const;
