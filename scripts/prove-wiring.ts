// Proof, no API key / no cost: stand up a stub that impersonates the Anthropic
// Messages endpoint, point the SDK at it, and run the REAL scanGate() (not mock).
// Shows: (1) the request actually carries the scan image + manifest as a vision
// message, and (2) scanGate parses the model's JSON into a typed Verdict.
import http from "node:http";
import { renderScan } from "../src/lib/cards";
import type { Manifest } from "../src/lib/domain";

const PORT = 8787;
let sawImage = false;
let imageBytesLen = 0;
let sawManifest = false;

const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", (c) => (body += c));
	req.on("end", () => {
		const payload = JSON.parse(body);
		const content = payload.messages?.[0]?.content ?? [];
		const img = content.find((b: { type: string }) => b.type === "image");
		const txt = content.find((b: { type: string }) => b.type === "text");
		sawImage = !!img?.source?.data;
		imageBytesLen = img?.source?.data ? Buffer.from(img.source.data, "base64").length : 0;
		sawManifest = !!txt?.text?.includes("Marco Reyes");
		console.log("stub received a request to", req.url);
		console.log("  model:", payload.model);
		console.log("  content blocks:", content.map((b: { type: string }) => b.type).join(", "));
		console.log("  image present:", sawImage, "| decoded PNG bytes:", imageBytesLen);
		console.log("  manifest embedded in prompt:", sawManifest);

		// Respond exactly like the real Messages API would, with a verdict.
		const verdict = {
			pass: false,
			confidence: 0.9,
			summary: "Glare hotspot obscures the upper-right of the card face.",
			observedTitle: "Marco Reyes",
			manifestMatches: true,
			issues: [{ type: "glare", severity: "high", detail: "Specular reflection over part of the card." }],
		};
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({
			id: "msg_stub", type: "message", role: "assistant", model: payload.model,
			content: [{ type: "text", text: JSON.stringify(verdict) }],
			stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 },
		}));
	});
});

async function main() {
	await new Promise<void>((r) => server.listen(PORT, r));
	// Point the real SDK at the stub; give it a throwaway key. NOT mock mode.
	process.env.ANTHROPIC_BASE_URL = `http://localhost:${PORT}`;
	process.env.ANTHROPIC_API_KEY = "sk-ant-stub-not-real";
	delete process.env.SCANGATE_MOCK;

	// Import scanGate AFTER env is set.
	const { scanGate } = await import("../src/lib/scangate");
	const manifest: Manifest = { title: "Marco Reyes", cardNumber: "112", year: 1998, set: "Apex Prime", grade: "PSA 9" };
	const png = await renderScan(manifest, "glare");

	const verdict = await scanGate(png, "image/png", manifest, "proof.png");
	console.log("\nscanGate() returned a parsed, schema-valid Verdict:");
	console.log(JSON.stringify(verdict, null, 2));

	const ok = sawImage && imageBytesLen > 1000 && sawManifest && verdict.pass === false && verdict.issues[0].type === "glare";
	console.log("\nPROOF:", ok ? "PASS — real code sent the image + manifest and parsed the verdict" : "FAIL");
	server.close();
	process.exit(ok ? 0 : 1);
}

main();
