import { config } from "dotenv";
config({ path: ".env.local" });

import { pool } from "../src/lib/db";
import type { Manifest } from "../src/lib/domain";
import { recordScan, receiveItem } from "../src/lib/repo";
import { scanGate } from "../src/lib/scangate";
import { renderScan, type Variant } from "../src/lib/cards";

type Seed = {
	sku: string;
	category: string;
	manifest: Manifest;
	variant: Variant;
};

// Fictional cards/items — enough to make the pipeline, metric, and exception
// queue tell a story. ~2/3 clean (go live), the rest scripted defects.
const SEEDS: Seed[] = [
	{ sku: "TC-0001", category: "Trading Cards", variant: "clean", manifest: { title: "Marco Reyes", cardNumber: "112", year: 1998, set: "Apex Prime", grade: "PSA 9" } },
	{ sku: "TC-0002", category: "Trading Cards", variant: "clean", manifest: { title: "Dana Whitlock", cardNumber: "07", year: 2003, set: "Zenith Rookies", grade: "PSA 10" } },
	{ sku: "TC-0003", category: "Trading Cards", variant: "glare", manifest: { title: "Isaiah Bloom", cardNumber: "244", year: 1991, set: "Cornerstone", grade: "BGS 8.5" } },
	{ sku: "TC-0004", category: "Trading Cards", variant: "clean", manifest: { title: "Priya Anand", cardNumber: "58", year: 2015, set: "Momentum", grade: "PSA 9" } },
	{ sku: "TC-0005", category: "Trading Cards", variant: "mismatch", manifest: { title: "Cole Vasquez", cardNumber: "301", year: 1989, set: "Heritage", grade: "RAW" } },
	{ sku: "TC-0006", category: "Trading Cards", variant: "clean", manifest: { title: "Greta Lindqvist", cardNumber: "19", year: 2020, set: "Vanguard", grade: "PSA 10" } },
	{ sku: "TC-0007", category: "Trading Cards", variant: "blur", manifest: { title: "Theo Nakamura", cardNumber: "77", year: 2001, set: "Eclipse", grade: "BGS 9" } },
	{ sku: "TC-0008", category: "Trading Cards", variant: "clean", manifest: { title: "Samira Okoro", cardNumber: "163", year: 2011, set: "Pinnacle", grade: "PSA 9" } },
	{ sku: "TC-0009", category: "Trading Cards", variant: "rotate", manifest: { title: "Bennett Crowe", cardNumber: "45", year: 1996, set: "Ironclad", grade: "SGC 8" } },
	{ sku: "TC-0010", category: "Trading Cards", variant: "clean", manifest: { title: "Lucia Ferrari", cardNumber: "88", year: 2018, set: "Momentum", grade: "PSA 10" } },
	{ sku: "TC-0011", category: "Trading Cards", variant: "mismatch", manifest: { title: "Omar Haddad", cardNumber: "210", year: 1994, set: "Cornerstone", grade: "BGS 9.5" } },
	{ sku: "WX-0001", category: "Sealed Wax", variant: "clean", manifest: { title: "Apex Prime Booster Box", cardNumber: "BOX-98", year: 1998, set: "Apex Prime", grade: "SEALED" } },
	{ sku: "WX-0002", category: "Sealed Wax", variant: "glare", manifest: { title: "Zenith Hobby Box", cardNumber: "BOX-03", year: 2003, set: "Zenith", grade: "SEALED" } },
	{ sku: "WT-0001", category: "Watches", variant: "clean", manifest: { title: "Meridian Chronograph", cardNumber: "SN-4471", year: 2019, set: "Meridian", grade: "MINT" } },
];

async function reset(): Promise<void> {
	await pool.query("truncate items restart identity cascade");
}

/** Backdate timestamps so the time-to-live metric has a realistic spread. */
async function backdate(): Promise<void> {
	// Received 8..180 min ago; live items processed 4..40 min after receipt.
	await pool.query(`
		with r as (
			select id, (8 + random() * 172) as recv_min,
			       (4 + random() * 36) as proc_min
			from items
		)
		update items i set
			received_at = now() - (r.recv_min || ' minutes')::interval,
			live_at = case when i.state = 'live'
				then now() - (r.recv_min || ' minutes')::interval + (r.proc_min || ' minutes')::interval
				else null end,
			scanned_at = case when i.scanned_at is not null
				then now() - (r.recv_min || ' minutes')::interval + '2 minutes'::interval
				else null end
		from r where r.id = i.id
	`);
}

async function main(): Promise<void> {
	const mock = process.env.SCANGATE_MOCK === "1";
	console.log(`Seeding ${SEEDS.length} items — ScanGate mode: ${mock ? "MOCK ($0)" : "CLAUDE VISION"}`);
	await reset();

	for (const s of SEEDS) {
		const png = await renderScan(s.manifest, s.variant);
		const scanPath = `${s.sku}__${s.variant}.png`;

		const item = await receiveItem({
			sku: s.sku,
			title: s.manifest.title,
			category: s.category,
			manifest: s.manifest,
		});
		const verdict = await scanGate(png, "image/png", s.manifest, scanPath);
		const out = await recordScan(item.id, scanPath, verdict, { bytes: png, type: "image/png" });
		console.log(
			`  ${s.sku.padEnd(9)} ${s.variant.padEnd(9)} -> ${out.state.padEnd(9)} ${verdict.pass ? "PASS" : "FAIL"} (${verdict.issues.map((i) => i.type).join(",") || "clean"})`,
		);
	}

	await backdate();
	console.log("Done. Backdated timestamps for a realistic time-to-live spread.");
	await pool.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
