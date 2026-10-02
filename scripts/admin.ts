import {
	getAdmins,
	setAdminRole,
} from "../src/modules/auth/auth.service.js";
import { prisma } from "../src/utils/prisma.js";

const [action, email] = process.argv.slice(2);

function usage() {
	console.log(`
Redeal Admin Management CLI

Usage:
  bun scripts/admin.ts grant <email>   # Grant admin access to a user
  bun scripts/admin.ts revoke <email>  # Revoke admin access from a user
  bun scripts/admin.ts list            # List all current admins
  bun scripts/admin.ts check <email>   # Check admin status of an email

Examples:
  bun scripts/admin.ts grant john@gmail.com
  bun scripts/admin.ts revoke john@gmail.com
  bun scripts/admin.ts list
`);
}

async function main() {
	if (!action || action === "help" || action === "--help") {
		usage();
		process.exit(0);
	}

	switch (action.toLowerCase()) {
		case "grant": {
			if (!email?.includes("@")) {
				console.error("Error: Please provide a valid email address.");
				process.exit(1);
			}
			const result = await setAdminRole(email, true);
			const details: string[] = [];
			if (result.userUpdated) details.push("existing user account updated");
			if (result.whitelistUpdated) details.push("whitelisted as admin");
			console.log(
				`✓ Granted admin access to ${email.toLowerCase().trim()} (${details.join(", ")})`,
			);
			break;
		}

		case "revoke": {
			if (!email?.includes("@")) {
				console.error("Error: Please provide a valid email address.");
				process.exit(1);
			}
			const result = await setAdminRole(email, false);
			const details: string[] = [];
			if (result.userUpdated) details.push("user demoted to regular user");
			if (result.whitelistUpdated) details.push("whitelist set to regular user");
			console.log(
				`✓ Revoked admin access from ${email.toLowerCase().trim()} (${details.join(", ")})`,
			);
			break;
		}

		case "list": {
			const { users, preapproved } = await getAdmins();
			console.log("\n=== Active Admin Users ===");
			if (users.length === 0) {
				console.log("No registered users have admin role.");
			} else {
				for (const u of users) {
					console.log(`  • ${u.email} (${u.name ?? "No Name"})`);
				}
			}

			console.log("\n=== Pre-Approved Admin Emails in Whitelist ===");
			if (preapproved.length === 0) {
				console.log("No pre-approved admin emails found.");
			} else {
				for (const p of preapproved) {
					console.log(`  • ${p.email}${p.note ? ` (${p.note})` : ""}`);
				}
			}
			console.log("");
			break;
		}

		case "check": {
			if (!email?.includes("@")) {
				console.error("Error: Please provide a valid email address.");
				process.exit(1);
			}
			const normalized = email.toLowerCase().trim();
			const user = await prisma.user.findUnique({
				where: { email: normalized },
			});
			const whitelist = await prisma.whitelistedEmail.findUnique({
				where: { email: normalized },
			});

			const isAdmin = user?.role === "admin" || whitelist?.role === "admin";
			if (isAdmin) {
				console.log(`✓ ${normalized} HAS admin access.`);
				if (user) console.log(`  User account role: ${user.role}`);
				if (whitelist) console.log(`  Whitelist role: ${whitelist.role}`);
			} else {
				console.log(`✗ ${normalized} does NOT have admin access.`);
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
