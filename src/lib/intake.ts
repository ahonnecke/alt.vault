import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderScan, type Variant } from "./cards";
import type { Item, Manifest, Verdict } from "./domain";
import { recordScan, receiveItem } from "./repo";
import { scanGate } from "./scangate";

const SCAN_DIR = join(process.cwd(), "public", "scans");

const NAMES = [
	"Ravi Okafor", "Mika Sorenson", "Diego Salas", "Nora Whitfield",
	"Kenji Alvarez", "Fatima Reyes", "Elias Brandt", "Sana Iqbal",
	"Tobias Klein", "Amara Osei", "Vince Marino", "Halla Bjornsson",
];
const SETS = ["Apex Prime", "Zenith", "Cornerstone", "Momentum", "Vanguard", "Eclipse"];
const GRADES = ["PSA 9", "PSA 10", "BGS 9", "BGS 9.5", "SGC 8", "RAW"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const VARIANTS: Variant[] = ["clean", "clean", "clean", "glare", "blur", "rotate", "mismatch"];

/** Generate a fresh item, render + gate its scan, and record the result. */
export async function simulateIntake(variant?: Variant): Promise<{ item: Item; verdict: Verdict }> {
	const v = variant ?? pick(VARIANTS);
	const n = Date.now().toString(36).slice(-5).toUpperCase();
	const manifest: Manifest = {
		title: pick(NAMES),
		cardNumber: String(Math.floor(Math.random() * 400) + 1),
		year: 1988 + Math.floor(Math.random() * 37),
		set: pick(SETS),
		grade: pick(GRADES),
	};
	const sku = `TC-${n}`;

	await mkdir(SCAN_DIR, { recursive: true });
	const png = await renderScan(manifest, v);
	const file = `${sku}__${v}.png`;
	await writeFile(join(SCAN_DIR, file), png);
	const scanPath = `scans/${file}`;

	const item = await receiveItem({ sku, title: manifest.title, category: "Trading Cards", manifest });
	const verdict = await scanGate(png, "image/png", manifest, scanPath);
	const recorded = await recordScan(item.id, scanPath, verdict);
	return { item: recorded, verdict };
}
