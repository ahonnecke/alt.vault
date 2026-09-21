import { z } from "zod";

// ---- Manifest: the expected truth about an item, recorded at intake. --------
export const ManifestSchema = z.object({
	title: z.string(),
	cardNumber: z.string(),
	year: z.number().int(),
	set: z.string(),
	grade: z.string().optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

// ---- ScanGate verdict: what Claude vision reports about one scan. -----------
export const IssueSchema = z.object({
	type: z.enum(["glare", "misalignment", "blur", "label_mismatch", "other"]),
	severity: z.enum(["low", "medium", "high"]),
	detail: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const VerdictSchema = z.object({
	pass: z.boolean(),
	confidence: z.number().min(0).max(1),
	summary: z.string(),
	observedTitle: z.string().nullable(),
	manifestMatches: z.boolean(),
	issues: z.array(IssueSchema),
});
export type Verdict = z.infer<typeof VerdictSchema>;

// ---- Events: the append-only log. ------------------------------------------
export const EVENT_TYPES = [
	"received",
	"scanned",
	"qc_passed",
	"qc_failed",
	"went_live",
	"qc_override",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type ItemState = "received" | "scanned" | "exception" | "live";

export interface VaultEvent {
	seq: number;
	itemId: string;
	type: EventType;
	data: Record<string, unknown>;
	actor: string;
	createdAt: string;
}

export interface Item {
	id: string;
	sku: string;
	title: string;
	category: string;
	manifest: Manifest;
	state: ItemState;
	receivedAt: string;
	scannedAt: string | null;
	liveAt: string | null;
	lastVerdict: Verdict | null;
	scanPath: string | null;
	updatedAt: string;
}

/** Minutes an item took from received -> live, or null if not yet live. */
export function timeToLiveMinutes(item: Item): number | null {
	if (!item.liveAt) return null;
	return (
		(new Date(item.liveAt).getTime() - new Date(item.receivedAt).getTime()) /
		60000
	);
}
