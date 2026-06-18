# Qur'an Contest Judging App — Technical Specification

**Version:** 1.2 (design-handoff reconciliation)
**Purpose:** A judging/grading web application for a Qur'an memorization contest. Replaces last year's Google Forms workflow with a comprehensive, offline-tolerant, multi-judge app and a live leaderboard.

> **Scope note:** This app is **grading-only**. It does **not** generate or store the recitation questions/starting points — judges bring those themselves. The app records deductions, computes scores, manages contestants, and produces leaderboards.

> **Changelog v1.1 → v1.2:** reconciled with the Claude-design handoff — **voice is rated per question** (not session-level); a **DQ now zeros all three components** (hifz, tajweed, voice) for that question; live grading uses **per-deduction −/+ steppers + "Reset points"** instead of a global undo (raw event log still canonical); a fresh session reads **95** (unrated voice contributes 0 — accepted, no renormalization).

> **Changelog v1.0 → v1.1:** single-knob DQ (auto-flag = question hits hifz-0; manual DQ zeros the whole question); lazy session creation; `enrollment_score` averages only started sessions; sudden-death tie-break mechanism defined; admin-provisioned judge devices (no judge logins) + explicit Firestore security rules; multi-category tickets → multiple enrollments; ID-based registration dedupe; refund handling dropped (deposit model — a refund means "attended", not "withdrawn"); authentic ajzā' wording; webhook payload shape, ticket `type`, exact question labels, and webhook signing all deferred to a **test endpoint** capture.

---

## 1. Domain glossary

| Term | Meaning |
|---|---|
| **Juz' (pl. ajzā')** | A 1/30th section of the Qur'an. The "1 / 5 / 15 / 30" categories refer to ajzā'; "30" = the entire Qur'an. **UI uses authentic wording** ("1 Juz'", "5 Ajzā'", …). |
| **Category** | Memorization level: `1`, `5`, `15`, `30`. |
| **Division** | A grouping within a category, from a configurable master list (e.g. `brothers`, `sisters`, `combined`). **Enabled per category** — a category may run multiple divisions or a single one. Every leaderboard is per (category × division). |
| **Panel** | A group of judges (any size; default 3). Built in-app. |
| **Slot** | A (category × *enabled* division) pair, e.g. `(15, combined)`. Slots are generated from config, not hand-created. Each slot is assigned one panel; a panel may cover multiple slots. |
| **Enrollment** | One contestant entered in one category (with a division). A contestant may have multiple enrollments — and a single registration ticket can create several (see §7). |
| **Session** | One judge's grading of one enrollment. Created **lazily** on the judge's first input. Each enrollment has at most one session per judge on the assigned panel (so the expected session count = that panel's size). |
| **Question** | A single spot-test prompt within a session. Minimum count per category; judges may add more. |
| **DQ (disqualified question)** | A question zeroed out as a write-off. Zeros **all three** components (hifz, tajweed, **and** voice) for that question. |

---

## 2. Competition structure

All of the following is **admin-editable configuration**, not hardcoded:

- **Categories:** `1, 5, 15, 30` ajzā' (configurable list). Each category has a label, a minimum question count, and a set of enabled divisions.
- **Divisions:** drawn from a configurable master list (e.g. `brothers`, `sisters`, `combined`). **Enabled per category:**
  - `1`, `5` → `[brothers, sisters]` (two slots each)
  - `15`, `30` → `[combined]` (one slot each — these top categories run a single division)
- **Slots** = (category × enabled division). Generated automatically from the above; this is what panels attach to and what leaderboards group by. The example config yields **6 slots**.
- **Minimum questions per category:** `{ 1: 3, 5: 4, 15: 5, 30: 6 }`. Judges may add unlimited extra questions; minimums cannot go lower.
- **Contestants may enter multiple categories** (each is a separate enrollment, possibly in different divisions). A single registration ticket may carry multiple categories (multi-select) and therefore produce multiple enrollments.

---

## 3. Scoring engine

The scoring engine is the heart of the app. It is **absolute** (not curved), **config-driven** (no scoring constants hardcoded), and **derived from raw deductions** (raw events are the source of truth; scores are always recomputed, never the canonical store). Changing any config value recomputes all affected scores at read time.

### 3.1 Components and weights

Each session produces a score in `[0, 100]`:

```
session_score = W.hifz * H  +  W.tajweed * T  +  W.voice * V
```

where `H`, `T`, `V ∈ [0, 1]` and weights `W` default to `{ hifz: 70, tajweed: 25, voice: 5 }` (must sum to 100).

### 3.2 Per-question scoring

For each question `q` in a session:

**Hifz (memorization):**
```
hifz_deduction(q) = (#prompted_fixed * D.prompted_fixed) + (#prompted_failed * D.prompted_failed)
hifz_question_score(q) = q.disqualified ? 0 : max(0, hifz_base - hifz_deduction(q))
hifz_fraction(q) = hifz_question_score(q) / hifz_base
```
- `self_corrected` mistakes carry **0** penalty (tracked for analytics/tiebreak only).
- Defaults: `D.prompted_fixed = 1`, `D.prompted_failed = 2`, `hifz_base = 10`.

**Tajweed (recitation accuracy):**
```
tajweed_deduction(q) = (#major * D.major) + (#minor * D.minor)
tajweed_question_score(q) = q.disqualified ? 0 : max(0, tajweed_base - tajweed_deduction(q))
tajweed_fraction(q) = tajweed_question_score(q) / tajweed_base
```
- Defaults: `D.major = 1`, `D.minor = 0.5`, `tajweed_base = 10`.
- **Tajweed is judged on what was actually recited.** A question whose hifz hits 0 from deductions still earns tajweed credit. Tajweed only goes to 0 when the question is a full **DQ** (§3.5).

> **Why `*_base` matters:** the base is an intermediate per-question scale that immediately normalizes back to `[0,1]` via `*_fraction`, so it never reaches the final score directly. Its only job is to be the **spread knob** — lower base = deductions bite harder = scores spread further apart. `hifz_base` doubles as the DQ trigger (§3.5).

### 3.3 Component aggregation (per session)

```
H = mean over all questions of hifz_fraction(q)
T = mean over all questions of tajweed_fraction(q)
voice_fraction(q) = q.disqualified ? 0 : (q.voice / voice_max)   // q.voice is per-question, 0..voice_max, default voice_max = 5
V = mean of voice_fraction(q) over { questions that are rated OR disqualified };  0 if none qualify
```

- **Voice is rated per question** ("rate as you go", 0–`voice_max`), not once at session end. `V` averages only questions that have a voice rating; a question that's been **DQ'd counts as 0** (write-off), and a not-yet-rated question is simply excluded from the voice mean.
- **A fresh/started session reads ~95, not 100:** with no voice yet rated, `V = 0`, so `session_score = 70·1 + 25·1 + 5·0 = 95`. This is accepted as-is (no renormalization) — the score climbs to 100 only once voice is rated full.

**Averaging (not summing) is intentional:** it normalizes the differing question counts across categories (3/4/5/6) and makes *added questions* fair — an extra question refines the estimate rather than advantaging or penalizing the contestant.

### 3.4 Enrollment score (across the panel's judges)

```
enrollment_score = mean of the session_scores from the assigned panel's STARTED sessions
```
- **Only started sessions count.** Because sessions are created lazily (§5), a session doc only exists once a judge has begun grading. A judge who hasn't started simply has no doc and is excluded — there are no blank sessions inflating the average.
- Also expose per-component cross-judge means (`H̄`, `T̄`) and total `prompted_failed` for tie-breaking.
- Show a **completeness indicator**: started sessions vs. panel size (e.g. "2 / 3 judges"), distinguishing *in progress* from *finalized* so an admin knows whether the partial score is still moving.

### 3.5 Disqualified questions (single-knob model)

Each question has a boolean `disqualified`. When true, **all three** components for that question are 0 (hifz, tajweed, **and** voice) — the whole passage is written off.

There is **one knob** — `hifz_base` — driving both the score floor and the DQ trigger:

1. **Auto-flag.** As soon as a question's `hifz_deduction(q)` reaches `hifz_base` (i.e. its hifz score has hit 0), the UI **prompts** the judge: *"Call it? This question's hifz has bottomed out."* The hifz score is already 0 from deductions; the prompt is the judge's chance to write off the **whole** question.
   - **Confirm** → the question becomes a DQ (hifz, tajweed, **and voice** all 0).
   - **Dismiss** → the question stays; hifz is 0 (naturally), **tajweed and voice still count**.
   - Auto-flag never disqualifies silently.
2. **Manual DQ.** A judge may tap "Disqualify question" at any time (discretionary). A manual DQ zeros the **whole** question (hifz + tajweed + voice) — it is the explicit "this passage is a write-off" action.

Because the DQ trigger is `hifz_base`, there is no separate threshold to tune or keep in sync: raise `hifz_base` and both the score floor and the auto-flag point move together. Since scores derive from raw data, changing `hifz_base` recomputes consistently across all sessions.

### 3.6 Worked example (5-juz, base 10, 4 questions)

| Contestant | Hifz per-q fractions | H | T | V | session_score |
|---|---|---|---|---|---|
| Strong | .9, 1.0, .8, .9 | .90 | .95 | .80 | **90.8** |
| Weak (1 DQ) | .4, 0 (DQ), .5, .3 | .30 | .50 | .40 | **35.5** |

This demonstrates real spread under absolute scoring. **The spread "knob" is `hifz_base`:** lower base = deductions bite harder = more spread. If live data still clusters high, lower the base — no re-judging required.

### 3.7 Tie-breaking

Leaderboard ordering within a (category × division):
1. `enrollment_score` (desc)
2. `H̄` cross-judge mean hifz (desc)
3. `T̄` cross-judge mean tajweed (desc)
4. total `prompted_failed` across judges (asc — fewer is better)
5. **Judge-resolved** (manual layer, see §8.7).

**Sudden-death tie-break question.** When steps 1–4 still leave a tie, the panel may run a single shared **sudden-death question** for the tied contestants:
- It is graded with the **normal scoring engine** by the **whole panel**; each tied contestant's tie-break result is the **panel-averaged** score on that one question.
- Higher result wins the **placement only** — it is used **solely to order the tied set** and **never touches** `enrollment_score`, components, or the leaderboard number. (Kept separate so peers who had N questions aren't compared against N+1.)

**Manual override.** Always available as a fallback (tie too close, no time to stage a question, etc.): a judge/admin directly sets the order among the tied set, with an audit note.

The scoring engine must be a **single pure module** (e.g. TypeScript) imported by both the judge app (live session score) and admin (leaderboard), so there is exactly one implementation of the math.

---

## 4. Configuration schema

Two live-editable config documents, both editable from the admin Config screen. Scores are computed at read time, so an edit propagates to every score the next time it is rendered (there are no stored aggregates to invalidate).

### `config/scoring` — scoring knobs

```jsonc
{
  "weights":        { "hifz": 70, "tajweed": 25, "voice": 5 },   // must sum to 100
  "hifz_base":      10,          // spread knob AND DQ auto-flag trigger (§3.5)
  "tajweed_base":   10,
  "voice_max":      5,
  "hifz_deductions":    { "prompted_fixed": 1, "prompted_failed": 2 }, // self_corrected = 0
  "tajweed_deductions": { "major": 1, "minor": 0.5 }
}
```

> Note: there is no separate `dq_threshold`. The DQ auto-flag fires when hifz deductions reach `hifz_base` (§3.5).

### `config/structure` — competition structure

Divisions are a master list; each category enables a subset. `minQuestions` lives here too.

```jsonc
{
  "divisions": [
    { "id": "brothers", "label": "Brothers" },
    { "id": "sisters",  "label": "Sisters"  },
    { "id": "combined", "label": "Combined" }
  ],
  "categories": [
    { "id": "1",  "label": "1 Juz'",   "minQuestions": 3, "divisions": ["brothers", "sisters"], "zeffyLabels": ["1 Juz (Ages 13 and Under)"] },
    { "id": "5",  "label": "5 Ajzā'",  "minQuestions": 4, "divisions": ["brothers", "sisters"], "zeffyLabels": ["5 Juz (Ages 20 and Under)"] },
    { "id": "15", "label": "15 Ajzā'", "minQuestions": 5, "divisions": ["combined"],            "zeffyLabels": ["15 Juz (Ages 27 and Under)"] },
    { "id": "30", "label": "30 Ajzā'", "minQuestions": 6, "divisions": ["combined"],            "zeffyLabels": ["30 Juz (Ages 35 and Under)"] }
  ]
}
```

Slots = the cross-product of each category with its own `divisions` (6 slots in this example). Adding/removing a division from a category, renaming divisions, or adding categories is pure config — no code change.

> **`zeffyLabels`** maps each category to the exact answer string(s) the Zeffy *Categories* multi-select returns (the form uses verbose, age-bracketed labels like `"1 Juz (Ages 13 and Under)"`, not the bare ID). `parseQuestions` uses these to resolve answers → category IDs. It's an array so a label can be re-worded without losing old registrations.

---

## 5. Data model (Firestore)

Document/collection design chosen so that **each session document is owned by exactly one judge** — this makes offline sync conflict-free (last-write-wins per session is correct; no CRDTs needed).

### `config/scoring`, `config/structure`
Two docs, schemas as §4.

### `judges/{judgeId}`
```jsonc
{ "name": "string", "active": true }
```
> No per-judge sign-in code: judges never log in themselves (see §10). A judge identity is bound to a device by the admin during setup.

### `panels/{panelId}`
Judge list is variable length — panel size = `judgeIds.length` (default 3, any number ≥ 1).
```jsonc
{ "name": "string", "judgeIds": ["j1", "j2", "j3"] }
```

### `assignments/{assignmentId}`
Maps a panel to a slot. `division` must be one the category enables in `config/structure`.
```jsonc
{ "category": "15", "division": "combined", "panelId": "p1" }
```
Example arrangement (matches the §4 structure config):

| Panel | Members | Slots covered |
|---|---|---|
| Senior | 3 | (15, combined), (30, combined) |
| Brothers' | 3 male | (1, brothers), (5, brothers) |
| Sisters' | 3 female | (1, sisters), (5, sisters) |

### `registrations/{idempotencyKey}` — IMMUTABLE MASTER
Append-only. Never edited or deleted. Source of truth for "who registered."

**Document ID = `${paymentId}:${itemId}`** (the idempotency key). Using the key as the doc ID makes duplicate webhook deliveries land on the same doc — dedupe is structural and race-proof, no "check-then-write" (see §7).

**One registration = one Zeffy *item* (ticket), not one payment.** A single `payment.completed` webhook can contain multiple items, each a separate contestant. The intake function iterates `data.items[]` and creates one registration per item. Zeffy replays the **verbatim** event on retry (same IDs — verified), so the doc-ID-as-key write is naturally idempotent.

```jsonc
{
  "source": "zeffy" | "manual",
  "zeffyPaymentId": "string | null",
  "zeffyItemId": "string | null",
  "kind": "ticket" | "donation" | "other",  // from item.type; only tickets are contestant candidates
  "buyer": { /* data.buyer — the PURCHASER, context only, not the contestant */ },
  "rawItem": { /* verbatim data.items[i] — lossless */ },
  "parsedFields": { /* label→answer map from item.questions[] (see §7.1) */ },
  "paymentStatus": "string",           // data.status
  "createdAt": "timestamp",
  "promotedContestantId": "string | null"  // set when promoted; master record itself untouched
}
```
> Refund handling is intentionally out of scope: registration is a **deposit refunded on attendance**, so a refund means "attended," not "withdrawn." We subscribe only to `payment.completed` (refunds are a different event we don't consume). `rawItem` still captures whatever Zeffy sends, losslessly.

### `contestants/{contestantId}`
```jsonc
{
  "fullName": "string",          // required
  "gender": "male" | "female" | null,  // used to auto-suggest division for gendered categories
  "photoUrl": "string | null",   // Firebase Storage
  "registrationId": "string | null",
  "fields": { /* optional fields, e.g. dateOfBirth */ },
  "active": true
}
```
Division is **not** stored on the contestant — it's per enrollment, because the same person may be in a gendered division for one category and `combined` for another.

### `enrollments/{contestantId}_{category}` — DETERMINISTIC ID
```jsonc
{ "contestantId": "string", "category": "1"|"5"|"15"|"30", "division": "<divisionId>" }
```
- **Doc ID = `${contestantId}_${category}`** so promoting the same person twice (or re-promoting after removal) overwrites the same record instead of creating a duplicate.
- `category` and `division` are required; **`division` must be one the category enables** in `config/structure`.
- At promote/quick-add: for a category with gendered divisions, default `division` from the contestant's `gender`; for a single-division category, default to that division (e.g. `combined`). Admin can override.
- A contestant has one enrollment per entered category.

### `sessions/{sessionId}` — ONE PER (enrollment × judge), CREATED LAZILY
The whole session (including its questions) is **one document**, owned by one judge. The doc does **not** exist until the judge's first input — its absence is exactly "not started."
```jsonc
{
  "enrollmentId": "string",
  "judgeId": "string",
  "questions": [
    {
      "index": 0,
      "isAdded": false,          // true if beyond the category minimum
      "isTieBreak": false,       // sudden-death question — excluded from primary score (see §3.7/§8.7)
      "disqualified": false,
      "voice": null,             // per-question voice rating, 0..voice_max; null until rated
      "events": [                // ordered log → audit + recompute; counts derived
        { "type": "prompted_fixed",  "ts": "timestamp" },
        { "type": "prompted_failed", "ts": "timestamp" },
        { "type": "self_corrected",  "ts": "timestamp" },
        { "type": "tajweed_major",   "ts": "timestamp" },
        { "type": "tajweed_minor",   "ts": "timestamp" }
      ]
    }
  ],
  "updatedAt": "timestamp",
  "finalizedAt": "timestamp | null"   // soft state only — sessions remain editable
}
```
Per-question deduction counts (`prompted_fixed`, etc.) are **derived** from `events`; **`voice` is per question** (§3.3). The event log is the canonical raw record (full audit + recompute); data volume is trivial (a few dozen events per session). Correcting a mis-tap removes one event of that type (the **−/+ steppers**, §9.3) rather than popping the global last event.

### `tiebreaks/{tiebreakId}` — owns the resolution + audit
```jsonc
{
  "category": "string", "division": "string",
  "contestantIds": ["..."],
  "method": "question" | "override",
  "resolution": { /* final ranking among the tied set */ },
  "resolvedBy": "judgeId/adminId", "note": "string", "createdAt": "timestamp"
}
```
> Source-of-truth split: `tiebreaks` owns *the decision* (final ordering, who/why, method). Raw grading for a sudden-death **question** lives in the normal `sessions` model with `isTieBreak: true`, which keeps it out of the primary score. One holds raw input, the other holds the resolution — no duplication.

---

## 6. Offline-first architecture & sync

**Requirements:** multiple judge devices, intermittent/poor wifi, live entry during recitation must never lose data.

**Key property:** writes are **partitioned by judge** — a judge only ever writes their own session docs, so no two devices touch the same record. Therefore **no merge conflicts**; last-write-wins per session is correct, and no CRDT machinery is needed. (Enforced by security rules — §10.)

**Approach:**
- **Firestore offline persistence** (built-in): each device writes locally first (instant, survives wifi drops) and queues writes that sync automatically when connectivity returns.
- The judge grading screen computes session scores **locally** (shared scoring module) for immediate feedback; raw deductions sync as the source of truth.
- **PWA**: service worker caches the app shell for offline launch/use. Contestant **photos are cached locally** (e.g. Cache Storage) so the judge queue renders offline.
- **One-time connectivity at setup.** Because the admin provisions each laptop (§10), each device is connected once during setup — long enough to cache the app shell, the judge's queue data, and contestant photos. After that it runs fully offline through the session.
- **Leaderboard / admin: online-preferred.** These aggregate *all* judges' data, so they're meaningful only once sessions sync. They run on a connected admin/display device and render whatever has synced.

---

## 7. Zeffy integration (webhook intake)

Zeffy offers a webhook (Beta). Intake is **webhook-primary**, with manual entry as the fallback:

1. **Webhook receiver** (Firebase Cloud Function): subscribe to `payment.completed`; **iterate `data.items[]`** and write one immutable `registrations` doc **per item**, keyed by `${paymentId}:${itemId}`; respond `2xx` (Zeffy retries otherwise). See §7.1 for parsing.
2. **Manual fallback**: the admin **quick-add** (§8.3) covers anyone the webhook missed.

> Registration is a **paid deposit** (refunded when the contestant actually attends), so the webhook fires on a real transaction — no zero-amount edge case to worry about. Refunds are not consumed (see §5).

> **✅ Verified by a real capture (2026-06-18).** Confirmed against a live `payment.completed` delivery from the contest form (`campaign_type: "ticketing"`, `item.type: "ticket"`): contestant answers arrive in `data.items[].questions[]`; the four labels match exactly; *Categories* is a JSON array of verbose strings; `data.id` and `item.id` are distinct. A $0 ticket **does** fire the webhook. **Zeffy sends no signature header** — the endpoint is secured by a secret-token URL + `campaign_id` allowlist (§10.2), not signature verification.

### 7.1 Parsing the webhook payload

The payload envelope is `{ id, type, version, dispatchedAt, data }`. The contestant data is **per-ticket**, in `data.items[].questions[]` — **not** `data.buyer_questions` (those belong to the *purchaser*, who may not be a contestant at all). **A single webhook can produce multiple contestants**, one per item — and a single ticket may select multiple categories, producing multiple enrollments on promote.

```
on payment.completed(payload):
  payment = payload.data
  for item in payment.items:
    key = `${payment.id}:${item.id}`        // idempotency key == registration doc ID
    create-or-overwrite registrations/{key} {
      source: "zeffy",
      zeffyPaymentId: payment.id,
      zeffyItemId: item.id,
      kind: classify(item.type),            // "ticket" | "donation" | "other"
      buyer: payment.buyer,                 // purchaser, context only
      rawItem: item,                        // verbatim — lose nothing
      parsedFields: parseQuestions(item.questions),
      paymentStatus: payment.status,
      createdAt: now()
    }
```

- **Doc ID = `${paymentId}:${itemId}`** → duplicate retries overwrite the same doc (race-proof). Depends on Zeffy keeping those IDs stable across retries — **verify on the test endpoint by replaying a delivery**; if unstable, fall back to whatever Zeffy keeps stable (e.g. the top-level event `id`).
- **`parseQuestions(item.questions)`** turns `[{ question, type, answer }, ...]` into a `{ label → answer }` map, then maps known labels to canonical contestant fields:

  | Form label | Answer type | → | Field |
  |---|---|---|---|
  | `Contestant FULL Name` | text | → | `fullName` *(required)* |
  | `Contestant Date of Birth` | date (`YYYY-MM-DD`) | → | `fields.dateOfBirth` |
  | `Gender` | single_select (`"Male"`/`"Female"`) | → | `gender` (normalize → `male`/`female`) |
  | `Categories` | multi_select (**array of strings**) | → | `category[]` |

  - **Categories resolution:** each answer string (e.g. `"1 Juz (Ages 13 and Under)"`) is matched against `config/structure.categories[].zeffyLabels` to get the category ID. One enrollment is created per resolved category on promote. An unrecognized string is preserved in `parsedFields` and surfaced for the admin to map at promote time (never silently dropped).
  - **Gender → division:** `"Male"`/`"Female"` normalize to `male`/`female`, which seed the per-enrollment division default for gendered categories (admin can override).
  - Buyer-level answers (e.g. `Phone Number` in `buyer_questions`) belong to the purchaser and are **not** contestant fields.
- **`classify(item.type)`**: a contest ticket is `item.type == "ticket"` (confirmed). **Store every item regardless** (master is immutable, lose nothing), but only `ticket` items are surfaced as contestant candidates in the promote UI; donations/other sit ignored.
- **`buyer`** (`data.buyer`) is the person who paid; capture it as context but never treat it as the contestant.

On **promote**, `parsedFields` are copied into `contestants.fields`, with full name required, and one enrollment created per selected category (deterministic enrollment IDs, §5).

---

## 8. Admin features

### 8.1 Registration master list
Immutable, searchable table of all `registrations`. Never edited/deleted. Shows source (zeffy/manual) and whether already promoted.

### 8.2 Promote to contestant
From a master record, create a `contestant` (+ one `enrollment` per selected category) and assign division(s). Removing a contestant later **does not** touch the master, so re-adding is trivial.

### 8.3 Quick-add
Manual contestant entry. Writes a master record marked `source: manual` (keeps the master complete + the promote flow uniform), then promotes. **Required: full name + category/categories.** All other fields optional.

### 8.4 Contestant management
Edit contestant fields, upload/replace **photo** (Firebase Storage), add/remove category enrollments, toggle active.

### 8.5 Structure & panels

**Structure editor** (`config/structure`):
- Manage the **division master list** (add/rename, e.g. brothers, sisters, combined).
- Manage **categories**: label, `minQuestions`, and **which divisions each category enables** (checkboxes). Slots regenerate automatically from this.

**Panels:**
- **Create a panel**, name it, and **add any number of judges** (default 3; 2 or 4 are fine — scoring averages over whatever judges are on it). Panel size = its judge count, and that's the expected session count per enrollment in its slots.
- **Assign a panel to slots** via a grid of all generated (category × division) slots; each slot points to one panel, and a panel can cover many slots.

**Judges:** manage judge accounts (name, active). No sign-in codes — devices are provisioned by admin (§10).

**Scoring config** (`config/scoring`): live-edit weights, bases, deduction values. Validate weights sum to 100. Edits recompute derived scores on next render.

### 8.6 Device provisioning (judge seat setup)
On a judge laptop, the admin opens the setup screen (admin-authenticated), **picks the judge for that seat**, and the device receives a **persistent judge-scoped identity** (§10). The admin then lands the device on the branded welcome screen and hands it over. Re-assigning a seat mid-event (e.g. a laptop swap) is the same flow, reached via the hidden admin affordance.

### 8.7 Leaderboard & tie-break resolution

**Leaderboard** — per (category × division): ranked contestants by §3.7, with per-component breakdown, completeness indicator (started sessions vs panel size), and inter-judge spread (flag if judges diverge sharply). Exportable (CSV/print).

**Tie-break resolution** — when the automatic order (§3.7 steps 1–4) leaves a tie, surface a resolution UI:
- **Sudden-death question** — the panel grades one shared question for the tied contestants with the normal engine; the panel-averaged result orders that group. Stored in `sessions` with `isTieBreak: true` (excluded from primary scores) and resolved in `tiebreaks`.
- **Judge override** — directly set the ranking among the tied set, with an audit note (`tiebreaks`, `method: "override"`).

---

## 9. Judge features

### 9.1 Welcome / start (no login)
The laptop is pre-bound to this judge by the admin (§8.6/§10). The screen shows branding/logo, **"Welcome, [Judge Name]"**, and a **Get Started** button → straight into the queue. The judge never enters a password. The device is **locked to judge mode**; admin is reachable only via a hidden affordance + admin password.

### 9.2 Contestant queue
List of contestants in the judge's assigned slots, each with **photo** + name + status (not started / in progress / graded). Status is derived from session docs (none = not started; exists = in progress; finalized = graded). Offline-capable after the one-time setup cache.

### 9.3 Live grading screen (centerpiece)
For the selected enrollment (session doc created lazily on first input):
- One card per question (minimum count pre-created in the UI; **"Add question"** button appends more, marked `isAdded`).
- Each deduction has its own **−/+ stepper** (big tap targets): **Self-corrected (0)**, **Prompted −1**, **Prompted-failed −2**, **Tajweed major −1**, **Tajweed minor −0.5**. Tapping **+** appends an event; tapping **−** removes one event of that type (corrects a mis-tap — no separate global undo). A **running per-question tally** and **running session score** update live (never a spinner).
- **Reset points** clears the active question's marks.
- **Disqualify question** button (manual DQ → whole question to 0 across hifz, tajweed, and voice); plus **auto-flag prompt** when a question's hifz hits 0 (judge confirms a full DQ or dismisses, leaving tajweed + voice counting — §3.5).
- **Voice/style** rated **per question** (0–`voice_max`), alongside that question's hifz/tajweed.
- Auto-saves locally continuously (offline-safe); syncs when online.

### 9.4 Review/edit prior sessions
A "My graded contestants" list. **Sessions are never hard-final** — the judge can reopen and edit any prior session; scores recompute from raw events.

---

## 10. Roles & auth

**Model: admin-provisioned devices. Judges never authenticate themselves.**

- **Firebase Auth** with role via custom claims.
- **Admin:** the single real login (strong password); full access (registrations, contestants, panels, config, leaderboard, tie-breaks, judge management, device provisioning).
- **Judge identity (provisioned, not logged in):** during setup the admin, on a judge laptop, picks the judge for that seat. A Cloud Function (admin-authenticated) **mints a Firebase custom token** stamped with the `judge` role and that `judgeId`; the device signs in with it and the session **persists** (survives refresh + offline). The judge sees only a branded welcome screen — no credentials. Admin credentials are **never left resident** on a judge laptop; provisioning briefly authenticates the admin, then the device falls back to the judge-scoped session.
- **Re-entering admin on a judge laptop:** a discreet affordance (e.g. logo long-press) prompts for the admin password; correct → admin mode (re-provision seat, manage, view leaderboard). Judges can't reach it without the password.
- (Optional) **Display:** read-only leaderboard view for a projector.

### 10.1 Firestore security rules (the backbone of conflict-free sync)
Rules enforce — not merely assume — the per-judge ownership model:
- A judge may **create/update a `sessions` doc only if** `session.judgeId == request.auth.uid` **and** the enrollment's slot is covered by a panel the judge is on. No judge can touch another judge's session.
- Judges have **read** access scoped to their assigned slots (their queue, contestants, relevant config); **no write** to config, panels, assignments, contestants, or registrations.
- `registrations` are **append-only** — no client edits or deletes (immutable master).
- **Admin-only** writes for `config/*`, `panels`, `assignments`, `contestants`, `judges`, and `tiebreaks`.

### 10.2 Webhook endpoint security
Zeffy sends **no signature** (verified — see §7), so the receiver is protected by:
- **Secret-token URL** — a long random token in the webhook path/query that only Zeffy's config and the function know; requests without it are rejected. HTTPS is provided by Firebase Hosting/Functions.
- **`campaign_id` allowlist** — the function ignores any event whose `data.campaign_id` is not the contest's (`c0000000-0000-4000-8000-000000000000`). A sanity filter on top of the token, not a security boundary.
- The function only ever **writes `registrations`** (the immutable master); it cannot mutate contestants/scores.

---

## 11. Open items

**Resolved by the 2026-06-18 webhook capture:** payload shape, `item.type` (`"ticket"`), campaign type (`"ticketing"`), exact question labels, multi-select encoding (array of verbose strings → `zeffyLabels` map), distinct payment/item IDs, $0 tickets fire the webhook, and signing (none → secret-token URL + `campaign_id` allowlist, §10.2).

**ID stability — confirmed (2026-06-18).** A forced 500 made Zeffy retry; the second delivery was a **verbatim replay** (identical `data.id`, `item.id`, envelope `id`, and `dispatchedAt`). The dedupe key is stable, so a retry overwrites the same `registrations/{paymentId}:{itemId}` doc — no duplicate.

**Nothing blocking remains.**

**Later tuning (not blockers):**
- Tune default `hifz_base` / `tajweed_base` after first live data (ships at 10/10).

---

## 12. Recommended tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite, as an installable **PWA** (service worker for offline shell) |
| Scoring | Single shared **TypeScript** pure module (used by judge app + admin) |
| Data | **Firestore** with offline persistence enabled |
| Functions | **Firebase Cloud Functions** (Zeffy webhook receiver, judge-token minting) |
| Storage | **Firebase Storage** (contestant photos; cached locally for offline) |
| Auth | **Firebase Auth** + custom claims (admin / judge / display) |
| Hosting | **Firebase Hosting** |

**Scale:** one event, on the order of dozens of contestants, ~9 judges, hundreds of sessions — trivial data volume. Leaderboard can be computed client-side on the admin device from synced data.

---

## 13. Build principles (carry through implementation)

1. **Store raw, derive scores.** Raw deduction events are canonical; every score recomputes from them.
2. **Nothing scoring-related is hardcoded.** Weights, bases, deductions, minimums all live in config.
3. **One scoring module.** Judge app and admin import the same pure function.
4. **Per-judge document ownership** keeps offline sync conflict-free — and security rules enforce it (§10.1).
5. **Master list is immutable.** Active contestants are a separate, mutable layer.
6. **Sessions are always editable.** No destructive finalization; created lazily on first input.
7. **Judges never log in.** Admin provisions judge-scoped devices; one admin credential.
8. **One DQ knob.** `hifz_base` drives both the score floor and the DQ auto-flag.
