import { type NextRequest, NextResponse } from "next/server";
import type { ItemState } from "@/lib/domain";
import { listItems } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const state = req.nextUrl.searchParams.get("state") as ItemState | null;
	return NextResponse.json(await listItems(state ?? undefined));
}
