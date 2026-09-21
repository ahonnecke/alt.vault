# Deploy Alt Vault (free tier, $0)

The app is filesystem-free (scans live in Postgres) and runs the QC gate in mock
mode by default, so a live demo needs only a free Postgres and a Vercel project —
no API key, no object storage, no spend.

## 1. Postgres (Neon, free)

Create a free project at <https://neon.tech>, then copy the **pooled** connection
string (it contains `-pooler` and `sslmode=require`). Call it `$NEON`.

Seed it from your machine:

```bash
cd ~/src/alt.vault
DATABASE_URL="$NEON" npm run migrate
DATABASE_URL="$NEON" npm run seed:mock     # 14 items, $0
```

## 2. Vercel project + env

```bash
cd ~/src/alt.vault
vercel link                                # create/link the project
printf '%s' "$NEON" | vercel env add DATABASE_URL production
printf '1'        | vercel env add SCANGATE_MOCK production
# Optional — flip the QC gate to real Claude vision instead of mock:
#   vercel env add ANTHROPIC_API_KEY production   # paste sk-ant-...
#   printf 'claude-opus-5' | vercel env add QC_MODEL production   # or claude-sonnet-5
```

## 3. Deploy

```bash
vercel --prod
```

Note the production URL it prints (e.g. `https://alt-vault.vercel.app`).

## 4. Point the portfolio tile at the live demo

In `~/src/portfolio/portfolio/src/NavMap.tsx`, set the `alt_vault` entry's `link`
to that URL (instead of the GitHub repo), then commit and push (push deploys the
live site):

```bash
cd ~/src/portfolio && git commit -am "portfolio: link Alt Vault to live demo" && git push
```

## Notes

- `SCANGATE_MOCK=1` keeps the deployed demo at $0. Remove it (and add
  `ANTHROPIC_API_KEY`) to run real Claude vision QC on the live site.
- Re-seeding is idempotent: `DATABASE_URL="$NEON" npm run seed:mock` resets and
  reloads. The "Simulate intake" button on the live site writes to Neon and works
  without a redeploy.
- VaultTrace (MCP) is a local/stdio tool — run it against the same `$NEON` by
  exporting `DATABASE_URL` before `npm run mcp`.
