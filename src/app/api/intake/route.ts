import { NextResponse } from "next/server";
import type { Variant } from "@/lib/cards";
import { simulateIntake } from "@/lib/intake";

export const dynamic = "force-dynamic";

// Live demo hook: intake a fresh item, render a scan, run it through ScanGate,
// and record the result. Body: { variant?: "clean"|"glare"|"blur"|"rotate"|"mismatch" }.
export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as { variant?: Variant };
	try {
		const out = await simulateIntake(body.variant);
		return NextResponse.json(out);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "intake failed" },
			{ status: 500 },
		);
	}
}
