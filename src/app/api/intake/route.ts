import { NextResponse } from "next/server";
import type { Variant } from "@/lib/cards";
import { simulateIntake } from "@/lib/intake";
import { listItems } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Bound cost/growth on the public demo: each intake runs a (paid) Claude vision
// call, so cap total items. Reset by re-seeding.
const ITEM_CAP = Number(process.env.INTAKE_CAP ?? 45);

// Live demo hook: intake a fresh item, render a scan, run it through ScanGate,
// and record the result. Body: { variant?: "clean"|"glare"|"blur"|"rotate"|"mismatch" }.
export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as { variant?: Variant };
	try {
		const count = (await listItems()).length;
		if (count >= ITEM_CAP) {
			return NextResponse.json(
				{ error: `Demo cap reached (${ITEM_CAP} items). Reset by re-seeding.` },
				{ status: 429 },
			);
		}
		const out = await simulateIntake(body.variant);
		return NextResponse.json(out);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "intake failed" },
			{ status: 500 },
		);
	}
}
