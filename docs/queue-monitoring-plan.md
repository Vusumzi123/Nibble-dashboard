# Queue Monitoring — Dashboard Plan

Plan for the Nibble Dashboard widgets that observe the heartbeat **lane
queues** (docs/heartbeat-lanes.md in Nibble-agent): what is queued, what ran
recently (with session dumps), and token spend against the budget. Covers
backend endpoints (Nibble-agent repo) and the Angular client
(Nibble-dashboard repo, this repo).

## What the data looks like now

The lane-queue implementation already persists and journals everything the
widgets need — the dashboard work is read-only.

**`state/lanes.json`** (the queues):

```json
{
  "primary": [{ "id": "mission:research", "kind": "mission", "lane": "primary",
                "producer": "tick", "enqueued_ms": 1792537515864,
                "expires_ms": 1792623915864, "requeue_count": 0 }],
  "side":    [{ "id": "mission:drain", "producer": "turns-pending",
                "enqueued_ms": 1792537500000, "requeue_count": 1,
                "requeue_reason": "timeout" }]
}
```

**`logs/heartbeat.log`** (one NDJSON line per tick) gained per-run data:

- `runs[]` — `{ mission, lane, outcome, token_cost, over_budget, session,
  result_status, result_missing, requeued, tool_status?, tool_session?,
  tool_outcome? }`, one entry per child dispatched in the tick.
- `side_mission`, `side_outcome`, `side_token_cost`, `side_session`,
  `side_result_status`, `side_requeued` — the side run, when one happened.
- `queues` — `{ primary, side }` depth after settlement.
- Legacy top-level fields unchanged: `mission`, `session`, `tool_session`,
  `token_cost` (tick total), `outcome`, `result_status`, `duration_ms`.

**`heartbeat.current.json`** gained `side_mission`, `side_mission_title`,
`side_session` alongside the existing in-flight fields.

**Budget** — `autonomy.mission_token_budget` (`number | "unlimited"`), already
exposed inside `/api/config`.

Older ticks predate `runs[]`: consumers must fall back to the legacy fields.

---

## Backend (Nibble-agent repo — `.opencode/plugin/lib/dashboard.ts` +
`dashboard-server.ts`)

All read-only GETs, same guards as the existing API (loopback Host; no CSRF
for reads). Follow `memoryPendingSnapshot`'s pattern: never throw, empty
payload on error, short TTL cache for file-parsing endpoints.

### 1. `GET /api/queues`

Reads `state/lanes.json` + `loadMissions` (for titles) + the current marker.

```jsonc
{
  "ts": "…",
  "primary": [ { "id": "mission:research", "title": "Research sweep",
                 "producer": "tick", "enqueued_ms": …, "age_ms": 3600000,
                 "expires_ms": …, "ttl_ms": 82800000,
                 "requeue_count": 0, "requeue_reason": null } ],
  "side":    [ { "id": "mission:drain", "title": "Drain conversation backlog…",
                 "producer": "turns-pending", "enqueued_ms": …, "age_ms": …,
                 "expires_ms": null, "requeue_count": 1,
                 "requeue_reason": "timeout" } ],
  "running": { "mission": "…", "side_mission": "…" }   // from current marker
}
```

Notes: `age_ms`/`ttl_ms` are computed server-side so the client renders
without clock maths; unknown `kind` items are surfaced raw (future
producers). Cache ~2 s.

### 2. `GET /api/runs?limit=50&mission=&lane=&outcome=`

Flattens the last N ticks of `heartbeat.log` into run rows, **newest first**:

```jsonc
{ "runs": [ { "ts": "…", "tick": 115, "mission": "drain", "lane": "side",
              "outcome": "completed", "token_cost": 29911,
              "over_budget": false, "result_status": "completed",
              "requeued": false, "session": "ses_…",
              "tool_session": "ses_writer", "tool_outcome": "completed",
              "duration_ms": 102160 } ] }
```

Legacy fallback: a tick without `runs[]` yields one row from the top-level
fields (`lane: "primary"` when `mission` is set; a side-only pre-lane tick
does not exist, so nothing else is guessed). `tool_session` is preferred for
the drain writer's transcript. Filters are applied server-side so the client
does not page through raw ledgers.

### 3. `GET /api/metrics/tokens?bucket=tick|hour|day&hours=24&mission=&lane=`

Aggregates `token_cost` (per run when `runs[]` exists, else per tick) over
`heartbeat.log`:

```jsonc
{
  "bucket": "hour",
  "budget_per_run": 32000,          // mission_token_budget, null if unlimited
  "points": [ { "bucket": "2026-10-20T14:00", "tokens": 61200,
                "runs": 3, "over_runs": 1 } ],
  "totals": { "tokens": 923400, "runs": 42, "over_runs": 3 }
}
```

- `bucket=tick` → one point per tick (ordered), includes `tick` + `mission`
  labels for tooltips.
- `lane` filter works only over `runs[]` rows; legacy rows count as
  `primary`.
- `budget_per_run` lets the client draw the reference line; per-bucket
  reference is `budget_per_run × runs`.

### Tests

Extend `lib/dashboard.test.ts` + `dashboard-server.test.ts`: fixture
`lanes.json` + a small `heartbeat.log` with one two-run tick and one legacy
tick; assert the three shapes, the legacy fallback, filters, and
"corrupt file → empty payload, not 500".

---

## Frontend (this repo)

Stack facts: Angular 22 standalone components, `DashboardStore` polls every
2 s, `FlightPage` already owns the tick→transcript drawer pattern
(`detailRows` + `app-transcript` + `api.sessionMessages`), `models.ts`
`HeartbeatTick` already allows extra fields (`[key: string]: unknown`), no
chart library in `package.json` — keep it that way (hand-rolled SVG).

### Shared plumbing

- `models.ts`: `QueueItemView`, `QueuesSnapshot`, `RunRow`, `TokenPoint`,
  `TokenSeries`; extend `HeartbeatTick` with `runs`, `side_*`, `queues`.
- `api.service.ts`: `queues()`, `runs(query)`, `tokens(query)`.
- `store.ts`: `queues` signal on the 5 s cadence (same as `memoryPending`),
  `runs` and `tokenSeries` fetched on demand when their widget/filter
  changes (not on the 2 s loop — they are bigger payloads).

### Widget 1 — Queues (new `queues` page, nav entry "queues")

Two panels (`ph-panel`), `primary` and `side`, each a compact table:

| column | content |
| --- | --- |
| mission | `title`, `id` muted beneath |
| producer | badge (`tick`, `turns-pending`, `brain-stale`, future) |
| queued for | `fmtDuration(age_ms)` |
| requeue | badge `↻ n` + reason, only when `requeue_count > 0` |
| expires in | `fmtDuration(ttl_ms)`, primary only; side shows `—` (waits indefinitely) |

- Top strip: live `running` from the marker (`side_mission` + `mission`,
  matching the header's in-flight dot).
- Empty state per panel: "queue empty — nothing waiting".
- Poll with the store; no manual refresh.

### Widget 2 — Recently executed (below the queues on the same page)

Table of `GET /api/runs?limit=50`, newest first:

| column | content |
| --- | --- |
| time | `fmtTime(ts)` |
| lane | badge: `primary` (neutral) / `side` (accent) |
| mission | title or id |
| outcome | badge: completed (success) / timeout (warning) / error (danger) / declined (muted) |
| tokens | `fmtTokens(token_cost)`, red when `over_budget` |
| duration | `fmtDuration(duration_ms)` |
| session | buttons: **transcript** (`session`), **writer** (`tool_session`, drain runs) |

- The button opens the transcript drawer by copying `FlightPage`'s
  detail flow: `api.sessionMessages(id)` into `app-transcript`, Escape
  closes. Side-only ticks have `session: null` — the drawer opens on
  `side_session`/`tool_session` instead (show whichever exists).
- Row-level filter chips: `all` / `primary` / `side`; outcome select.

### Widget 3 — Token spend vs budget (new section on the existing `metrics`
page, or a panel on `queues` — recommend `metrics`, it already aggregates)

- Tabs: **per tick** / **per hour** / **per day** → `bucket=` param.
- Range select: 24 h / 7 d / 30 d → `hours=`.
- Filters: lane select (all/primary/side) + mission multi-select fed from
  `/api/missions` (id + title).
- Chart: hand-rolled SVG bar chart (per hour/day) or line (per tick) inside
  a `ph-panel`; reference line at `budget_per_run` (tick view) or
  `budget_per_run × runs` (bucket views); over-budget points/bars in danger
  colour; tooltip on hover shows bucket label, tokens, runs, over-runs.
- Stat strip above the chart: total tokens (`fmtTokens`), runs, over-budget
  runs, average per run — mirroring the existing `stat-grid` styling.

### Styling

Reuse `ph-panel` / `stat-grid` / `badge` classes and the theme tokens the
other pages use (green-crt etc.); no new CSS framework pieces.

---

## Work order

1. **Backend** (Nibble-agent): `/api/queues`, `/api/runs`,
   `/api/metrics/tokens` + tests. Ship first — the client can mock against
   the documented shapes meanwhile.
2. **Plumbing** (here): models, api methods, store signals.
3. **Queues widget** (lists) — smallest slice, validates `/api/queues`.
4. **Recent executions** + transcript buttons — reuses a proven drawer.
5. **Token graphs** + filters.
6. `ng build` + manual smoke against a live backend
   (`scripts/dashboard.sh` serves the API on :4097 with
   `DASHBOARD_STATIC_DIR` pointing at `dist/nibble-dashboard/browser`).

## Compatibility notes

- Pre-lane ticks: no `runs[]`/`side_*`. `/api/runs` synthesises one legacy
  row; graphs fall back to top-level `token_cost`. No schema versioning
  needed — absence of the fields is the version marker.
- `heartbeat.current.json` `side_*` fields are optional; old markers render
  an empty side slot.
- The backend and the client ship independently: the widgets must degrade to
  "backend too old" banners on 404 (`/api/queues` missing), exactly like
  `missionsError` does today.
