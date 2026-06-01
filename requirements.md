# DP Frequency Cap — Requirements

## Functional Requirements

### FR-1: Client Simulator (Python)
- [ ] Generate synthetic ad impressions for configurable N users
- [ ] Apply local DP via randomized response using Google/Apple DP library
- [ ] Emit noisy impression count per user per campaign (not raw count)
- [ ] Configurable epsilon (0.1, 1.0, 5.0) at runtime via env/CLI arg
- [ ] Send noisy reports to frequency cap service via HTTP POST
- [ ] Simulate 100k impression events for epsilon-accuracy experiment

### FR-2: Frequency Cap Enforcement Service (Go)
- [ ] `POST /impressions` — accept noisy report (no user ID field in payload)
- [ ] `GET /caps/{cohort_id}/{campaign_id}` — return serve/suppress decision
- [ ] Maintain per-cohort per-campaign impression counts in Redis
- [ ] Enforce configurable cap threshold; return `serve` or `suppress`
- [ ] TTL-based expiration per campaign window (configurable)
- [ ] Reconstruct frequency distribution from aggregate noisy counts

### FR-3: Privacy Budget Manager
- [ ] Track cumulative epsilon spent per cohort per time window
- [ ] `POST /budget/consume` — deduct epsilon for a query
- [ ] `GET /budget/{cohort_id}` — return remaining budget
- [ ] Reject queries exceeding max epsilon per window (return 429)
- [ ] Budget resets at window expiration
- [ ] Integrated into enforcement service — queries blocked if budget exhausted

### FR-4: Reporting Dashboard (React)
- [ ] Frequency distribution curves per cohort/campaign
- [ ] Privacy budget gauge: remaining epsilon per cohort
- [ ] Cap enforcement rate (serve vs suppress ratio)
- [ ] Epsilon-accuracy tradeoff curve (MAE vs epsilon at 0.1, 1.0, 5.0)
- [ ] Live-updating via polling or SSE

### FR-5: Data Model (Privacy-by-Schema)
- [ ] `cohorts` table: `cohort_id`, `demographic_bucket`, `campaign_id`, `noisy_impression_count`, `epsilon_spent`, `window_expires_at`
- [ ] `impression_log` table: `report_id` (random UUID), `cohort_id`, `noisy_value`, `timestamp` — NO user field
- [ ] `cap_enforcement_log` table: `cohort_id`, `campaign_id`, `cap_threshold`, `action` (serve|suppress), `timestamp`
- [ ] Verified: no `user_id` column in any migration file

### FR-6: Epsilon-Accuracy Experiment
- [ ] Run simulator at epsilon ∈ {0.1, 1.0, 5.0} each with 100k events
- [ ] Compute MAE between reconstructed and true frequency distribution
- [ ] Output results to CSV
- [ ] Generate epsilon vs MAE plot (matplotlib)
- [ ] Results documented in README

---

## Non-Functional Requirements

### NFR-1: Privacy
- [ ] No user ID field exists anywhere in schema (structural, not policy)
- [ ] Noise applied client-side before any network transmission
- [ ] Server never receives true individual impression count
- [ ] Privacy budget enforcement prevents repeated-query degradation attacks

### NFR-2: Performance
- [ ] Redis increment + TTL check in single pipeline (no multi-round-trip per request)
- [ ] Cap enforcement p99 latency < 50ms under 1k concurrent synthetic clients
- [ ] PostgreSQL cohort writes async/batched — not in request hot path

### NFR-3: Accuracy Bounds
- [ ] epsilon 0.1 → MAE ≤ 20% of true frequency (experiment verified)
- [ ] epsilon 1.0 → MAE ≤ 8% (experiment verified)
- [ ] epsilon 5.0 → MAE ≤ 3% (experiment verified)

### NFR-4: Operability
- [ ] Full stack runs via `docker compose up` — no manual DB setup
- [ ] GitHub Actions CI: lint + unit tests on every push
- [ ] All epsilon/window/cap configs via env vars (no code changes to reconfigure)

### NFR-5: Security
- [ ] No PII in logs, metrics, or error messages
- [ ] Over-budget queries return 429 and log cohort ID only
- [ ] Redis keys keyed on `cohort_id:campaign_id`, never user identity

### NFR-6: Maintainability
- [ ] DP math delegated entirely to Google/Apple DP library — no custom noise implementation
- [ ] Four services independently deployable and testable
- [ ] Each service has its own README with local run instructions
