import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pool } from "../src/lib/db";
import type { Manifest } from "../src/lib/domain";
import { recordScan, receiveItem } from "../src/lib/repo";
import { scanGate } from "../src/lib/scangate";

// Real inventory: actual card images (your phone photos + a couple Scryfall
// scans), verified by REAL Claude vision. One item deliberately mislabeled to
// prove the gate catches a manifest mismatch.
type Seed = { sku: string; file: string; category: string; manifest: Manifest; note: string };

const DIR = join(process.cwd(), "real-cards");

const SEEDS: Seed[] = [
	{ sku: "MTG-0001", file: "crod_shot1.jpg", category: "Trading Cards", note: "clean", manifest: { title: "Crystal Rod", cardNumber: "n/a", year: 1994, set: "Revised Edition" } },
	{ sku: "MTG-0002", file: "crod_shot5.jpg", category: "Trading Cards", note: "clean", manifest: { title: "Crystal Rod", cardNumber: "n/a", year: 1994, set: "Revised Edition" } },
	{ sku: "MTG-0003", file: "crod_shot4.jpg", category: "Trading Cards", note: "blurry", manifest: { title: "Crystal Rod", cardNumber: "n/a", year: 1994, set: "Revised Edition" } },
	{ sku: "MTG-0004", file: "woh_shot4.jpg", category: "Trading Cards", note: "clean foil", manifest: { title: "Wings of Hope", cardNumber: "289", year: 2000, set: "Invasion", grade: "Foil" } },
	{ sku: "MTG-0005", file: "woh_shot1.jpg", category: "Trading Cards", note: "foil glare", manifest: { title: "Wings of Hope", cardNumber: "289", year: 2000, set: "Invasion", grade: "Foil" } },
	{ sku: "MTG-0006", file: "woh_shot3.jpg", category: "Trading Cards", note: "off-center", manifest: { title: "Wings of Hope", cardNumber: "289", year: 2000, set: "Invasion", grade: "Foil" } },
	{ sku: "MTG-0007", file: "obsianus_golem.png", category: "Trading Cards", note: "clean (catalog)", manifest: { title: "Obsianus Golem", cardNumber: "218", year: 2011, set: "Masters Edition IV" } },
	{ sku: "MTG-0008", file: "brass_herald.png", category: "Trading Cards", note: "clean (catalog)", manifest: { title: "Brass Herald", cardNumber: "301", year: 2020, set: "Commander Legends" } },
	// Deliberate mismatch: the photo is Crystal Rod, the record claims Shivan Dragon.
	{ sku: "MTG-0009", file: "crod_shot2.jpg", category: "Trading Cards", note: "mislabeled -> mismatch", manifest: { title: "Shivan Dragon", cardNumber: "175", year: 1994, set: "Revised Edition" } },
];

const mediaFor = (f: string): "image/png" | "image/jpeg" =>
	extname(f).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

async function backdate(): Promise<void> {
	await pool.query(`
		with r as (select id, (8 + random()*172) recv_min, (4 + random()*36) proc_min from items)
		update items i set
			received_at = now() - (r.recv_min || ' minutes')::interval,
			live_at = case when i.state='live' then now() - (r.recv_min||' minutes')::interval + (r.proc_min||' minutes')::interval else null end,
			scanned_at = case when i.scanned_at is not null then now() - (r.recv_min||' minutes')::interval + '2 minutes'::interval else null end
		from r where r.id = i.id`);
}

async function main(): Promise<void> {
	if (process.env.SCANGATE_MOCK === "1") throw new Error("Refusing to run real seed in SCANGATE_MOCK mode.");
	const model = process.env.QC_MODEL ?? "claude-opus-5";
	console.log(`Real seed: ${SEEDS.length} card images through Claude vision (${model})`);
	await pool.query("truncate items restart identity cascade");

	for (const s of SEEDS) {
		const bytes = await readFile(join(DIR, s.file));
		const media = mediaFor(s.file);
		const item = await receiveItem({ sku: s.sku, title: s.manifest.title, category: s.category, manifest: s.manifest });
		const verdict = await scanGate(bytes, media, s.manifest, s.file);
		const out = await recordScan(item.id, s.file, verdict, { bytes, type: media }, "scangate");
		console.log(`  ${s.sku} ${s.note.padEnd(22)} -> ${out.state.padEnd(9)} ${verdict.pass ? "PASS" : "FAIL"} (${verdict.issues.map((i) => i.type).join(",") || "clean"}) — ${verdict.summary}`);
	}

	await backdate();
	console.log("Done.");
	await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
