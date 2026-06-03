# Frequency Capping Without Identity: How Veil Uses Local Differential Privacy to Solve Ad Tech's Surveillance Problem

### A Chrome extension that enforces "no more than N impressions" using math instead of tracking. No user ID. No fingerprint. Provably private.

---

## The Problem With How Frequency Capping Works Today

Frequency capping is one of the most basic features in digital advertising. Show a user this ad no more than five times. It sounds simple. In practice, it has always required answering a question that advertisers should not be able to answer: who is this user, and how many times have they seen this ad across every context?

The traditional answer is third-party cookies. A cookie ties a browser to an identity. An ad server stores a counter against that identity. Every time you load a page, the system checks your ID, looks up your counter, and decides whether to show the ad.

That model is now broken by design. Third-party cookies are dead across all major browsers. The identity graph that underpinned frequency capping for two decades is gone.

The industry's response has largely been to rebuild the identity layer with different primitives: cohort IDs, device fingerprinting, probabilistic matching. These approaches keep the surveillance architecture intact and paper over the legal and technical problems with new abstractions.

Veil takes a different approach. It asks: what is the minimum information the system actually needs? Not "who is this user" but "has this ad been shown approximately N times to this browser?" Those are different questions, and the second one has a privacy-preserving answer.

---

## Why Local Differential Privacy Is the Right Primitive

Differential Privacy is a mathematical framework for answering statistical queries about a dataset without revealing information about any individual record. The formal guarantee is this: the probability that any observer can distinguish whether a specific individual's data was included in a query response is bounded by a factor of e^epsilon.

Local Differential Privacy is the variant where noise is applied on the device, before data leaves. The server never receives the true value. It receives a noisy version. This is how Apple collects keyboard analytics from iOS devices and how Google collects Chrome usage statistics. The individual data point is protected. The aggregate signal is preserved.

For frequency capping, this is exactly the right tool. You do not need to know that you saw an ad five times. You need to know that across a population of browsers, a given ad is approximately at its frequency limit for a given user segment. LDP lets you compute that aggregate while making individual ad counts mathematically unprovable from the server side.

---

## How Veil Implements It: Architecture Walkthrough

```
Browser (Chrome Extension)
+---------------------------------------------------+
| MutationObserver                                  |
| Detects injected ad elements in DOM               |
|                  |                                |
| Service Worker (Manifest V3)                      |
| Intercepts ad network requests                    |
| Reads local epsilon budget                        |
| Applies Geometric mechanism noise                 |
| Sends noisy_count to cap-service                  |
+---------------------------------------------------+
          |                        |
          v                        v
  cap-service :8080        budget-manager :8081
  (Go microservice)         (Go microservice)
  Redis TTL counters        Epsilon budget tracking
  Frequency decisions       Fail-closed enforcement
          |
          v
  Postgres audit log
  (no user_id column)
```

The extension runs entirely in a Chrome Manifest V3 service worker. When an ad element is detected via MutationObserver, the worker checks local storage for the current impression count for that campaign. Before sending anything to the backend, it applies the Geometric mechanism.

```javascript
// service-worker.js (simplified)
async function reportImpression(campaignId, trueCount) {
  const budget = await getBudget(campaignId);
  if (budget.exhausted) {
    blockAd(campaignId);
    return;
  }

  const noisyCount = geometricNoise(trueCount, budget.epsilon);
  await fetch('http://localhost:8080/impression', {
    method: 'POST',
    body: JSON.stringify({ campaign_id: campaignId, count: noisyCount })
    // No user_id. Structurally absent.
  });
}
```

The cap-service receives the noisy count and checks it against the campaign's frequency limit in Redis. Redis TTL-based counters ensure counts expire naturally, scoped to rolling windows without requiring persistent user state. The budget-manager tracks epsilon expenditure and returns a hard block signal when the per-campaign budget is exhausted.

The Postgres audit log records every frequency decision. There is no user_id column. This is not a privacy policy. It is a schema constraint. A future developer cannot accidentally add user tracking without writing a migration.

---

## The Epsilon Tradeoff Explained

Epsilon is the central parameter in any differential privacy system. It controls how much noise is added and therefore how much privacy is guaranteed.

In the Geometric mechanism, you add noise drawn from a two-sided geometric distribution with parameter e^(-epsilon). Small epsilon means the distribution is wide, meaning a lot of noise, meaning individual true values are deeply obscured. Large epsilon means a narrow distribution, meaning precise values, meaning weaker privacy.

```python
from diffprivlib.mechanisms import Geometric

# High privacy, more noise
mech_private = Geometric(epsilon=0.1, sensitivity=1)
print(mech_private.randomise(5))  # Could be 2 or 9

# More utility, less noise
mech_utility = Geometric(epsilon=2.0, sensitivity=1)
print(mech_utility.randomise(5))  # Likely 4, 5, or 6
```

For Veil's use case, an epsilon around 0.5 provides a reasonable tradeoff. The true count is obscured enough to prevent any server-side inference about individual behavior. The noisy count is close enough to the true count that aggregate frequency data remains useful for publishers optimizing campaign delivery.

The "fail-closed" budget design is critical. Every campaign gets a total epsilon budget. Every impression report consumes a small amount of that budget. When it runs out, the extension blocks the ad automatically. Privacy is not traded for availability. When the math runs out of room, the ad goes away.

This is a deliberate inversion of how most ad tech works. Systems typically fail open: when something goes wrong, show the ad anyway, figure it out later. Veil fails closed: when the privacy budget is exhausted, the ad is suppressed. The user wins in the edge case, not the advertiser.

---

## What This Means for the Post-Cookie Web

The post-cookie transition has exposed a fundamental question that the industry spent years avoiding: was identity actually necessary for advertising to function, or was it just the path of least resistance?

Frequency capping is one concrete answer. Identity is not necessary. It was a design choice made when cookies were free, surveillance was unregulated, and no one had built the mathematical infrastructure to do it differently. All three of those conditions have changed.

Privacy laws now have real teeth. The legal risk of maintaining user-ID-based frequency capping is not theoretical. Veil's approach is structurally compliant by design, not by audit.

The LDP primitives Apple and Google use internally are not secret technologies. They are published academic mechanisms, implemented in open-source libraries like diffprivlib. The gap between internal Big Tech usage and open-web deployment is not technical. It is a matter of someone building the bridge.

Publishers benefit from this too. A frequency-capped ad system that users can trust is a more durable business than one that depends on infrastructure users are actively trying to circumvent. Ad blockers exist because surveillance advertising is bad for users. A system that is provably not surveilling is a different product category.

---

## How to Try It and How to Contribute

The extension is open source: https://github.com/sourikduttanyu/Veil

To run it locally: clone the repository, load the `extension/` directory as an unpacked Chrome extension, and start the Go services with `docker-compose up`. The Python simulation scripts in `/client` let you model the epsilon-accuracy tradeoff for different campaign scenarios before deploying.

Areas where contributions would be most valuable: browser support beyond Chrome, alternative noise mechanisms (Laplace for non-integer counts), and publisher-side integrations with common ad servers.

If you find this approach interesting, a GitHub star helps surface the project to others working on privacy-preserving ad tech. If you are working on something adjacent, reach out.
