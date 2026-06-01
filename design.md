# privacap — Architecture Design (Option A: Clean Microservices)

## Service Map

```
Python Client ──POST /impressions──► Cap Service :8080
                                          │
                                   POST /budget/consume
                                          │
                                   Budget Manager :8081
                                          │
                              ┌───────────┴───────────┐
                           Redis                  Postgres
                        (hot counts)           (cohort state,
                         TTL-keyed              logs, budget
                       per campaign)             windows)
                                          │
                                   React Dashboard :3000
                                   polls :8080 + :8081
```

---

## Directory Structure

```
privacap/
├── client/
│   ├── simulator.py          # main entry — generates N users, runs impression loop
│   ├── dp_reporter.py        # randomized response via Google DP lib, HTTP POST
│   ├── requirements.txt
│   └── Dockerfile
├── server/                   # cap enforcement service
│   ├── main.go
│   ├── handlers/
│   │   ├── impressions.go    # POST /impressions
│   │   └── caps.go           # GET /caps/{cohort_id}/{campaign_id}
│   ├── store/
│   │   ├── redis.go          # INCR + TTL pipeline
│   │   └── postgres.go       # async cohort + log writes
│   ├── budget/
│   │   └── client.go         # HTTP client for budget-manager
│   ├── go.mod
│   └── Dockerfile
├── budget-manager/
│   ├── main.go
│   ├── handlers/
│   │   ├── consume.go        # POST /budget/consume
│   │   └── query.go          # GET /budget/{cohort_id}
│   ├── store/
│   │   └── postgres.go       # epsilon_spent reads/writes
│   ├── go.mod
│   └── Dockerfile
├── dashboard/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FrequencyChart.tsx
│   │   │   ├── BudgetGauge.tsx
│   │   │   ├── EnforcementRate.tsx
│   │   │   └── AccuracyTradeoff.tsx
│   │   └── api/
│   │       └── index.ts      # typed fetch wrappers for both services
│   ├── package.json
│   └── Dockerfile
├── infra/
│   ├── docker-compose.yml
│   ├── migrations/
│   │   ├── 001_cohorts.sql
│   │   ├── 002_impression_log.sql
│   │   └── 003_cap_enforcement_log.sql
│   └── redis.conf
├── experiments/
│   ├── run_experiment.py     # drives client at epsilon 0.1/1.0/5.0
│   ├── analyze.py            # MAE computation + plot
│   └── results/              # gitignored: CSVs + PNGs land here
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── requirements.md
└── README.md
```

---

## API Contracts

### Cap Service — `POST /impressions`
```json
// request
{
  "cohort_id": "us-18-34-mobile",
  "campaign_id": "camp_abc123",
  "noisy_value": 3
}

// response 200
{
  "action": "serve",
  "current_count": 3,
  "cap_threshold": 5
}

// response 429 — budget exhausted (from budget-manager)
{
  "error": "privacy_budget_exhausted",
  "cohort_id": "us-18-34-mobile"
}
```

### Cap Service — `GET /caps/{cohort_id}/{campaign_id}`
```json
// response 200
{
  "action": "suppress",
  "current_count": 6,
  "cap_threshold": 5,
  "budget_remaining": 2.4
}
```

### Cap Service — `GET /distribution/{campaign_id}`
```json
// response 200 — for dashboard frequency curve
{
  "campaign_id": "camp_abc123",
  "buckets": [
    {"count": 1, "frequency": 0.34},
    {"count": 2, "frequency": 0.28},
    {"count": 3, "frequency": 0.19},
    {"count": 4, "frequency": 0.11},
    {"count": 5, "frequency": 0.08}
  ],
  "epsilon": 1.0
}
```

### Budget Manager — `POST /budget/consume`
```json
// request
{
  "cohort_id": "us-18-34-mobile",
  "epsilon_cost": 1.0
}

// response 200 — allowed
{
  "allowed": true,
  "remaining": 4.0,
  "spent": 6.0,
  "window_expires_at": "2025-06-01T00:00:00Z"
}

// response 429 — over budget
{
  "allowed": false,
  "remaining": 0.2,
  "spent": 9.8,
  "window_expires_at": "2025-06-01T00:00:00Z"
}
```

### Budget Manager — `GET /budget/{cohort_id}`
```json
{
  "cohort_id": "us-18-34-mobile",
  "remaining": 4.0,
  "spent": 6.0,
  "max_budget": 10.0,
  "window_expires_at": "2025-06-01T00:00:00Z"
}
```

---

## Data Model

### Redis Keys

| Key pattern | Type | Value | TTL |
|-------------|------|-------|-----|
| `cap:{cohort_id}:{campaign_id}` | String | noisy count (INCR) | `CAMPAIGN_WINDOW_SECONDS` |

### PostgreSQL Tables

```sql
-- 001_cohorts.sql
CREATE TABLE cohorts (
  cohort_id            TEXT NOT NULL,
  demographic_bucket   TEXT NOT NULL,
  campaign_id          TEXT NOT NULL,
  noisy_impression_count BIGINT NOT NULL DEFAULT 0,
  epsilon_spent        FLOAT NOT NULL DEFAULT 0.0,
  window_expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (cohort_id, campaign_id)
);

-- 002_impression_log.sql
CREATE TABLE impression_log (
  report_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   TEXT NOT NULL,
  noisy_value INT NOT NULL,
  epsilon     FLOAT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no user_id column. intentional.
);

-- 003_cap_enforcement_log.sql
CREATE TABLE cap_enforcement_log (
  id            BIGSERIAL PRIMARY KEY,
  cohort_id     TEXT NOT NULL,
  campaign_id   TEXT NOT NULL,
  cap_threshold INT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('serve', 'suppress')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no user_id column. intentional.
);
```

### Budget state

Stored in Postgres `cohorts.epsilon_spent` + `window_expires_at`.
Budget manager reads/writes this table. No separate budget table needed.

---

## Request Flow (happy path)

```
1. Python client applies randomized response → noisy_value=3
2. POST /impressions {cohort_id, campaign_id, noisy_value=3}
3. Cap service calls POST /budget/consume {cohort_id, epsilon_cost=1.0}
4. Budget manager checks cohorts.epsilon_spent + window — returns {allowed:true}
5. Cap service INCRs Redis key cap:cohort:campaign → count=3
6. count(3) < cap_threshold(5) → action=serve
7. Async: cap service writes to impression_log + cap_enforcement_log
8. Response {action:serve, current_count:3, cap_threshold:5}
```

---

## Environment Variables

| Var | Service | Default |
|-----|---------|---------|
| `DP_EPSILON` | client | `1.0` |
| `TARGET_USERS` | client | `1000` |
| `CAP_SERVICE_URL` | client | `http://cap-service:8080` |
| `FREQUENCY_CAP` | server | `5` |
| `CAMPAIGN_WINDOW_SECONDS` | server | `86400` |
| `BUDGET_MANAGER_URL` | server | `http://budget-manager:8081` |
| `REDIS_URL` | server | `redis:6379` |
| `DATABASE_URL` | server, budget-manager | `postgres://...` |
| `MAX_EPSILON_PER_WINDOW` | budget-manager | `10.0` |

---

## Build Sequence

Build in this order — each step unblocks the next:

```
1. infra/         docker-compose, migrations, redis.conf
2. budget-manager Go service — no deps on other services
3. server/        Go service — depends on budget-manager API contract
4. client/        Python — depends on cap service POST /impressions shape
5. dashboard/     React — depends on both service APIs
6. experiments/   Python scripts — depends on full stack running
7. .github/ci.yml lint + test for Go services + Python client
```

---

## Key Design Decisions

1. **Budget check is synchronous and blocking.** Cap service does not fall back to serve if budget-manager is down. Fail closed — privacy guarantee > availability.
2. **Redis is hot path only.** Postgres writes are async/batched via goroutine. Redis failure = service error. Postgres write failure = logged, not fatal.
3. **No user_id in any payload.** Enforced at API layer — if `user_id` appears in request body, cap service returns 400.
4. **Budget resets via window_expires_at, not a cron.** Budget manager checks expiry on every consume call and resets in-place. No background job needed.
5. **Cohort IDs are opaque strings.** Format: `{geo}-{age_bucket}-{device}` e.g. `us-18-34-mobile`. Demographic bucketing is caller's responsibility — server treats them as opaque keys.
