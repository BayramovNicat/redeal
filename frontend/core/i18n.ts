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
		priceMap: "Price Map",
		priceMapTitle: "Price heatmap by district",
		discountThreshold: "Discount threshold",
		advancedFilters: "Advanced filters",
		search: "Search",

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
		activeMortgage: "Active mortgage",
		any: "Any",
		newBuild: "New build",
		secondary: "Secondary",
		no: "No",
		yes: "Yes",

		// Description search
		descriptionSearch: "Description keyword",
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
		botInstruction: "Open {bot} and send {start} to get your Chat ID.",
		toastRemoved: "Removed from saved",
		toastSaved: "★ Deal saved",
		toastHidden: "Item hidden",

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
	},

	az: {
		appName: "Redeal",
		appTagline: "Bakı bazarında ucuz əmlak axtarıcısı",

		priceMap: "Qiymət xəritəsi",
		priceMapTitle: "Rayonlar üzrə qiymət xəritəsi",

		location: "Ərazi",
		chooseLocs: "Ərazi seçin...",
		allLocations: "Bütün ərazilər",
		all: "Hamısı",
		failedLocs: "Ərazilər yüklənmədi",
		discountThreshold: "Endirim həddi",
		advancedFilters: "Ətraflı filtrlər",
		search: "Axtar",

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
		activeMortgage: "Aktiv ipoteka",
		any: "Hər hansı",
		newBuild: "Yeni tikili",
		secondary: "Köhnə tikili",
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
		botInstruction: "{bot} açın və Chat ID almaq üçün {start} göndərin.",
		toastRemoved: "Saxlanılanlardan silindi",
		toastSaved: "★ Elan saxlanıldı",
		toastHidden: "Elan gizlədildi",

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
	},

	ru: {
		appName: "Redeal",
		appTagline: "Поиск недооцененной недвижимости в Баку",

		priceMap: "Карта цен",
		priceMapTitle: "Тепловая карта цен по районам",

		location: "Район",
		chooseLocs: "Выберите район...",
		allLocations: "Все районы",
		all: "Все",
		failedLocs: "Не удалось загрузить районы",
		discountThreshold: "Порог скидки",
		advancedFilters: "Расширенные фильтры",
		search: "Поиск",

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
		activeMortgage: "Активная ипотека",
		any: "Любой",
		newBuild: "Новостройка",
		secondary: "Вторичный рынок",
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
		botInstruction:
			"Откройте {bot} и отправьте {start}, чтобы получить свой Chat ID.",
		toastRemoved: "Удалено из сохранённых",
		toastSaved: "★ Объявление сохранено",
		toastHidden: "Объявление скрыто",

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
	},
} as const;

type TranslationKey = keyof (typeof translations)["en"];

export type { TranslationKey };

function getInitialLang(): Lang {
	const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
	if (saved && (saved === "en" || saved === "az" || saved === "ru")) {
		return saved;
	}

	const browserLang = (navigator.language || "en").split("-")[0].toLowerCase();
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
