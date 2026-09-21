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

## Deployed (2026-09-21)
- GitHub: https://github.com/ahonnecke/alt.vault (public).
- Live demo: https://alt-vault-zeta.vercel.app (Vercel, ashton-5237s-projects/alt-vault).
- DB: Neon free (marketplace, iad1), seeded clean (14 items). Scans in Postgres.
- Deployed QC gate runs in MOCK mode (SCANGATE_MOCK=1) to stay $0 — verdicts are
  scripted per defect, NOT real Claude vision.
- Portfolio tile links to the live demo; pushed to main (DO auto-deploy building).

## NEXT / open decisions
1. Live QC gate: keep $0 mock, or add ANTHROPIC_API_KEY on Vercel + drop
   SCANGATE_MOCK to run REAL Claude vision on the live site (pennies). The JD's
   whole "name the artifact" ask favors real.
2. Discoverability: dashboard has no link to the repo, and VaultTrace (MCP) — the
   artifact the JD most rewards — is invisible on the web. Add a repo-link footer +
   a small VaultTrace/MCP callout.
3. Real Claude gate still never exercised against the live model (no key used yet).
4. Resume: tailor `ic` variant to name Alt Vault / VaultTrace / MCP / React Native.
