# Finance: JSON Blob → Real Tables (lossless migration plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the dashboard finance widget off the three whole-document text columns
(`users.finance_entries`, `users.finance_budget`, `users.finance_deleted`) into real tables, so rows can be
queried, indexed and summed server-side, while every existing row survives the move byte-for-byte from the
user's point of view and no client has to change.

**Architecture:** Additive schema first (three tables + a backfill that reuses the *production* parsers), then
switch the two endpoints to a new `FinanceService` that reads and writes those tables. The old columns are
frozen, not dropped, in the same release; they are removed in a later revision after the tables have served
real traffic. `PUT /profile/finance` keeps its exact contract — whole-list replace, `base_version`
compare-and-set, `deleted_ids` tombstones — so `FinanceWidget.tsx`, `WorkspaceBackupCard.tsx` and the offline
`localStore` mirror need no change.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, pytest; SQLite for tests/CI,
PostgreSQL on Render.

## Why this is not a rewrite

The widget is a whole-list editor: it caches the list offline, merges with the server before saving, sends
`base_version`, and relies on tombstones so a stale device cannot resurrect a deleted row. Changing that
protocol is a separate (and much riskier) project. This plan changes **storage only**:

| Layer | Before | After |
|---|---|---|
| Storage | 3 × `Text` JSON columns on `users` | `finance_entries`, `finance_settings`, `finance_deleted_entries` |
| Read path | parse JSON, drop invalid rows | `SELECT` rows, project to the same dicts |
| Write path | `json.dumps` the whole list | one transaction: diff → insert/update/delete |
| API | `GET/PUT /profile/finance` | unchanged, same fields, same status codes |
| Client | — | unchanged |

## Contract that must not move

Everything below is asserted by the existing suite and by the client; the migration is only correct if all of
it still holds.

- `GET /profile/finance` → `{entries: [{id, type, label, amount, date, category?}], budget?, deleted_ids?}`,
  with `response_model_exclude_none=True`: no `category` key when empty, no `budget` key when unset, no
  `deleted_ids` when empty. An untouched account answers `{"entries": []}`.
- `PUT` replaces the account's whole list and returns the same shape it just saved.
- `base_version` mismatch → `409` with `X-Profile-Version`; every successful finance write still bumps
  `users.profile_version` (`_claim_profile_version`, `profile.py:742`) — other widgets share that counter.
- `deleted_ids` bookkeeping: an id in `deleted_ids` and not in `entries` becomes a tombstone; an id present in
  `entries` clears its tombstone; tombstones expire after 90 days and are capped at 500.
- Limits: `MAX_FINANCE_ENTRIES` 2000 (422 above it), label ≤ 60, category ≤ 40, amount `0 < a ≤ 1e9`,
  `date` a real calendar day, `type ∈ {income, expense}`.
- Entry order as sent: the widget groups by day but keeps payload order *within* a day, so the order must be
  preserved (hence `position` below).
- Per-account isolation: one account never sees another's rows.

## Target schema

```python
# app/models/finance.py
class FinanceEntry(Base, TimestampMixin):
    __tablename__ = "finance_entries"
    id: Mapped[int] = mapped_column(primary_key=True)          # surrogate key
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[str] = mapped_column(String(64))         # the widget's opaque `id`
    entry_type: Mapped[str] = mapped_column(String(10))        # 'income' | 'expense'
    label: Mapped[str] = mapped_column(String(60), default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))     # money, not float
    entry_date: Mapped[date] = mapped_column("entry_date", Date)
    category: Mapped[str | None] = mapped_column(String(40))
    position: Mapped[int] = mapped_column(Integer, default=0)   # order inside the JSON array
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_finance_entries_user_client"),
        Index("ix_finance_entries_user_date", "user_id", "entry_date"),
    )

class FinanceSettings(Base, TimestampMixin):
    __tablename__ = "finance_settings"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))   # NULL = unset

class FinanceDeletedEntry(Base):
    __tablename__ = "finance_deleted_entries"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
```

Notes on the choices that are not obvious:

- **`client_id` + `id`**: the widget generates its own ids (`f1`, uuids) and uses them for undo and for
  tombstones. Keeping that value in its own column means the client's ids stay valid across the migration and
  the API's `id` field is unchanged. Uniqueness is per account, exactly as before (the JSON list was only ever
  unique per user).
- **`position`**: preserves the stored array order, so the list renders in the same order immediately after
  the migration. Recomputing order from `entry_date` would reshuffle same-day rows.
- **`Numeric(14, 2)`**: the JSON stored `round(amount, 2)` floats. Money gets a real numeric type now;
  conversion happens at the schema edge, so the API keeps answering with a JSON number. Quantize with
  `Decimal(str(value)).quantize(Decimal("0.01"))` on write — never compare `Decimal` to `float`.
- **`entry_type` / `entry_date`**: the API field names stay `type` / `date`; the column names avoid shadowing
  `type` and the `Date` type.
- **Cascades**: `ondelete="CASCADE"` plus `relationship(..., cascade="all, delete-orphan")` on `User`.
  `UserService.purge_expired_users` deletes with `await self.db.delete(user)` (`user_service.py:696`) and the
  SQLite URL sets no `PRAGMA foreign_keys`, so the ORM cascade is what actually cleans up on both engines.

## Migration design (`20261127_finance_tables`, `down_revision = "20261124_1200"` — current head, the
`add_audit_target_user` revision, which nothing revises yet)

`upgrade()`:

1. Create the three tables, guarded by `sa.inspect(conn).has_table(...)` like every other revision here.
2. Call `backfill_finance_from_json(conn)`, which lives in `app/services/finance_service.py` (not in the
   revision) so it is importable and testable without loading Alembic:

```python
def backfill_finance_from_json(conn) -> dict[str, int]:
    """Copy users.* JSON into the new tables; returns counters for the log."""
```

- Reads only rows where at least one of the three columns is not NULL.
- Parses with `parse_finance_entries`, `parse_finance_budget`, `parse_finance_tombstones` — the same
  functions the API used on read. That is the whole safety argument: a row that was visible before the
  migration is exactly a row these parsers accept, so nothing can be "lost" in translation, and a row the API
  already dropped stays dropped.
- Duplicate `client_id` inside one user's list (nothing deduped on write): **first occurrence wins**, counted
  and logged. The API also starts returning deduped lists, which is the only observable change.
- Amount → quantized `Decimal`; `position` → array index; empty category → `NULL`.
- Idempotent: a user that already has rows in any of the three tables is skipped, and `IntegrityError` on a
  single insert aborts the migration loudly rather than dropping the row.
- Logs one summary line: `users=…, entries=…, budgets=…, tombstones=…, duplicates=…, dropped=…`.
- SQLite has no transactional DDL, so a mid-way failure can leave the tables created; the `has_table`
  guards and the per-user skip make a re-run safe. Postgres runs the whole revision in one transaction.

`downgrade()`:

1. `rebuild_finance_json(conn)` — write `finance_entries` / `finance_settings` / `finance_deleted_entries`
   back into the three text columns (`json.dumps` with the same compact separators and the same
   `{…}`/`[{…}]` shapes as `serialize_finance_entries`), so a rollback does not lose rows written after the
   deploy.
2. Drop the three tables.

Both helpers get tests, so the round trip is verified rather than assumed.

## Rollout and rollback

- **Release A (this plan):** tables become the only source of truth. The legacy columns stay in the model and
  in the database but are no longer read or written by the API. No dual write: two writable copies is how
  drift bugs are born.
- **Rollback drill (document it in the changelog entry):** roll back *data* before *code* —
  `alembic downgrade -1` (rebuilds the JSON columns from the tables), then deploy the previous image. Rolling
  the app back alone would leave it reading stale columns, and Render's `preDeployCommand: alembic upgrade
  head` re-applies the upgrade on the next deploy, so the order matters.
- **Release B (later revision, `20261204_drop_user_finance_columns`):** drop the three columns, remove them
  from `models/user.py`, from `AUTH_DEFERRED_COLUMNS` (in `user_service.py`) and `PROFILE_COLUMNS`
  (in `api/dependencies.py`), delete the finance serialisers from `core/personal_lists.py` (keeping the watchlist
  half), and drop the `backfill_finance_from_json`/`rebuild_finance_json` helpers together with the columns
  they serve. Do not start it in the same week as A.

---

### Task 1: Schema + lossless backfill (no behaviour change yet)

**Files:**
- Create: `backend/app/models/finance.py`
- Create: `backend/app/services/finance_service.py` (backfill/rebuild helpers only in this task)
- Modify: `backend/app/models/__init__.py` (import + `__all__` — the test session builds its schema from
  `Base.metadata`)
- Modify: `backend/app/models/user.py` (add the three relationships with `cascade="all, delete-orphan"`)
- Create: `backend/alembic/versions/20261127_1200_add_finance_tables.py`
- Create: `backend/tests/test_finance_migration.py`

**Interfaces:**
- `backfill_finance_from_json(conn) -> dict[str, int]`
- `rebuild_finance_json(conn) -> dict[str, int]`

- [x] **Step 1:** write `test_finance_migration.py` first: a legacy user with `finance_entries` JSON (incl. a
      string amount, a row without `category`, and a duplicate id), a user with `{not valid json`, a user with
      a budget, a user with tombstones, and a user who never used the widget.
- [x] **Step 2:** assert backfill output equals `parse_finance_entries(...)` / `parse_finance_budget(...)` /
      `parse_finance_tombstones(...)` for each user, that `position` matches array order, and that a second
      backfill inserts nothing.
- [x] **Step 3:** assert `rebuild_finance_json` makes the old columns parse back to the same list (round trip).
- [x] **Step 4:** implement models + revision (idempotent guards, counters logged, summary in the revision
      docstring explaining the safety argument).
- [x] **Step 5:** verify: `./venv/Scripts/python.exe -m pytest tests/test_finance_migration.py -q`,
      then `-m alembic upgrade head` + `-m alembic check` against a scratch SQLite file.

### Task 2: Write through the tables, endpoint contract untouched

**Files:**
- Modify: `backend/app/services/finance_service.py` (`FinanceService.read` / `.replace`)
- Modify: `backend/app/api/v1/endpoints/profile.py` (`_finance_response`, `get_finance_entries`,
  `update_finance_entries`, ~lines 1112–1188)
- Test: `backend/tests/test_finance_watchlist.py` (endpoint tests stay as they are — they are the proof that
  nothing moved; serialiser unit tests for finance are removed in Release B, not here)

**Interfaces:**
- `async def read(self, user_id: int) -> FinanceState` (`entries`, `budget`, `deleted_ids`)
- `async def replace(self, user_id, entries, budget, deleted_ids, *, now) -> FinanceState`
- `replace` runs in the caller's transaction: select current rows → delete ids absent from the payload →
  insert/update the rest with their `position` → upsert or delete the `finance_settings` row → apply the
  existing tombstone rules (`deleted_ids - kept` added, kept ids cleared, expired/capped pruned) → `flush()`.
  `_claim_profile_version` and the single `db.commit()` stay where they are, so the version bump and the rows
  commit together.

- [x] **Step 1:** implement `FinanceService`; keep the constants in `core/personal_lists.py` until Release B
      (they are the documented limits) and import them.
- [x] **Step 2:** switch the two endpoints; drop their `load_profile_columns(db, user, "finance_*")` calls.
      Order reads by `position`.
- [x] **Step 3:** run the untouched finance endpoint tests — every one must pass without edits. If a test
      needs changing, the contract moved: stop and fix the service instead.
- [x] **Step 4:** add service-level tests: diff an update (same id, new amount), delete by omission, 2000-row
      cap, budget clear (`null` deletes the settings row), tombstone revival, and another account's rows left
      alone.
- [x] **Step 5:** verify: `./venv/Scripts/python.exe -m pytest -q --tb=short` (759 + the new ones),
      `flake8`, `mypy` (77 files), `npx vitest run` (unchanged 498), `tsc --noEmit`, `eslint .`.

### Task 3: Docs and the honest release note

**Files:**
- Modify: `docs/internal/architecture.md` §4 (finance moves from list 2 to list 1; keep the
  "only finance had tombstones" history in the changelog, not in the current-state doc)
- Modify: `docs/internal/status.md` (P2 row: finance is relational; note the remaining JSON blobs)
- Modify: `docs/product/widget-updates.md` (the "one JSON-as-text column per account" paragraph)
- Modify: `docs/internal/changelog.md` (new entry, with the rollback drill)

- [x] **Step 1:** update all four; no claim may describe finance as a JSON column once Release A ships.
- [x] **Step 2:** re-read the docs links check and the changelog footer convention used by the last entries.

### Task 4 (Release B, separate PR): drop the legacy columns

- [ ] New revision `20261204_drop_user_finance_columns` (downgrade re-adds the columns as `Text`, nullable —
      it cannot restore data, so the note says downgrade is lossy and the JSON rebuild shipped in Release A's
      downgrade).
- [ ] Remove the columns from `models/user.py`, from `AUTH_DEFERRED_COLUMNS` and `PROFILE_COLUMNS`, delete the
      finance half of `core/personal_lists.py` and the two migration helpers; keep the watchlist half.
- [ ] Full suite + `alembic check`; grep for `finance_entries` to confirm nothing outside history mentions it.

## Out of scope (deliberately)

- Per-row endpoints (`POST/PATCH/DELETE /profile/finance/{id}`) and dropping tombstones. Possible later; it
  changes the client's offline merge, so it needs its own plan.
- Server-side summaries replacing `frontend/src/lib/finance/summary.ts`. The new tables make it possible;
  it is a separate change.
- `GET /profile/export` does not include finance today (it exports avatar, quick links, menu, layout, camera
  config, pages). That gap predates this plan and is not made worse by it — but it should be its own ticket.
- Rewriting the other JSON blobs (notes, watchlist, reminders, layout, menu). Same shape of problem, one at a
  time.

## Verification commands

```bash
cd backend
./venv/Scripts/python.exe -m pytest -q --tb=short          # full suite, expect 759 + migration/service tests
./venv/Scripts/python.exe -m flake8 app tests
./venv/Scripts/python.exe -m mypy app                       # 77 files
./venv/Scripts/python.exe -m alembic upgrade head && ./venv/Scripts/python.exe -m alembic check
cd ../frontend && npx vitest run && npx tsc --noEmit && npx eslint .
```

## Review focus

1. The backfill must be able to lose **nothing** a user can currently see: compare pre- and post-migration
   `GET /profile/finance` payloads for a seeded account and diff them.
2. `PUT` must stay one transaction: rows, budget and the `profile_version` bump either all land or none do.
3. Order: same-day entries must come back in the order they were sent.
4. Two accounts on one deployment must never share a row (every query keyed by `user_id`).
5. Deleting an account (soft delete → purge at `user_service.py:696`) must leave no finance rows behind.
