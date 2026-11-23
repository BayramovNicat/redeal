import { ScrapingService } from "../src/modules/scrape/scrape.service";
import { BinaScraper } from "../src/scrapers/bina.scraper";
import { prisma } from "../src/utils/prisma";

try {
	const service = new ScrapingService([new BinaScraper()]);

	console.log("--- Starting Rent Scraper (300 pages) ---");
	const rentResults = await service.runAll({
		maxPages: 300,
		delayMs: 800,
		listingType: "rent",
	});
	console.log("Rent Scraper Completed:");
	console.log(JSON.stringify(rentResults, null, 2));

	console.log("--- Starting Sale Scraper (300 pages) ---");
	const saleResults = await service.runAll({
		maxPages: 300,
		delayMs: 800,
		listingType: "sale",
	});
	console.log("Sale Scraper Completed:");
	console.log(JSON.stringify(saleResults, null, 2));
} finally {
	await prisma.$disconnect();
}
