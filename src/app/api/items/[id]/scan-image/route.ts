import { getScanImage } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const img = await getScanImage(id);
	if (!img) return new Response("no scan", { status: 404 });
	return new Response(new Uint8Array(img.bytes), {
		headers: { "content-type": img.type, "cache-control": "no-store" },
	});
}
