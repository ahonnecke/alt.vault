import { type NextRequest, NextResponse } from "next/server";
import { resolveTrace } from "@/lib/trace";

export const dynamic = "force-dynamic";

// The web (human) door onto the vault-trace service. The MCP server is the
// agent door onto the same resolveTrace().
export async function GET(req: NextRequest) {
	const q = req.nextUrl.searchParams.get("q")?.trim();
	if (!q) return NextResponse.json({ found: false, query: "" });
	return NextResponse.json(await resolveTrace(q));
}
