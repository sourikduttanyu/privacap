# Chrome Web Store Submission Blockers

Track everything required before Veil can be submitted to the Chrome Web Store.
Update status as each item is resolved.

---

## Hard blockers — Chrome will reject without these

- [x] **Remove `localhost` from `host_permissions`** — done.

- [x] **Decide on backend architecture** — done. Local-only default, server opt-in via popup settings.

- [x] **Privacy policy live at public URL**
  Live at: `https://sourikduttanyu.github.io/Veil/privacy-policy.html`
  - [ ] Add this URL to the Chrome Web Store listing during submission.

- [ ] **`declarativeNetRequest` permission justification — HIGH RISK**

  This is the most likely rejection reason. Google added MV3 specifically to limit ad-blocking extensions that use this API. Chrome Web Store policy says extensions that block requests must have a clearly stated non-deceptive primary purpose.

  **Veil's position:** Frequency capping is a standard practice in the ad industry. Veil enforces it client-side, without surveillance. This is not blanket ad blocking — only ads that have appeared more than N times are blocked. The first N impressions always load.

  **What to write in the "Permission justification" field:**
  > Veil uses `declarativeNetRequest` to enforce ad frequency caps. When an ad exceeds a user-configured impression limit (default: 5), Veil adds a session-only network rule blocking that specific ad unit from loading on subsequent page visits. Rules are scoped to `sub_frame` resources only, target specific ad unit URL paths (not entire domains), and are automatically cleared when the browser session ends. This is not blanket ad blocking — Veil does not block all ads. It enforces the same frequency limits that ad networks themselves apply, but client-side and without user identification.

  **What to write in "Single purpose description":**
  > Veil enforces ad frequency caps using local differential privacy. It prevents the same ad from appearing more than a configurable number of times, without tracking user identity.

  **Risk level:** Medium-high. Google may reject on first submission. If rejected, the appeal should cite: (1) frequency capping is a stated advertiser best practice, (2) rules are session-only and ad-unit-specific, not domain-wide, (3) the extension does not replace ads or inject content.

---

## Required assets — store listing will be incomplete without these

- [ ] **1–5 screenshots at 1280×800 or 640×400**
  Capture: extension popup on a real site showing suppressed count, dashboard top ads chart, How it works panel open.

- [ ] **Pay $5 one-time developer fee**
  URL: https://chrome.google.com/webstore/devconsole
  Sign in → Payments → Register.

- [ ] **Update permission justification to cover all three permissions**

  | Permission | Justification |
  |---|---|
  | `storage` | Stores epsilon setting, frequency cap, session stats for popup display. No browsing data. |
  | `activeTab` | Reads ad slot attributes (data-ad-slot, iframe src) from the active tab to identify which campaign is being seen. |
  | `declarativeNetRequest` | Session rules to block over-cap ad units at network level. Rules are ad-unit-specific, sub_frame only, session-scoped. See above. |
  | `https://*/*` host permission | Content script must run on all pages to detect ad slots. Ad slots appear on any site, so broad host permission is required. No page content, URLs, or user data is transmitted — only a scrambled impression count. |

---

## Recommended before submitting

- [ ] **Test on Chrome stable — especially declarativeNetRequest behaviour**
  Load unpacked → browse weather.com, cnn.com → let an ad hit the cap → confirm network tab in DevTools shows the subsequent iframe request blocked (not just hidden).

- [x] **GitHub Pages live** — `https://sourikduttanyu.github.io/Veil/`

- [ ] **Version bump manifest to `1.0.0`**

- [ ] **Extension popup shows clear on/off toggle**
  Reviewers check users can disable easily.

- [ ] **Promotional tile 440×280** (optional, improves store ranking)

---

## If rejected — appeals path

Chrome Web Store rejections come with a policy code. Most likely codes for Veil:

| Code | Reason | Fix |
|---|---|---|
| `Ads blocking` | Extension blocks ad requests | Appeal: cite frequency capping use case, session-only rules, ad-unit-specific filters |
| `Broad host permissions` | `https://*/*` flagged | Justify: ad slots appear on any site, content script can't predict which domains |
| `Missing privacy policy` | No policy URL in listing | Add `https://sourikduttanyu.github.io/Veil/privacy-policy.html` |
| `Deceptive functionality` | Misleading description | Clarify: Veil doesn't block all ads, it caps frequency |

---

## Status

| Item | Status | Notes |
|---|---|---|
| Manifest V3 | ✅ Done | |
| Extension icons (16, 48, 128) | ✅ Done | |
| Name + description | ✅ Done | "Veil" |
| GPL v3 license | ✅ Done | |
| Remove localhost host_permission | ✅ Done | |
| Backend: local-only default | ✅ Done | |
| Privacy policy written + live | ✅ Done | sourikduttanyu.github.io/Veil/privacy-policy.html |
| GitHub Pages live | ✅ Done | |
| declarativeNetRequest justification | ⚠️ Written here, must paste in CWS form | High rejection risk |
| Screenshots | ❌ Needed | |
| $5 developer fee | ❌ Needed | |
| Permission justification pasted in CWS | ❌ Needed | |
| Version bump to 1.0.0 | ❌ Recommended | |
| Test network blocking in DevTools | ❌ Needed | Verify Path A actually works |
