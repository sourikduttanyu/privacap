# Veil

> Frequency caps enforced with math. No user IDs. No tracking. No exceptions.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Go 1.24](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)](https://go.dev)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-Dashboard-61DAFB?logo=react)](https://react.dev)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)
[![Postgres](https://img.shields.io/badge/Postgres-16-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## Table of Contents

- [How this works in 60 seconds](#how-this-works-in-60-seconds)
- [Why Veil exists](#why-veil-exists)
- [Technical highlights](#technical-highlights)
- [Why LDP, not server-side DP](#why-ldp-not-server-side-dp)
- [Veil works with your ad blocker](#veil-works-with-your-ad-blocker-not-instead-of-it)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Privacy guarantees](#privacy-guarantees)
- [Environment variables](#environment-variables)
- [Bring your own noise](#bring-your-own-noise)
- [Repository layout](#repository-layout)
- [Contributing](#contributing)
- [License](#license)

---

## How this works in 60 seconds

- Your browser counts how many times you see each ad — locally, in memory, never written to disk.
- Before sending any report to a server, a Geometric noise mechanism scrambles the count in-browser. A true count of 5 might become 3 or 7. The server never sees the real number.
- The server accumulates noisy reports across a cohort (e.g., `us-desktop`) and decides when that cohort has seen an ad enough times. No individual is ever identified or tracked.
- When the cap is hit, Veil suppresses the ad at the network layer — the request never leaves the browser, no impression is logged, no tracking pixel fires.

---

## Why Veil exists

Third-party cookies are gone. User-ID-based frequency capping — the mechanism ad networks used to prevent the same ad from following a person across twenty sites — is now both technically broken and legally exposed under GDPR+ and US federal privacy law.

The standard replacement proposals push tracking into the browser (Topics API, Protected Audience) or ask users to accept cohort profiling in exchange for marginally less surveillance. Neither fully resolves the core tension.

Veil takes a different position: **the frequency cap is a legitimate business need. The user profile built to enforce it is not.**

Local Differential Privacy solves this at the mathematical layer. The same technique Apple uses for keyboard analytics and Google uses for Chrome usage statistics applies here to ad impression counts — the true count stays on the device, the noisy count is provably insufficient to reconstruct individual behavior, and the server-side aggregate is still accurate enough to enforce "too many times."

### The balance Veil strikes

|  | Ad blockers | No protection | Veil |
|---|---|---|---|
| You see repetitive ads | ✗ (blocks all) | ✓ | ✗ |
| Publishers earn revenue | ✗ | ✓ | ✓ |
| Advertisers reach right audiences | ✗ | ✓ | ✓ |
| Your identity is tracked | ✗ | ✓ | ✗ |
| Frequency caps enforced | N/A | ✓ (via user ID) | ✓ (via math) |

Advertisers benefit from frequency capping too — over-serving an ad tanks conversion rates and wastes budget. Veil enforces the same cap ad networks already want, using cohort-level signals instead of individual surveillance. A cohort like `us-desktop` reaches the right demographic without pinning the count to a specific person.

---

## Technical highlights

**Local Differential Privacy with a Geometric mechanism**

The Geometric mechanism is the correct choice for integer count data. Unlike Laplace (which produces real-valued noise requiring rounding) or Gaussian (which provides only approximate DP), Geometric produces integer-valued noise and satisfies pure ε-differential privacy. At `ε=1.0`, a true count of 5 is reported as a value between roughly 2 and 8 — enough signal for cohort-level enforcement, not enough to reconstruct individual behavior.

```
alpha = exp(-epsilon / sensitivity)
noise = ±Geometric(1 - alpha)
noisy_value = max(0, true_count + noise)
```

This runs in pure JavaScript inside the service worker before any `fetch()` call.

**Fail-closed epsilon budget**

Every cohort gets a finite epsilon budget per 24-hour window (`MAX_EPSILON_PER_WINDOW`, default `10.0`). The budget-manager uses `SELECT FOR UPDATE` in Postgres to prevent concurrent overspend. When the budget is exhausted, the budget-manager returns 503 and cap-service fails closed — the ad is not served. Privacy takes precedence over availability; there is no fallback path that degrades the guarantee.

**No PII schema — structurally, not by policy**

The `user_id` column does not exist in any table. The migration comment in `001_cohorts.sql` reads:

```sql
-- no user_id column. intentional. PII storage structurally impossible.
```

The payload schema is `{cohort_id, campaign_id, noisy_value}`. There is no field to add a user identifier to; the absence is architectural, not a lint rule or a promise in a privacy policy.

**Two-tier ad suppression**

When an ad crosses the frequency cap, Veil first hides it in the DOM (immediate, current page load), then adds a `declarativeNetRequest` session rule that blocks the ad iframe at the network layer on all subsequent loads this session. The ad server never receives the request; no tracking pixel fires; no impression is registered. This is equivalent to what uBlock Origin does for blocked ads — except the trigger is a mathematical cap, not a filter list.

**Chrome MV3 service worker architecture**

The background context is a service worker (MV3-compliant), not a persistent background page. In-memory true counts are intentionally ephemeral — they reset on service worker restart. This is not a limitation; it is part of the privacy model. A count that cannot persist cannot be exfiltrated.

---

## Why LDP, not server-side DP

A common alternative is to collect true counts server-side and apply differential privacy to query results (e.g., add noise before returning aggregate statistics). Veil applies noise locally instead. The distinction matters:

| | Server-side DP | Local DP (Veil) |
|---|---|---|
| True counts reach the server | Yes | No |
| Server breach exposes per-user data | Yes | No — server never had it |
| User must trust the server | Yes | No |
| Accuracy at same epsilon | Higher | Lower |
| Viable without a user ID | No | Yes |
| Compliant with cookie deprecation | No | Yes |

Server-side DP protects query results from observers; it does not protect the raw data from the operator. Local DP means the raw data is never transmitted. For a system where the server is a third-party ad infrastructure component that the user has no reason to trust, local is the only viable model.

The accuracy tradeoff is real. At `ε=1.0`, cohort-level enforcement works well; individual-level reconstruction does not. That asymmetry is the design.

---

## Veil works with your ad blocker, not instead of it

Ad blockers are good. They are not enough.

uBlock Origin, Brave Shields, and Privacy Badger block ads by matching requests against filter lists of known ad domains. This works — until it doesn't.

| Where blockers fail | Why | What Veil does |
|---|---|---|
| YouTube, Twitch | Google's MV3 API change crippled domain-blocking extensions. Anti-adblock JS fights them directly. | Detects ad slot patterns in DOM, caps frequency regardless of domain |
| Facebook, Instagram, TikTok | Ads served from first-party domains — same domain as content. Can't block without breaking the feed. | `div[data-ad-slot]` and similar patterns still fire. Veil caps them. |
| "Please disable your ad blocker" gates | User turns blocker off to read the article. Now fully exposed. | Veil stays active regardless. Ads show, but can't stalk. |
| New ad domains | Filter lists lag new domains by days or weeks after launch. | Veil watches DOM patterns, not domains. No list to update. |
| Acceptable Ads whitelist | Adblock Plus is paid by ad networks to pass "acceptable" ads through unblocked. | Veil frequency-caps them anyway. |

```
Layer 1 — Your ad blocker (optional)
          Blocks known ad domains via filter lists.
          Handles ~70–80% of traditional display ads.

Layer 2 — Veil
          Runs on everything that gets through.
          Enforces frequency caps with differential privacy.
          Works even when Layer 1 is disabled.

Result:   Fewer total ads. Zero ad stalking. No surveillance.
          Even on sites where you've turned off your blocker,
          Veil holds the line on repetition.
```

---

## Architecture

```
Browser (your device)                  Server infrastructure
─────────────────────────────────      ──────────────────────────────────────
 ┌─────────────────────────────┐
 │      Content Script         │
 │  detector.js                │
 │  Watches DOM for ad slots:  │
 │  • iframe[src*=doubleclick] │
 │  • ins.adsbygoogle          │
 │  • div[data-ad-slot]        │
 │                             │
 │  Extracts campaign_id       │
 │  Derives cohort (geo+device)│
 │  No user_id, ever           │
 └────────────┬────────────────┘
              │ AD_IMPRESSION message
              ▼
 ┌─────────────────────────────┐
 │    Background Service Worker│       ┌──────────────────────┐
 │  reporter.js                │       │   budget-manager     │
 │                             │  ┌───►│   :8081 (Go)         │
 │  true_count (in-memory,     │  │    │                      │
 │  never sent)                │  │    │  Tracks epsilon spend │
 │          │                  │  │    │  per cohort per window│
 │  Geometric noise applied ◄──┘  │    │  SELECT FOR UPDATE   │
 │  epsilon=1.0 (default)     │   │    │  Fail-closed: 503 if │
 │          │                 │   │    │  budget exhausted    │
 │  noisy_value sent ─────────┼───┘    └──────────────────────┘
 │  {cohort_id,               │
 │   campaign_id,             │        ┌──────────────────────┐
 │   noisy_value}             │───────►│   cap-service        │
 │                            │        │   :8080 (Go)         │
 └─────────────────────────────┘        │                      │
                                        │  Redis: counts/TTLs  │
                                        │  Postgres: audit log │
                                        │                      │
                                        │  Returns:            │
                                        │  {"action":"serve"}  │
                                        │  {"action":"suppress"}│
                                        └──────────────────────┘
                                                  │
                                        ┌─────────▼────────────┐
                                        │   dashboard          │
                                        │   :3000 (React)      │
                                        │                      │
                                        │  Top ads chart       │
                                        │  Budget gauge        │
                                        │  Protection stats    │
                                        │  Privacy vs accuracy │
                                        └──────────────────────┘
```

**Cohort key format**: `{geo}-{age_bucket}-{device}` (example: `us-unknown-desktop`)

No individual is ever identified. A cohort is the smallest addressable unit.

---

## Quick start

### Path 1 — Extension only (install and forget)

1. Clone the repo:
   ```bash
   git clone https://github.com/sourikduttanyu/Veil
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** and select the `extension/` folder

5. Browse normally. Veil runs silently in the background. The extension icon shows how many ads it has suppressed this session.

No account. No sign-up. No server required for basic use — the noise runs entirely in the service worker.

---

### Path 2 — Full stack (run the enforcement infrastructure)

**Prerequisites**: Docker, Docker Compose, Git

```bash
git clone https://github.com/sourikduttanyu/Veil
cd Veil
cp .env.example .env
docker compose up
```

Services that start:

| Service | URL | What it does |
|---|---|---|
| cap-service | `http://localhost:8080` | Receives noisy reports, enforces frequency caps |
| budget-manager | `http://localhost:8081` | Tracks epsilon budget per cohort per 24h window |
| dashboard | `http://localhost:3000` | Charts, budget gauge, protection stats |
| Postgres 16 | internal | Persistent impression log and cohort tables |
| Redis 7 | internal | Per-campaign counters with TTL-based window resets |

To simulate traffic against the stack:

```bash
docker compose --profile simulation up client
```

This runs the Python simulator with the default `DiffprivlibMechanism` (Geometric, ε=1.0). Watch the dashboard update in real time.

To tear everything down including volumes:

```bash
docker compose down -v
```

---

## How it works

```
1. DETECT   Content script watches the DOM for ad slots using
            MutationObserver. When an ad appears, it extracts a
            campaign_id from ad metadata and derives a cohort
            from timezone and screen width. One report per
            campaign per page load.

2. COUNT    The background service worker increments an in-memory
            true count for (cohort, campaign). This count lives
            only in memory. It is reset when the service worker
            restarts. It is never written to disk. It is never sent.

3. SCRAMBLE The Geometric mechanism is applied in pure JS before
            any network call:

              alpha = exp(-epsilon / 1)
              noise = ±Geometric(1 - alpha)
              noisy_value = max(0, true_count + noise)

            The server receives noisy_value. It has no way to
            recover true_count from a single report.

4. ENFORCE  cap-service receives {cohort_id, campaign_id, noisy_value}.
            It checks the budget-manager (fail-closed), then compares
            the noisy aggregate against FREQUENCY_CAP. Action is
            "serve" or "suppress". The result is stored back in the
            extension for popup display.
```

---

## Privacy guarantees

These are structural invariants, not policy promises. They are enforced by the schema and the code, not by configuration.

| Guarantee | How it's enforced |
|---|---|
| No user identifiers | `user_id` column does not exist in any table. `001_cohorts.sql` comment: `-- no user_id column. intentional. PII storage structurally impossible.` |
| Noise before network | `geometricMechanism()` is called in `reporter.js` before `fetch()`. The payload object has no identifier field — this is a code comment, not a lint rule. |
| Cohort granularity only | Cohort key: `{geo}-{age_bucket}-{device}`. Minimum group size is large by construction. |
| Budget enforcement | `budget-manager` uses `SELECT FOR UPDATE` to prevent concurrent epsilon overspend. |
| Fail-closed | If `budget-manager` returns 503 or is unreachable, `cap-service` returns 503. The ad is not served. Privacy over availability. |
| ε-bound per window | `MAX_EPSILON_PER_WINDOW` (default `10.0`) caps total epsilon spend per cohort per 24h window. Once exhausted, all reports from that cohort are rejected until the window resets. |

**What the server sees**: a stream of `{cohort_id, campaign_id, noisy_value}` tuples. No IP addresses are stored. No session tokens. No browser fingerprints.

**What the server does not see**: true counts, individual identities, cross-site histories, or anything that would let it reconstruct a user profile.

Privacy policy: https://sourikduttanyu.github.io/Veil/privacy-policy.html

---

## Environment variables

All services read from environment. Copy `.env.example` to `.env` and edit before `docker compose up`.

| Variable | Default | Description |
|---|---|---|
| `DP_EPSILON` | `1.0` | Noise level. Lower = more privacy, less accuracy. `0.1` is maximum privacy; `5.0` approaches true counts. |
| `FREQUENCY_CAP` | `5` | Number of noisy impressions before suppression kicks in. |
| `CAMPAIGN_WINDOW_SECONDS` | `86400` | Window length in seconds. Counts reset at window expiry. |
| `MAX_EPSILON_PER_WINDOW` | `10.0` | Total epsilon budget per cohort per window. Exhaustion triggers fail-closed lockdown. |
| `NOISE_BACKEND` | `diffprivlib` | Python client noise backend. Options: `diffprivlib`, `http_sidecar`. |
| `BUDGET_MANAGER_URL` | `http://localhost:8081` | cap-service uses this to reach budget-manager. |
| `DATABASE_URL` | — | Postgres connection string. Required. |
| `REDIS_URL` | `localhost:6379` | Redis address for cap-service. |

The epsilon tradeoff in plain terms: at `DP_EPSILON=1.0`, a true count of 5 might be reported as anywhere from 2 to 8. The server can tell "this cohort has seen this ad a lot" but not "this exact person has seen it exactly 5 times." At `DP_EPSILON=0.1`, the noise range widens further. At `DP_EPSILON=5.0`, the noise is small enough that counts are nearly accurate — but you've traded privacy for precision.

---

## Bring your own noise

The Python client ships a `NoiseMechanism` abstract base class. Subclass it to plug in any noise implementation.

```python
from noise.base import NoiseMechanism

class NoiseMechanism(ABC):
    @abstractmethod
    def noisy_count(self, true_count: int) -> int:
        """Apply noise. Must return non-negative int. Must not return true_count exactly."""

    @abstractmethod
    def mechanism_name(self) -> str:
        """Human-readable name for logs and experiment output."""
```

Two implementations ship out of the box:

**`DiffprivlibMechanism`** (default) — wraps IBM's [diffprivlib](https://github.com/IBM/differential-privacy-library) Geometric mechanism. Correct for integer count data; produces integers natively without rounding artifacts.

```python
from noise.diffprivlib_mechanism import DiffprivlibMechanism

reporter = DPReporter(DiffprivlibMechanism(epsilon=1.0))
```

**`HttpSidecarMechanism`** — delegates to an HTTP sidecar. Implement the noise in any language; the contract is:

```
POST /noise
Content-Type: application/json

{"true_count": 4, "epsilon": 1.0}

→ 200 OK
{"noisy_value": 3}
```

The sidecar must respond within 1 second. Failures raise — no silent fallback to a less-private path.

```python
from noise.http_sidecar import HttpSidecarMechanism

reporter = DPReporter(HttpSidecarMechanism("http://localhost:9000", epsilon=1.0))
```

To add a new mechanism to the extension's JavaScript side, implement the same interface:

```javascript
// extension/src/noise/your_mechanism.js
export function yourMechanism(trueCount, epsilon) {
  // return a non-negative integer
}
```

Then swap the import in `extension/src/background/reporter.js`.

---

## Repository layout

```
dp-frequency-cap/
├── extension/              Chrome MV3 extension
│   ├── manifest.json
│   └── src/
│       ├── content/        detector.js — DOM ad slot detection
│       ├── background/     reporter.js — noise + reporting service worker
│       ├── noise/          geometric.js — Geometric mechanism (pure JS)
│       └── popup/          popup UI with session stats
├── server/                 cap-service (Go, port 8080)
│   ├── handlers/           HTTP handlers: /impressions, /caps, /distribution
│   └── store/              Redis + Postgres adapters
├── budget-manager/         privacy budget manager (Go, port 8081)
│   ├── handlers/           /budget/consume, /budget/{cohort_id}
│   └── store/              Postgres with SELECT FOR UPDATE
├── client/                 Python simulator
│   ├── simulator.py        Generates synthetic impressions
│   ├── dp_reporter.py      Builds noisy payloads, no user_id
│   └── noise/              NoiseMechanism ABC + two implementations
├── dashboard/              React + Recharts (port 3000)
└── infra/
    ├── docker-compose.yml  All services, Postgres, Redis
    ├── migrations/         001_cohorts.sql, 002_impression_log.sql, 003_cap_enforcement_log.sql
    └── redis.conf
```

---

## Contributing

Open an issue before starting large changes. PRs that add a user identifier anywhere — column, field, log line, metric label — will be closed without review. This is not a stylistic preference; it is the core privacy guarantee.

Good first contributions:

- Additional noise mechanism implementations, especially the HTTP sidecar path in languages other than Python (Rust, Go, TypeScript all have real use cases)
- Epsilon-accuracy experiment results with different cohort sizes and cap thresholds
- Additional DOM ad slot selectors for platforms not currently covered
- Dashboard improvements: histogram of noisy vs true count distribution, per-cohort budget timeline

See the hard invariants in `CLAUDE.md` before writing code.

---

## License

GPL v3. See [LICENSE](LICENSE).

---

*Veil is not affiliated with Google, the Chrome team, or any ad network. It is independent open-source software.*
