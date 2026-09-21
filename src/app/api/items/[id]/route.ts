import { NextResponse } from "next/server";
import { getEvents, getItem } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const item = await getItem(id);
	if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
	const events = await getEvents(id);
	return NextResponse.json({ item, events });
}
