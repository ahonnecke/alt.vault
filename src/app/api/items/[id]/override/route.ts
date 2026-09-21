import { NextResponse } from "next/server";
import { overrideLive } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const body = (await req.json().catch(() => ({}))) as { reason?: string };
	const item = await overrideLive(id, body.reason ?? "manual override");
	return NextResponse.json(item);
}
