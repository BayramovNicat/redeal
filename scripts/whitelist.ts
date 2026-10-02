import {
	addWhitelistedEmail,
	getWhitelistedEmails,
	isEmailWhitelisted,
	removeWhitelistedEmail,
} from "../src/modules/auth/auth.service.js";

const [action, email, ...rest] = process.argv.slice(2);
const note = rest.join(" ");

function usage() {
	console.log(`
Redeal Whitelist CLI

Usage:
  bun scripts/whitelist.ts list
  bun scripts/whitelist.ts add <email> [optional note]
  bun scripts/whitelist.ts remove <email>
  bun scripts/whitelist.ts check <email>

Examples:
  bun scripts/whitelist.ts add john@gmail.com "Primary Admin"
  bun scripts/whitelist.ts list
  bun scripts/whitelist.ts remove john@gmail.com
`);
}

async function main() {
	if (!action || action === "help" || action === "--help") {
		usage();
		process.exit(0);
	}

	switch (action.toLowerCase()) {
		case "list": {
			const emails = await getWhitelistedEmails();
			if (emails.length === 0) {
				console.log("No whitelisted emails found in the database.");
			} else {
				console.log(`Whitelisted emails (${emails.length}):`);
				for (const item of emails) {
					const notePart = item.note ? ` (${item.note})` : "";
					const date = new Date(item.created_at).toISOString().split("T")[0];
					console.log(`  - ${item.email}${notePart} [added: ${date}]`);
				}
			}
			break;
		}

		case "add": {
			if (!email?.includes("@")) {
				console.error("Error: Please provide a valid email address.");
				process.exit(1);
			}
			const result = await addWhitelistedEmail(email, note || undefined);
			console.log(
				`✓ Added to whitelist: ${result.email}${note ? ` (${note})` : ""}`,
			);
			break;
		}

		case "remove":
		case "del":
		case "rm": {
			if (!email) {
				console.error("Error: Please provide an email to remove.");
				process.exit(1);
			}
			const removed = await removeWhitelistedEmail(email);
			if (removed) {
				console.log(`✓ Removed from whitelist: ${email.toLowerCase()}`);
			} else {
				console.log(`Email ${email.toLowerCase()} was not in whitelist.`);
			}
			break;
		}

		case "check": {
			if (!email) {
				console.error("Error: Please provide an email to check.");
				process.exit(1);
			}
			const exists = await isEmailWhitelisted(email);
			if (exists) {
				console.log(`✓ ${email.toLowerCase()} is whitelisted.`);
			} else {
				console.log(`✗ ${email.toLowerCase()} is NOT whitelisted.`);
			}
			break;
		}

		default: {
			console.error(`Unknown action: "${action}"`);
			usage();
			process.exit(1);
		}
	}
}

await main();
process.exit(0);
