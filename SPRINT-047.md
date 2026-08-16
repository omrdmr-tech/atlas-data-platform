# Sprint-047 — Transactional Outbox

## Goal
Add the first persistent transactional-outbox foundation.

## Important
Do not commit until `pnpm test` passes.

## Files
- `ports/outbox.ts`
- `adapters/postgresql/postgresql-outbox-store.ts`
- `adapters/postgresql/postgresql-outbox-store.test.ts`
- `sql/001_create_outbox_events.sql`

## Design
- Domain/application writes and outbox append must use the same active DB transaction.
- `append()` rejects calls without an active transaction.
- Outbox rows are immutable until `published_at` is set.
- `id` is the event identity and is unique.
- Pending rows are read oldest-first.
- Publishing is idempotent via `WHERE published_at IS NULL`.
- `attempts` is incremented when an event is marked published.

## Integration note
The existing generic transaction port currently has only lifecycle methods. This sprint adds a query-capable transaction contract in the outbox port as a temporary bridge. Before production use, consolidate this into the canonical infrastructure transaction port so there is exactly one `Transaction` interface.

## Verification
Run:
```powershell
pnpm install
pnpm test
```

If tests pass:
```powershell
git status
git add .
git commit -m "feat: add transactional outbox foundation"
git push
```
