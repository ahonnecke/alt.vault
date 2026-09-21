# Alt Vault — intake spine (portfolio demo)

## Goal
A portfolio showpiece targeting Alt's "Senior Software Engineer, Vault" role. The JD
says **"name the artifact, not the tool."** So this repo ships two concrete, demoable
artifacts on one event-sourced core, mirroring the founding-engineer thesis: drive down
*time from item received to live on platform*.

Constraint: **spend no money.** Local-first; free-tier deploy only. Claude vision at
demo scale (pennies) is the one paid dependency, chosen deliberately.

Deliverable: this app + a tile/detail entry in `~/src/portfolio` (AI category), linking
the live demo and repo.

## Arc
1. **Event-sourced core** — items + an append-only event log; every state transition
   (`received → scanned → qc_passed | qc_failed → live`) is an appended event. Storage
   behind a thin interface (local Postgres for dev; free-tier hosted DB later).
2. **ScanGate** (their bullet #1) — vision-QC intake gate. Scan uploaded → Claude vision
   checks it against the manifest (glare / misalignment / blur / label mismatch) → pass
   goes live, fail → exception queue. Emits events.
3. **Dashboard** — live *time-to-live* metric + exception queue, computed off the event
   log. Full-stack surface, sharp UI (their "full stack, not half of it").
4. **VaultTrace** (their bullet #5) — MCP server (stdio) over inventory + event log, so
   "where is item X and what happened to it" is one sentence. Demoable in Claude Code.
5. **Seed** — synthetic cards + scripted bad scans (rotate / glare / swapped label) so
   the gate has real positives.
6. **Ship** — free-tier deploy + portfolio tile/detail.

## State (2026-09-21)
Built and proven end-to-end (local, $0 mock gate):
- Event-sourced core (`db/schema.sql`, `src/lib/repo.ts`): append-only log + item
  projection + metrics. Verified via seed + API.
- **ScanGate** (`src/lib/scangate.ts`): Claude vision QC gate, real + `SCANGATE_MOCK`
  paths. Real path is written and typechecked but NOT yet exercised against the live
  model — no ANTHROPIC key in this environment (the one open human step).
- **VaultTrace** (`mcp/server.ts`): MCP server, 4 tools, verified with a real MCP
  client handshake (`mcp/smoke.ts`).
- Dashboard (`src/app/page.tsx`): live metrics, intake simulator, inventory +
  exception queue, chain-of-custody. Screenshot captured; `docs/tile.png` generated.
- README written. Build green. Postgres on docker host port 5434.

## NEXT
1. Exercise the real Claude gate once: `export ANTHROPIC_API_KEY=… && npm run seed`
   (confirms live vision + JSON parse). This is the only unverified claim.
2. Add the portfolio tile/detail entry in ~/src/portfolio (AI category).  ← in progress
3. Optional: free-tier deploy (managed Postgres + object storage for scans) for a
   live demo link.
