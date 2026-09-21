import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json(await getMetrics());
}
