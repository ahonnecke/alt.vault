// Generates the portfolio tile / README hero image (no browser needed).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const W = 1200;
const H = 750;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#0a0b0e"/>
			<stop offset="100%" stop-color="#0f1620"/>
		</linearGradient>
		<radialGradient id="glow" cx="82%" cy="8%" r="55%">
			<stop offset="0%" stop-color="#10b981" stop-opacity="0.18"/>
			<stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
		</radialGradient>
	</defs>
	<rect width="${W}" height="${H}" fill="url(#bg)"/>
	<rect width="${W}" height="${H}" fill="url(#glow)"/>

	<text x="80" y="150" font-family="Georgia, serif" font-size="72" font-weight="700" fill="#f4f4f5">Alt Vault</text>
	<text x="84" y="196" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#9aa4b2">Vault-as-a-Service · event-sourced intake spine</text>

	<!-- metric -->
	<g transform="translate(80 250)">
		<rect x="0" y="0" width="300" height="140" rx="16" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.10"/>
		<text x="24" y="40" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#8b93a1" letter-spacing="1">MEDIAN TIME-TO-LIVE</text>
		<text x="24" y="106" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#34d399">9.2m</text>
	</g>

	<!-- artifact pills -->
	<g transform="translate(80 430)" font-family="Helvetica, Arial, sans-serif">
		<rect x="0" y="0" width="470" height="88" rx="14" fill="#10b981" fill-opacity="0.10" stroke="#10b981" stroke-opacity="0.4"/>
		<text x="24" y="38" font-size="24" font-weight="700" fill="#a7f3d0">ScanGate</text>
		<text x="24" y="68" font-size="18" fill="#b6c2cf">Claude vision QC — glare · blur · skew · manifest mismatch</text>

		<rect x="0" y="104" width="470" height="88" rx="14" fill="#38bdf8" fill-opacity="0.10" stroke="#38bdf8" stroke-opacity="0.4"/>
		<text x="24" y="142" font-size="24" font-weight="700" fill="#bae6fd">VaultTrace</text>
		<text x="24" y="172" font-size="18" fill="#b6c2cf">MCP server — "where is this item, and what happened to it?"</text>
	</g>

	<!-- mini card mock (right) -->
	<g transform="translate(760 250) rotate(-6)">
		<rect x="0" y="0" width="330" height="440" rx="22" fill="#fbfbf7" stroke="#6d28d9" stroke-width="12"/>
		<rect x="26" y="26" width="278" height="52" rx="8" fill="#6d28d9"/>
		<text x="165" y="62" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">Marco Reyes</text>
		<rect x="26" y="96" width="278" height="200" rx="10" fill="#c4b5fd"/>
		<text x="40" y="342" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#222">#112</text>
		<text x="40" y="376" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="#555">Apex Prime · 1998</text>
		<rect x="214" y="322" width="90" height="58" rx="9" fill="#111"/>
		<text x="259" y="360" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">PSA 9</text>
	</g>
	<g transform="translate(1006 300)">
		<circle cx="0" cy="0" r="30" fill="#10b981"/>
		<path d="M -13 0 L -4 10 L 14 -11" stroke="#0a0b0e" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
	</g>

	<text x="80" y="700" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#6b7280">Next.js · TypeScript · Postgres (event-sourced) · Claude vision · Model Context Protocol</text>
</svg>`;

async function main(): Promise<void> {
	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	const docs = join(process.cwd(), "docs");
	await mkdir(docs, { recursive: true });
	await writeFile(join(docs, "tile.png"), png);
	console.log("Wrote docs/tile.png");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
