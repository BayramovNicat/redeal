type Lang = "en" | "az" | "ru";

const STORAGE_KEY = "redeal-lang";

const translations = {
	en: {
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
		noResultsSub:
			"Try lowering the discount threshold or removing some filters.",
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
		whitelistEmpty:
			"No emails on whitelist yet. Add one above to grant access.",
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
	},

	az: {
		appName: "Redeal",
		appTagline: "Bakı bazarında ucuz əmlak axtarıcısı",

		priceMap: "Ərazi xəritəsi",
		priceMapTitle: "Ərazilər üzrə xəritə",

		location: "Ərazi",
		chooseLocs: "Ərazi seçin...",
		allLocations: "Bütün ərazilər",
		all: "Hamısı",
		failedLocs: "Ərazilər yüklənmədi",
		discountThreshold: "Endirim həddi",
		advancedFilters: "Ətraflı filtrlər",

		minPrice: "Min qiymət (₼)",
		maxPrice: "Maks qiymət (₼)",
		minPriceSqm: "Min ₼/m²",
		maxPriceSqm: "Maks ₼/m²",
		minArea: "Min sahə (m²)",
		maxArea: "Maks sahə (m²)",
		minRooms: "Min otaq",
		maxRooms: "Maks otaq",
		minFloor: "Min mərtəbə",
		maxFloor: "Maks mərtəbə",
		minTotalFloors: "Min bina mərtəbəsi",
		maxTotalFloors: "Maks bina mərtəbəsi",

		chipMinPrice: "Min ₼",
		chipMaxPrice: "Maks ₼",
		chipMinPriceSqm: "Min ₼/m²",
		chipMaxPriceSqm: "Maks ₼/m²",
		chipMinArea: "Min m²",
		chipMaxArea: "Maks m²",
		chipMinRooms: "Min otaq",
		chipMaxRooms: "Maks otaq",
		chipMinFloor: "Min mrt",
		chipMaxFloor: "Maks mrt",
		chipMinTotalFloors: "Min bina mrt",
		chipMaxTotalFloors: "Maks bina mrt",

		hasRepair: "Təmirli",
		hasDocument: "Sənədli",
		hasMortgage: "İpoteka var",
		isUrgent: "Yalnız təcili",
		notLastFloor: "Son mərtəbə deyil",

		category: "Kateqoriya",
		listingType: "Elan tipi",
		activeMortgage: "Aktiv ipoteka",
		any: "Hər hansı",
		sale: "Satış",
		newBuild: "Yeni tikili",
		secondary: "Köhnə tikili",
		house: "Həyət evi/Bağ evi",
		rent: "Kirayə",
		no: "Xeyr",
		yes: "Bəli",

		descriptionSearch: "Açar söz",
		descriptionSearchPlaceholder: "məs. küncə, dəniz mənzərəsi...",
		chipDescSearch: "Açar söz",

		chipCategory: "Kateqoriya",
		chipActiveMortgage: "Aktiv ipoteka",

		alertMe: "Bildiriş al",
		saved: "Saxlanılanlar",
		exportBtn: "İxrac",
		exportCopied: "Buferə kopyalandı",
		validateBtn: "Yoxla",
		validating: "Yoxlanılır…",
		validateDone: "Bitmiş {deleted} elan silindi. Yeni cəmi: {total}.",
		validateDonePartial:
			"Bitmiş {deleted} elan silindi ({failed} yoxlanıla bilmədi). Yeni cəmi: {total}.",
		sortDisc: "Ən çox endirimli",
		sortPriceAsc: "Qiymət: aşağıdan yuxarı",
		sortPriceDesc: "Qiymət: yuxarıdan aşağı",
		sortArea: "Ən böyük əvvəl",
		sortPpsm: "Ən ucuz ₼/m²",
		sortDrops: "Qiymət düşümü əvvəl",
		sortNew: "Ən yeni əvvəl",
		sortBy: "Sırala",
		gridView: "Şəbəkə görünüşü",
		listView: "Siyahı görünüşü",
		mapView: "Xəritə görünüşü",

		searching: "Elanlar axtarılır…",
		noResults: "Nəticə tapılmadı",
		noResultsSub: "Endirim həddini azaldın və ya filtrləri çıxarın.",
		welcome: "Ucuz əmlak tapın",
		welcomeSub:
			"Yerli bazar ortalamasından aşağı qiymətli elanları tapmaq üçün ərazi və endirim həddi seçin.",

		savedDeal: "saxlanılan elan",
		savedDeals: "saxlanılan elan",
		result: "nəticə",
		results: "nəticə",
		total: "cəmi",
		showing: "Göstərilir",
		of: "/",

		marketAvg: "Bazar ort",
		area: "Sahə",
		ppsm: "₼/m²",
		rooms: "Otaq",
		floor: "Mərtəbə",
		viewListing: "Elana bax",
		price: "Qiymət",
		viewShort: "Bax ↗",
		rooms_: "otaq",
		floor_: "mərtəbə",

		tagUrgent: "Təcili",
		tagDocument: "Sənədli",
		tagRepaired: "Təmirli",
		tagMortgage: "İpoteka",
		tagActiveMortgage: "Aktiv ipoteka",
		tagPriceDrop: "{n}× endirim oldu",
		tagNew: "Yeni",

		btnSave: "Saxla",
		btnHide: "Gizlət",
		btnDelete: "Sil",
		confirmDelete: "Bu elanı birdəfəlik silmək istədiyinizdən əminsiniz?",
		btnDescription: "Təsvir",
		btnMap: "Xəritədə bax",
		btnPhotos: "Fotolar",
		btnShare: "Paylaş",
		shareCopied: "Link kopyalandı!",
		backToTop: "Yuxarı",
		tierFilter: "Növ",
		tierFilterAll: "Hamısı",

		telegramAlerts: "Telegram bildirişləri",
		activeAlerts: "Aktiv bildirişlər",
		cancel: "Ləğv et",
		saveAlert: "Bildiriş saxla",
		chatIdLabel: "Telegram Chat ID",
		alertLabel: "Ad (isteğe bağlı)",
		chatIdPlaceholder: "məs. 123456789",
		alertLabelPlaceholder: "məs. 2 otaqlı Nəriman",
		deleteAlert: "Bildirişi sil",
		unnamed: "Adsız",
		alertSaved:
			"Bildiriş saxlanıldı! Yeni elanlar çıxanda Telegram mesajı alacaqsınız.",
		alertDeleted: "Bildiriş silindi",
		invalidChatId: "Düzgün Telegram Chat ID daxil edin (yalnız rəqəmlər)",
		failedAlert: "Bildiriş yaradılmadı",
		failedDeleteAlert: "Bildiriş silinmədi",
		botInstruction: "{bot} açın və Chat ID almaq üçün {start} göndərin.",
		toastRemoved: "Saxlanılanlardan silindi",
		toastSaved: "★ Elan saxlanıldı",
		toastHidden: "Elan gizlədildi",
		toastDeleted: "Elan birdəfəlik silindi",
		deleteFailed: "Elan silinmədi",
		listingEnded: "Elanın müddəti başa çatıb və silindi.",
		listingEndedBanner: "Bu elanın müddəti bina.az-da başa çatıb.",

		// Units & Labels
		listing: "elan",
		listings: "elan",
		ago: "əvvəl",
		unitMin: "dəq",
		unitHour: "saat",
		unitDay: "gün",
		unitWeek: "həftə",
		weeksOfData: "{n} həftəlik məlumat",
		weekOfData: "{n} həftəlik məlumat",
		statusLive: "Canlı",
		statusDown: "Sönülü",
		allListings: "Ümumi elan sayı",

		allLocsPrev: "Bütün ərazilər",
		belowAvg: "ortalamasından aşağı",
		previewRooms: "otaq",
		previewArea: "m²",
		previewRepaired: "Təmirli",
		previewDocument: "Sənədli",
		previewUrgent: "Təcili",
		previewNoActiveMortgage: "Aktiv ipoteka yox",
		matchingFilters: "Uyğun filtrlər",

		avgTrend: "Ort ₼/m² trendi",

		// District stats
		districtStats: "Rayon Statistikası",
		districtSubtitle: "{n} rayon",
		districtCol: "Rayon",
		districtAvgPpsm: "Ort ₼/m²",
		districtListings: "Elanlar",
		districtTrend: "4h Trendi",
		districtLoading: "Yüklənir…",
		districtError: "Statistika yüklənmədi",
		districtEmpty: "Rayon məlumatı yoxdur",
		statsBtn: "Statistika",
		scrapeOps: "Scrape Ops",
		runNow: "İndi işə sal",
		scrapeRuns: "Scrape işləri",
		scrapeRunSubtitle: "Son scrape fəaliyyəti",
		scrapeRunEmpty: "Hələ scrape yoxdur",
		scrapeRunLoading: "Scrape işləri yüklənir…",
		scrapeRunRunning: "İşləyir…",
		scrapeRunError: "Scrape işləri yüklənmədi",
		scrapeRunStatus: "Status",
		scrapeRunTrigger: "Səbəb",
		scrapeRunDuration: "Müddət",
		scrapeRunFetched: "Toplanan",
		scrapeRunPersisted: "Yazılan",
		scrapeRunSkipped: "Atlanan",
		scrapeRunErrors: "Xətalar",
		scrapeRunPlatform: "Platforma",
		scrapeRunStarted: "Başlanıb",
		scrapeRunFinished: "Bitib",
		scrapeRunOptions: "Seçimlər",
		scrapeAdminPasswordPrompt: "Scrape admin şifrəsini daxil edin",
		scrapeAdminPasswordRequired: "Scrape admin şifrəsi lazımdır",
		searchDistrict: "Rayon axtar...",

		// Property detail modal
		viewDetails: "Ətraflı",
		propDetails: "Əmlak Təfərrüatları",
		propNoImages: "Foto yoxdur",
		propNoDesc: "Təsvir yoxdur",
		propNoMap: "Yer məlumatı yoxdur",
		propDiscount: "Endirim",
		propMarketAvg: "Bazar ortalama",
		propPosted: "Tarix",
		propPhotoAlt: "Əmlak fotosu {n} / {total}",
		gallery: "Qalereya",
		galleryPrev: "Əvvəlki foto",
		galleryNext: "Növbəti foto",
		galleryExpand: "Fotoya tam bax",

		// Tiers
		tierHigh: "Yüksək dəyərli",
		tierGood: "Yaxşı təklif",
		tierFair: "Normal qiymət",
		tierNormal: "Bazar qiyməti",
		tierOverpriced: "Baha qiymət",
		tierHighShort: "Əla",
		tierGoodShort: "Yaxşı",
		tierFairShort: "Normal",
		tierNormalShort: "Bazar",
		tierOverpricedShort: "Baha",
		clearFilters: "Filtrləri sıfırla",
		priceHistory: "Qiymət tarixi",
		tierTipBelow: "Bazar ortalamasından {n}% aşağı",
		tierTipAbove: "Bazar ortalamasından {n}% yuxarı",

		// Public preview & auth prompt
		signIn: "Daxil ol",
		signInWithGoogle: "Google ilə davam et",
		loginRequiredTitle: "Tam giriş üçün daxil olun",
		loginRequiredFilter:
			"Qiymət, sahə, otaq, mərtəbə, ipoteka və açar sözlərə görə filtr etmək üçün daxil olun.",
		loginRequiredSort:
			"Qiymət, qiymət enişi, sahə və ya ₼/m² üzrə sıralamaq üçün daxil olun.",
		loginRequiredAlerts:
			"Uyğun elanlar çıxanda ani Telegram bildirişləri almaq üçün daxil olun.",
		loginRequiredMore:
			"{limit} elanlıq önizləmədən kənarda bütün {total} təklifə baxmaq üçün daxil olun.",
		loginRequiredGeneral:
			"Ətraflı filtrləri, sıralamanı, bildirişləri və bütün elanları açmaq üçün təsdiqlənmiş Google hesabınızla daxil olun.",
		loginBenefitFilters:
			"Büdcə, sahə, otaq, mərtəbə, təmir, ipoteka və açar sözlər üzrə filtr",
		loginBenefitAll:
			"50 elanlıq önizləmədən kənar bütün elanlar və fərdi sıralama",
		loginBenefitAlerts: "Yeni ucuz elanlar düşəndə ani Telegram bildirişləri",
		loginWhitelistNote:
			"Şəxsi giriş · Yalnız ağ siyahıda olan Google hesabları",
		continuePreview: "Önizləməyə davam et",
		previewBannerBadge: "İctimai önizləmə",
		previewBannerText:
			"Ərazi və endirim həddi açıqdır — qiymət, otaq, açar söz filtrləri, sıralama və bildirişlər üçün daxil olun",
		previewLimitTitle: "{limit} elanlıq önizləmənin sonuna çatdınız",
		previewLimitSub:
			"Bütün {total} təklifə baxmaq və ətraflı filtrlər, sıralama və Telegram bildirişlərini açmaq üçün Google ilə daxil olun.",
		backToPreview: "İctimai önizləməyə qayıt",

		// Access management & pending sign-in requests
		accessDialogTitle: "Giriş İdarəetməsi",
		accessDialogDesc:
			"Gözləyən giriş sorğularını təsdiqləyin və ağ siyahıdakı Google hesablarını idarə edin.",
		accessRequestsTitle: "Gözləyən Giriş Sorğuları",
		accessRequestsSubtitle:
			"Ağ siyahıda olmayan və daxil olmağa çalışan Google hesabları.",
		accessRequestsCount: "{n} gözləyən",
		accessRequestsEmpty: "Gözləyən giriş sorğusu yoxdur.",
		accessRequestsLoading: "Sorğular yüklənir…",
		accessRequestsLoadError: "Sorğular yüklənmədi",
		accessApprove: "Təsdiqlə",
		accessDismiss: "Rədd et",
		accessApprovedFeedback: "{email} təsdiqləndi və ağ siyahıya əlavə edildi",
		accessDismissedFeedback: "{email} sorğusu silindi",
		accessAttemptCount: "{n} cəhd",
		whitelistTitle: "İcazəli Google Hesabları",
		whitelistSubtitle:
			"Yalnız ağ siyahıda olan Google e-poçtları bu tətbiqə daxil ola bilər.",
		whitelistCount: "{n} hesab",
		whitelistEmailPlaceholder: "Google e-poçt (məs. user@gmail.com)",
		whitelistNotePlaceholder: "İsteğe bağlı qeyd / ad",
		whitelistAddBtn: "Əlavə et",
		whitelistLoading: "Ağ siyahı yüklənir…",
		whitelistEmpty:
			"Ağ siyahıda hələ hesab yoxdur. Giriş vermək üçün yuxarıdan əlavə edin.",
		whitelistLoadError: "Ağ siyahı yüklənmədi",
		whitelistAddedFeedback: "{email} ağ siyahıya əlavə edildi",
		whitelistRemovedFeedback: "{email} silindi",
		whitelistConfirmRemove:
			'"{email}" ağ siyahıdan silinsin? Girişi dərhal ləğv ediləcək.',
		whitelistAddedDate: "Əlavə olunub: {date}",
		loginRequestPendingTitle: "Giriş Sorğusu Qəbul Edildi",
		loginRequestPendingMsg:
			'"{email}" Google hesabı hələ ağ siyahıda deyil. Giriş sorğunuz qeydə alındı və admin təsdiqini gözləyir.',
		loginRequestPendingMsgGeneric:
			"Google hesabınız hələ ağ siyahıda deyil. Giriş sorğunuz admin təsdiqi üçün qeydə alındı.",
		loginFooterRequestNote:
			"Hələ ağ siyahıda deyilsiniz? Admin təsdiqi üçün giriş sorğusu göndərmək məqsədilə Google ilə daxil olun.",
	},

	ru: {
		appName: "Redeal",
		appTagline: "Поиск недооцененной недвижимости в Баку",

		priceMap: "Карта локаций",
		priceMapTitle: "Карта локаций по районам",

		location: "Район",
		chooseLocs: "Выберите район...",
		allLocations: "Все районы",
		all: "Все",
		failedLocs: "Не удалось загрузить районы",
		discountThreshold: "Порог скидки",
		advancedFilters: "Расширенные фильтры",

		minPrice: "Мин цена (₼)",
		maxPrice: "Макс цена (₼)",
		minPriceSqm: "Мин ₼/м²",
		maxPriceSqm: "Макс ₼/м²",
		minArea: "Мин площадь (м²)",
		maxArea: "Макс площадь (м²)",
		minRooms: "Мин комнат",
		maxRooms: "Макс комнат",
		minFloor: "Мин этаж",
		maxFloor: "Макс этаж",
		minTotalFloors: "Мин этажей в доме",
		maxTotalFloors: "Макс этажей в доме",

		chipMinPrice: "Мин ₼",
		chipMaxPrice: "Макс ₼",
		chipMinPriceSqm: "Мин ₼/м²",
		chipMaxPriceSqm: "Макс ₼/м²",
		chipMinArea: "Мин м²",
		chipMaxArea: "Макс м²",
		chipMinRooms: "Мин ком",
		chipMaxRooms: "Макс ком",
		chipMinFloor: "Мин эт",
		chipMaxFloor: "Макс эт",
		chipMinTotalFloors: "Мин эт дома",
		chipMaxTotalFloors: "Макс эт дома",

		hasRepair: "С ремонтом",
		hasDocument: "С документом",
		hasMortgage: "Ипотека возможна",
		isUrgent: "Только срочные",
		notLastFloor: "Не последний этаж",

		category: "Категория",
		listingType: "Тип объявления",
		activeMortgage: "Активная ипотека",
		any: "Любой",
		sale: "Продажа",
		newBuild: "Новостройка",
		secondary: "Вторичный рынок",
		house: "Дом / дача",
		rent: "Аренда",
		no: "Нет",
		yes: "Да",

		descriptionSearch: "Ключевое слово",
		descriptionSearchPlaceholder: "напр. угловая, вид на море...",
		chipDescSearch: "Описание",

		chipCategory: "Категория",
		chipActiveMortgage: "Акт. ипотека",

		alertMe: "Уведомить",
		saved: "Сохранённые",
		exportBtn: "Экспорт",
		exportCopied: "Скопировано в буфер",
		validateBtn: "Проверить",
		validating: "Проверка…",
		validateDone: "Удалено завершённых: {deleted}. Новый итог: {total}.",
		validateDonePartial:
			"Удалено завершённых: {deleted} (не удалось проверить: {failed}). Новый итог: {total}.",
		sortDisc: "Наибольшая скидка",
		sortPriceAsc: "Цена: дешевле",
		sortPriceDesc: "Цена: дороже",
		sortArea: "Большая площадь",
		sortPpsm: "Дешевле ₼/м²",
		sortDrops: "Снижения цены",
		sortNew: "Сначала новые",
		sortBy: "Сортировать",
		gridView: "Сетка",
		listView: "Список",
		mapView: "Карта",

		searching: "Поиск объявлений…",
		noResults: "Ничего не найдено",
		noResultsSub: "Снизьте порог скидки или уберите часть фильтров.",
		welcome: "Найдите выгодную недвижимость",
		welcomeSub:
			"Выберите район и порог скидки, чтобы найти объявления дешевле среднерыночной цены.",

		savedDeal: "сохранённое объявление",
		savedDeals: "сохранённых объявления",
		result: "результат",
		results: "результата",
		total: "всего",
		showing: "Показано",
		of: "из",

		marketAvg: "Ср. по рынку",
		area: "Площадь",
		ppsm: "₼/м²",
		rooms: "Комнат",
		floor: "Этаж",
		viewListing: "Смотреть",
		price: "Цена",
		viewShort: "Смотреть ↗",
		rooms_: "комн",
		floor_: "этаж",

		tagUrgent: "Срочно",
		tagDocument: "Документ",
		tagRepaired: "Ремонт",
		tagMortgage: "Ипотека",
		tagActiveMortgage: "Акт. ипотека",
		tagPriceDrop: "снижена {n}×",
		tagNew: "Новое",

		btnSave: "Сохранить",
		btnHide: "Скрыть",
		btnDelete: "Удалить",
		confirmDelete: "Вы уверены, что хотите навсегда удалить это объявление?",
		btnDescription: "Описание",
		btnMap: "Карта",
		btnPhotos: "Фото",
		btnShare: "Поделиться",
		shareCopied: "Ссылка скопирована!",
		backToTop: "Вверх",
		tierFilter: "Тип сделки",
		tierFilterAll: "Все типы",

		telegramAlerts: "Telegram уведомления",
		activeAlerts: "Активные уведомления",
		cancel: "Отмена",
		saveAlert: "Сохранить",
		chatIdLabel: "Telegram Chat ID",
		alertLabel: "Название (необязательно)",
		chatIdPlaceholder: "напр. 123456789",
		alertLabelPlaceholder: "напр. 2к Нариманов",
		deleteAlert: "Удалить уведомление",
		unnamed: "Без названия",
		alertSaved:
			"Уведомление сохранено! Получите сообщение в Telegram при новых объявлениях.",
		alertDeleted: "Уведомление удалено",
		invalidChatId: "Введите корректный Telegram Chat ID (только цифры)",
		failedAlert: "Не удалось создать уведомление",
		failedDeleteAlert: "Не удалось удалить уведомление",
		botInstruction:
			"Откройте {bot} и отправьте {start}, чтобы получить свой Chat ID.",
		toastRemoved: "Удалено из сохранённых",
		toastSaved: "★ Объявление сохранено",
		toastHidden: "Объявление скрыто",
		toastDeleted: "Объявление навсегда удалено",
		deleteFailed: "Не удалось удалить объявление",
		listingEnded: "Срок объявления истёк, оно удалено.",
		listingEndedBanner: "Срок этого объявления на bina.az истёк.",

		// Units & Labels
		listing: "объявление",
		listings: "объявлений",
		ago: "назад",
		unitMin: "м",
		unitHour: "ч",
		unitDay: "д",
		unitWeek: "н",
		weeksOfData: "{n} недель данных",
		weekOfData: "{n} неделя данных",
		statusLive: "В сети",
		statusDown: "Не в сети",
		allListings: "Общее количество объявлений",

		allLocsPrev: "Все районы",
		belowAvg: "ниже среднего",
		previewRooms: "комн",
		previewArea: "м²",
		previewRepaired: "Ремонт",
		previewDocument: "Документ",
		previewUrgent: "Срочно",
		previewNoActiveMortgage: "Без акт. ипотеки",
		matchingFilters: "Выбранные фильтры",

		avgTrend: "Ср. ₼/м² динамика",

		// District stats
		districtStats: "Статистика по районам",
		districtSubtitle: "{n} района",
		districtCol: "Район",
		districtAvgPpsm: "Ср. ₼/м²",
		districtListings: "Объявл.",
		districtTrend: "Тренд 4н",
		districtLoading: "Загрузка…",
		districtError: "Не удалось загрузить",
		districtEmpty: "Нет данных по районам",
		statsBtn: "Статистика",
		scrapeOps: "Scrape Ops",
		runNow: "Запустить",
		scrapeRuns: "Запуски скрейпера",
		scrapeRunSubtitle: "Последняя активность скрейпера",
		scrapeRunEmpty: "Запусков пока нет",
		scrapeRunLoading: "Загрузка запусков…",
		scrapeRunRunning: "Выполняется…",
		scrapeRunError: "Не удалось загрузить запуски",
		scrapeRunStatus: "Статус",
		scrapeRunTrigger: "Запуск",
		scrapeRunDuration: "Длительность",
		scrapeRunFetched: "Получено",
		scrapeRunPersisted: "Сохранено",
		scrapeRunSkipped: "Пропущено",
		scrapeRunErrors: "Ошибки",
		scrapeRunPlatform: "Платформа",
		scrapeRunStarted: "Начат",
		scrapeRunFinished: "Завершён",
		scrapeRunOptions: "Параметры",
		scrapeAdminPasswordPrompt: "Введите пароль scrape admin",
		scrapeAdminPasswordRequired: "Нужен пароль scrape admin",
		searchDistrict: "Поиск района...",

		// Property detail modal
		viewDetails: "Детали",
		propDetails: "Детали объявления",
		propNoImages: "Нет фотографий",
		propNoDesc: "Описание отсутствует",
		propNoMap: "Местоположение недоступно",
		propDiscount: "Скидка",
		propMarketAvg: "Ср. по рынку",
		propPosted: "Дата",
		propPhotoAlt: "Фото недвижимости {n} из {total}",
		gallery: "Галерея",
		galleryPrev: "Предыдущее фото",
		galleryNext: "Следующее фото",
		galleryExpand: "Развернуть фото",

		// Tiers
		tierHigh: "Выгодная сделка",
		tierGood: "Хорошая цена",
		tierFair: "Средняя цена",
		tierNormal: "Рыночная цена",
		tierOverpriced: "Завышена цена",
		tierHighShort: "Выгодно",
		tierGoodShort: "Хорошо",
		tierFairShort: "Средне",
		tierNormalShort: "Рынок",
		tierOverpricedShort: "Дорого",
		clearFilters: "Сбросить фильтры",
		priceHistory: "История цен",
		tierTipBelow: "На {n}% ниже среднего",
		tierTipAbove: "На {n}% выше среднего",

		// Public preview & auth prompt
		signIn: "Войти",
		signInWithGoogle: "Войти через Google",
		loginRequiredTitle: "Войдите для полного доступа",
		loginRequiredFilter:
			"Войдите, чтобы фильтровать объявления по цене, площади, комнатам, этажу, ипотеке и ключевым словам.",
		loginRequiredSort:
			"Войдите, чтобы сортировать предложения по цене, снижениям, площади или ₼/м².",
		loginRequiredAlerts:
			"Войдите, чтобы настроить мгновенные Telegram-уведомления о новых сделках.",
		loginRequiredMore:
			"Войдите, чтобы просмотреть все {total} объявлений за пределами превью из {limit} объектов.",
		loginRequiredGeneral:
			"Войдите через одобренный аккаунт Google, чтобы открыть расширенные фильтры, сортировку, уведомления и весь каталог.",
		loginBenefitFilters:
			"Фильтры по бюджету, площади, комнатам, этажу, ремонту, ипотеке и словам",
		loginBenefitAll:
			"Все объявления за пределами превью из 50 объектов и сортировка",
		loginBenefitAlerts:
			"Мгновенные Telegram-уведомления при появлении выгодных вариантов",
		loginWhitelistNote: "Закрытый доступ · Только одобренные аккаунты Google",
		continuePreview: "Продолжить просмотр превью",
		previewBannerBadge: "Публичное превью",
		previewBannerText:
			"Выбор района и порог скидки доступны бесплатно — войдите для остальных фильтров, сортировки и уведомлений",
		previewLimitTitle: "Вы просмотрели превью из {limit} объявлений",
		previewLimitSub:
			"Войдите через Google, чтобы открыть все {total} объявлений, расширенные фильтры, сортировку и Telegram-уведомления.",
		backToPreview: "Вернуться к превью",

		// Access management & pending sign-in requests
		accessDialogTitle: "Управление доступом",
		accessDialogDesc:
			"Одобряйте заявки на вход и управляйте белым списком аккаунтов Google.",
		accessRequestsTitle: "Заявки на вход",
		accessRequestsSubtitle:
			"Аккаунты Google не из белого списка, пытавшиеся войти.",
		accessRequestsCount: "{n} ожидают",
		accessRequestsEmpty: "Нет ожидающих заявок на вход.",
		accessRequestsLoading: "Загрузка заявок…",
		accessRequestsLoadError: "Не удалось загрузить заявки",
		accessApprove: "Одобрить",
		accessDismiss: "Отклонить",
		accessApprovedFeedback: "{email} одобрен и добавлен в белый список",
		accessDismissedFeedback: "Заявка от {email} отклонена",
		accessAttemptCount: "{n} попыток",
		whitelistTitle: "Разрешённые аккаунты Google",
		whitelistSubtitle:
			"Доступ к приложению открыт только для адресов из белого списка.",
		whitelistCount: "{n} аккаунтов",
		whitelistEmailPlaceholder: "Google email (напр. user@gmail.com)",
		whitelistNotePlaceholder: "Заметка / имя (необязательно)",
		whitelistAddBtn: "Добавить",
		whitelistLoading: "Загрузка белого списка…",
		whitelistEmpty:
			"Белый список пока пуст. Добавьте адрес выше, чтобы выдать доступ.",
		whitelistLoadError: "Не удалось загрузить белый список",
		whitelistAddedFeedback: "{email} добавлен в белый список",
		whitelistRemovedFeedback: "{email} удалён",
		whitelistConfirmRemove:
			'Удалить "{email}" из белого списка? Доступ будет немедленно отозван.',
		whitelistAddedDate: "Добавлен {date}",
		loginRequestPendingTitle: "Заявка на доступ отправлена",
		loginRequestPendingMsg:
			'Аккаунт Google "{email}" ещё не в белом списке. Ваша заявка сохранена и ожидает одобрения администратора.',
		loginRequestPendingMsgGeneric:
			"Ваш аккаунт Google ещё не в белом списке. Ваша заявка сохранена для одобрения администратором.",
		loginFooterRequestNote:
			"Вас ещё нет в белом списке? Войдите через Google, чтобы отправить заявку администратору.",
	},
} as const;

type TranslationKey = keyof (typeof translations)["en"];

export type { TranslationKey };

function getInitialLang(): Lang {
	const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
	if (saved && (saved === "en" || saved === "az" || saved === "ru")) {
		return saved;
	}

	const browserLang = (
		(navigator.language || "en").split("-")[0] ?? "en"
	).toLowerCase();
	const detected: Lang =
		browserLang === "az" || browserLang === "ru" ? browserLang : "en";

	localStorage.setItem(STORAGE_KEY, detected);
	return detected;
}

const currentLang: Lang = getInitialLang();

export function t(
	key: TranslationKey,
	params?: Record<string, string | number>,
): string {
	let str =
		(translations[currentLang] as Record<string, string>)[key] ??
		translations.en[key];
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replace(new RegExp(`{${k}}`, "g"), String(v));
		}
	}
	return str;
}

export function getLang(): Lang {
	return currentLang;
}

export function setLang(lang: Lang): void {
	if (lang === currentLang) return;
	localStorage.setItem(STORAGE_KEY, lang);
	window.location.reload();
}
