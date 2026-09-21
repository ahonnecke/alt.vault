import sharp from "sharp";
import type { Manifest } from "./domain";

export type Variant = "clean" | "glare" | "blur" | "rotate" | "mismatch";

const W = 720;
const H = 960;
// Card placed on a neutral "scan bed" with margin so rotate/offset have room.
const CARD_W = 460;
const CARD_H = 660;

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hashHue(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
	return h;
}

function cardGroup(m: Manifest): string {
	const hue = hashHue(m.set + m.title);
	const border = `hsl(${hue} 55% 42%)`;
	const art = `hsl(${(hue + 40) % 360} 45% 78%)`;
	const grade = m.grade ?? "RAW";
	return `
	<g>
		<rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="26"
		      fill="#fbfbf7" stroke="${border}" stroke-width="14"/>
		<rect x="34" y="34" width="${CARD_W - 68}" height="70" rx="8" fill="${border}"/>
		<text x="${CARD_W / 2}" y="82" font-family="Georgia, serif" font-size="34"
		      font-weight="700" fill="#fff" text-anchor="middle">${esc(m.title)}</text>
		<rect x="34" y="126" width="${CARD_W - 68}" height="300" rx="10" fill="${art}"/>
		<text x="${CARD_W / 2}" y="290" font-family="Georgia, serif" font-size="26"
		      fill="#444" text-anchor="middle" opacity="0.55">${esc(m.set)}</text>
		<text x="42" y="474" font-family="Helvetica, sans-serif" font-size="30"
		      fill="#222">#${esc(m.cardNumber)}</text>
		<text x="42" y="520" font-family="Helvetica, sans-serif" font-size="26"
		      fill="#555">${esc(m.set)} · ${m.year}</text>
		<rect x="${CARD_W - 150}" y="452" width="116" height="76" rx="10"
		      fill="#111"/>
		<text x="${CARD_W - 92}" y="500" font-family="Helvetica, sans-serif"
		      font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${esc(grade)}</text>
		<text x="${CARD_W / 2}" y="612" font-family="Georgia, serif" font-size="20"
		      fill="#888" text-anchor="middle" opacity="0.7">ALT VAULT · authenticated</text>
	</g>`;
}

function frameSvg(m: Manifest, v: Variant): string {
	const rotate = v === "rotate" ? -8 : 0;
	const dx = v === "rotate" ? 70 : (W - CARD_W) / 2;
	const dy = v === "rotate" ? 60 : (H - CARD_H) / 2;
	const glare =
		v === "glare"
			? `<ellipse cx="500" cy="300" rx="230" ry="170" fill="url(#g)"/>`
			: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
		<defs>
			<radialGradient id="g" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
				<stop offset="55%" stop-color="#ffffff" stop-opacity="0.5"/>
				<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
			</radialGradient>
		</defs>
		<rect width="${W}" height="${H}" fill="#e9e7e0"/>
		<g transform="translate(${dx} ${dy}) rotate(${rotate} ${CARD_W / 2} ${CARD_H / 2})">
			${cardGroup(m)}
		</g>
		${glare}
	</svg>`;
}

/** Render one scan variant as a PNG buffer. `mismatch` renders a different card. */
export async function renderScan(m: Manifest, v: Variant): Promise<Buffer> {
	const manifest: Manifest =
		v === "mismatch"
			? { ...m, title: "Wrong Player", cardNumber: "999", set: "Mismatched Set" }
			: m;
	let img = sharp(Buffer.from(frameSvg(manifest, v)));
	if (v === "blur") img = img.blur(7);
	return img.png().toBuffer();
}
