import Anthropic from "@anthropic-ai/sdk";
import { type Manifest, type Verdict, VerdictSchema } from "./domain";

const QC_MODEL = process.env.QC_MODEL ?? "claude-opus-5";

const SYSTEM = `You are ScanGate, the automated quality-control gate on a trading-card
vault's imaging line. Each item is photographed before it goes live for sale. You
inspect one scan against the item's manifest (the expected truth recorded at intake)
and decide whether the image is good enough to publish.

Fail the scan for any of these defects:
- glare: a bright hotspot or reflection obscuring part of the card
- misalignment: the card is rotated or badly off-center in the frame
- blur: the card is out of focus / not sharp enough to read
- label_mismatch: the card visible in the scan is NOT the card described by the
  manifest (wrong title, number, year, or set). This is the highest-severity defect
  because it means someone's asset is about to be mis-recorded.

Be strict but fair: minor issues that don't stop a customer from verifying the card
are severity "low" and can still pass. Anything that would make a customer complain,
or a manifest mismatch, must fail.`;

function buildPrompt(manifest: Manifest): string {
	return `Manifest (expected truth for this item):
${JSON.stringify(manifest, null, 2)}

Inspect the attached scan. Respond with ONLY a JSON object, no markdown fences, no
prose, matching exactly this shape:

{
  "pass": boolean,               // true only if the scan is fit to publish
  "confidence": number,          // 0..1
  "summary": string,             // one sentence for an operator
  "observedTitle": string|null,  // the card title you actually read in the image
  "manifestMatches": boolean,    // does the visible card match the manifest?
  "issues": [                    // one entry per defect found; [] if clean
    { "type": "glare"|"misalignment"|"blur"|"label_mismatch"|"other",
      "severity": "low"|"medium"|"high",
      "detail": string }
  ]
}`;
}

function extractJson(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1) throw new Error("no JSON object in response");
	return JSON.parse(text.slice(start, end + 1));
}

/** Mock gate: derives a verdict from a degradation tag baked into the filename
 * (e.g. `..__glare.png`). Lets the pipeline run at $0 with no API calls. */
export function mockVerdict(scanPath: string, manifest: Manifest): Verdict {
	const tag = scanPath.match(/__([a-z_]+)\.png$/)?.[1] ?? "clean";
	const base = { observedTitle: manifest.title, manifestMatches: true };
	switch (tag) {
		case "glare":
			return { pass: false, confidence: 0.9, summary: "Glare hotspot obscures the top-right corner.", ...base, issues: [{ type: "glare", severity: "high", detail: "Specular reflection over part of the card face." }] };
		case "blur":
			return { pass: false, confidence: 0.88, summary: "Image is out of focus; text is not legible.", ...base, issues: [{ type: "blur", severity: "high", detail: "Card is not sharp enough to verify condition." }] };
		case "rotate":
			return { pass: false, confidence: 0.85, summary: "Card is rotated and off-center in the frame.", ...base, issues: [{ type: "misalignment", severity: "medium", detail: "Card skewed ~8 degrees; edges cropped." }] };
		case "mismatch":
			return { pass: false, confidence: 0.93, summary: "Scanned card does not match the manifest title.", observedTitle: "UNKNOWN / different card", manifestMatches: false, issues: [{ type: "label_mismatch", severity: "high", detail: "Visible card differs from the manifest — possible mis-pull." }] };
		default:
			return { pass: true, confidence: 0.96, summary: "Clean, sharp, centered scan matching the manifest.", ...base, issues: [] };
	}
}

/**
 * Run the QC gate on one scan. Uses Claude vision unless SCANGATE_MOCK=1.
 * @param image  raw scan bytes
 * @param mediaType  e.g. "image/png"
 */
export async function scanGate(
	image: Buffer,
	mediaType: "image/png" | "image/jpeg" | "image/webp",
	manifest: Manifest,
	scanPath = "",
): Promise<Verdict> {
	if (process.env.SCANGATE_MOCK === "1") return mockVerdict(scanPath, manifest);

	const client = new Anthropic();
	const runOnce = async (): Promise<Verdict> => {
		const res = await client.messages.create({
			model: QC_MODEL,
			max_tokens: 1500,
			output_config: { effort: "low" },
			system: SYSTEM,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: mediaType,
								data: image.toString("base64"),
							},
						},
						{ type: "text", text: buildPrompt(manifest) },
					],
				},
			],
		});
		const text = res.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("\n");
		return VerdictSchema.parse(extractJson(text));
	};

	try {
		return await runOnce();
	} catch {
		// One retry — models occasionally wrap JSON or clip it.
		return await runOnce();
	}
}
