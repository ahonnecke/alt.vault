-- Alt Vault — event-sourced intake spine.
-- The `events` table is the source of truth (append-only). `items` is a
-- derived read model (CQRS projection) updated in the same transaction as the
-- event that changes it, so dashboard/API queries stay simple.

create extension if not exists "pgcrypto";

create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  title        text not null,
  category     text not null,
  manifest     jsonb not null,                 -- expected truth: {title, cardNumber, year, set, grade}
  state        text not null default 'received', -- received | scanned | exception | live
  received_at  timestamptz not null default now(),
  scanned_at   timestamptz,
  live_at      timestamptz,
  last_verdict jsonb,                           -- latest ScanGate verdict
  scan_path    text,                            -- latest scan image (public/ relative)
  updated_at   timestamptz not null default now()
);

create table if not exists events (
  seq        bigserial primary key,
  item_id    uuid not null references items(id) on delete cascade,
  type       text not null,      -- received | scanned | qc_passed | qc_failed | went_live | qc_override
  data       jsonb not null default '{}'::jsonb,
  actor      text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists events_item_idx on events (item_id, seq);
create index if not exists items_state_idx on items (state);
create index if not exists items_sku_idx   on items (sku);

-- Latest scan image is stored in the DB (not the filesystem) so the app runs on
-- read-only serverless hosts and needs no object storage. Served via an API route.
alter table items add column if not exists last_scan      bytea;
alter table items add column if not exists last_scan_type text;
