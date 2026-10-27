# Backend

The API uses MongoDB through Mongoose. Start MongoDB locally, configure
`MONGODB_URI` in `backend/.env` (see `.env.example`), then start the API with
`npm run dev`.

Run `npm run seed` from the `backend` directory to add 27 prototype
institutions and 12 synthetic complaint examples. The examples include
recurring examination-result complaints for Ripple Radar, past/current
category counts for trend comparison, varied statuses/deadlines for
recommendations, and both incomplete and populated resolution records.
Recognizable institution names and `SAMPLE-`/`DEMO-` IDs are prototype
placeholders, not official AICTE Permanent IDs or confirmation of current
AICTE approval. Seeded case records use `DEMO-CASE-` numbers. The command is
idempotent: existing records with these IDs are not overwritten. It does not
create a login account; provision an administrator separately as described
below.

Import the official AICTE dashboard records for an available academic year with
`npm run import:aicte -- 2024-2025`. This fetches all states and union
territories and inserts or updates institutions by permanent ID. The importer
stores the AICTE ID, Permanent ID, approved year, address, state, and district.
Use a year currently available on the official
[AICTE dashboard](https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php).

SLA risk rules use deterministic thresholds configured with
`SLA_CRITICAL_HOURS` and `SLA_AT_RISK_HOURS` in `backend/.env` (defaults: 24
and 72 hours). The at-risk threshold must be greater than the critical
threshold. The SLA endpoint is available at `/api/sla` and
`/api/sla/risks`; optional filters are `risk`, `bureau`, and `priority`.

## Authentication

The API uses MongoDB-backed, HTTP-only sessions and bcrypt password hashes.
Copy `.env.example` to `.env`, configure `MONGODB_URI`, and set a unique
`AUTH_SESSION_SECRET` for deployments. In local development, a temporary
session secret is generated when that variable is omitted; sessions expire
when the backend restarts.

Create the first administrator by setting `INITIAL_ADMIN_NAME`,
`INITIAL_ADMIN_EMAIL`, and a unique `INITIAL_ADMIN_PASSWORD` of at least 12
characters in `.env`, then running `npm run create-admin`. The command refuses
to reset an existing account. Remove the initial password variables after
provisioning. Administrators can create bureau-officer and viewer accounts
with `POST /api/auth/users`; only administrators can create users.

All `/api` endpoints other than `/api/health` and the login endpoint require
an authenticated session. `ADMIN` and `BUREAU_OFFICER` roles can perform
workflow writes; officers are limited to cases in their bureau. `VIEWER` is
read-only. Login is rate limited. The browser uses a SameSite=Lax, HTTP-only
session cookie; serve the production frontend and API over HTTPS.

## Resolution integrity checker

The checker is an advisory, deterministic review checklist. It checks for
complaint details, a recorded response, lexical references to the original
issue, documented corrective actions, evidence references, and a consistent
resolution timestamp/history entry. A lexical match or evidence reference
does not prove a remedy worked; an official must inspect it.

`GET /api/cases/resolution-integrity` lists resolved and closed cases.
`GET /api/cases/:id/resolution-integrity` returns an individual checklist and
resolution record. Authorized administrators or officers can save response,
action, and evidence-reference metadata with
`PUT /api/cases/:id/resolution`:

```json
{
  "response": "The examination result was checked and corrected.",
  "completed_actions": ["Verified the original mark sheet", "Issued a corrected result"],
  "evidence": [
    { "label": "Correction order", "reference": "CASE-REF-2026-001", "evidence_type": "order" }
  ]
}
```

Evidence fields store references/metadata only; this project does not upload or
inspect files. Record an official checklist decision with
`POST /api/cases/:id/resolution-integrity/review` and
`{"decision":"ACCEPTED","notes":"Reviewed the correction order"}`. Decisions
are appended to the existing case-history actions and never change complaint
status.

Set `CLOSURE_RESPONSE_REQUIRED`, `CLOSURE_ACTIONS_REQUIRED`,
`CLOSURE_REQUIRED_EVIDENCE_CATEGORIES`, and `CLOSURE_BLOCKING_ENABLED` in
`backend/.env` to configure the checks. Blocking defaults to `false` (advisory).
When explicitly enabled, failed mandatory requirements return HTTP 409 when a
case is moved to `RESOLVED` or `CLOSED`; no complaint is automatically deleted,
closed, or changed by the checker. There is no course field in the current
case schema, so rules do not assume course data.

Protect and back up the MongoDB database before production deployments.

## What-should-we-do-next engine

`GET /api/next-actions` returns up to 500 complaints in due-date order with a
deterministic recommendation, supporting facts, urgency, and suggested role.
Bureau officers receive only cases in their bureau. Recommendations are
suggestions; the endpoint does not send notifications, transfer cases, or
escalate them. Relationship context uses existing confirmed case links and
pending overlap alerts; original complaint records are not changed.

Example response item:

```json
{
  "id": "CASE_OBJECT_ID",
  "case_number": "GRV-2026-001",
  "recommendation_id": "SHA256_RECOMMENDATION_FINGERPRINT",
  "recommendation": {
    "action": "FOLLOW_UP_ON_RESPONSE",
    "explanation": "The current workflow is waiting for a response...",
    "supporting_facts": ["Current status: AWAITING_RESPONSE."],
    "urgency": "HIGH",
    "suggested_responsible_role": "CASE_OWNER",
    "method": "deterministic_rules",
    "is_suggestion": true
  }
}
```

Authorized administrators and bureau officers can record a decision with
`POST /api/next-actions/:id/decision`. The recommendation ID must still match
the current case context:

```json
{
  "recommendation_id": "SHA256_RECOMMENDATION_FINGERPRINT",
  "decision": "MODIFIED",
  "modified_action": "Request the verified examination record",
  "notes": "Confirm the source record before following up."
}
```

`decision` accepts `ACCEPTED`, `REJECTED`, or `MODIFIED`. A rejected
recommendation records no selected action. Outcomes for accepted or modified
decisions are recorded separately with
`POST /api/next-actions/:id/outcome` and
`{"decision_id":"ACTION_OBJECT_ID","outcome":"The record was verified."}`.
Decisions and outcomes are appended to case history; an outcome cannot be
recorded twice or attached to a rejected recommendation.

The decision response includes the case ID, decision, selected action (null
for rejected suggestions), embedded history action ID, and recording time.
The outcome response includes the case ID, decision ID, and recording time.

## Institutional Ripple Radar

The Ripple Radar uses a deterministic weighted Jaccard comparison over the
existing complaint subject and description plus the metadata already present
in the case schema: institution, bureau/cell, complaint category, and received
time. The case schema has no course field, so the scan does not infer or
fabricate course data. A lexical match is only a potential pattern and is not
evidence that complaints share a root cause.

Configure `RIPPLE_TIME_WINDOW_DAYS` (30), `RIPPLE_CLOSE_TIME_DAYS` (7),
`RIPPLE_MIN_SIMILARITY` (42), `RIPPLE_MIN_TEXT_SIMILARITY` (15),
`RIPPLE_MIN_CLUSTER_SIZE` (3), and `RIPPLE_MAX_CASES` (500) in `.env`.
The scan queries only non-closed cases received within the configured,
indexed time window and has a hard maximum of 1,000 candidate cases. Text
similarity is required alongside metadata to reduce metadata-only matches.
Each cluster stores a score and match reasons for every included case,
matched terms, affected institutions/bureaus, and the observed period.
The dashboard also compares exact complaint-category counts in the latest
window with the preceding equal-length window, showing only categories that
meet the minimum recurrence count and increased. These trends are filtered
to the signed-in officer's bureau where applicable.

The scan uses weighted Jaccard similarity over tokenized subject/description
text (68% of the score), with available institution, bureau, category, and
time-proximity matches adding metadata weight. Each member's displayed score
is its strongest qualifying pair match; reasons and matching terms correspond
to that match. Clusters are connected components, so each suggested member
has at least one qualifying link to another member. Review the individual
cases and their links before treating a cluster as a systemic issue.

`POST /api/ripple-radar/scan` is administrator-only. It creates suggestions
without changing complaint records and skips exact or substantially
overlapping existing clusters. `GET /api/ripple-radar?status=SUGGESTED`
returns potential patterns; `status` may also be `CONFIRMED`, `ADJUSTED`,
`DISMISSED`, or `ALL`. Bureau officers see case details only for their own
bureau and can review only clusters wholly within that bureau. Administrators
can review cross-bureau clusters.

The GET response includes `data` (clusters), `category_trends`, and
`trend_window_days`. Each cluster includes `common_issue`, `case_count`,
affected bureaus/institutions, period, review status, and case entries with
`similarity_score`, `matching_reasons`, `matching_terms`, and best-matching
case numbers. A category trend includes its previous/current counts and
increase; a new recurrence has `trend: "NEWLY_RECURRING"` and a null
`change_percent`.

Authorized officers can record a decision with
`POST /api/ripple-radar/:id/review`:

```json
{
  "decision": "ADJUSTED",
  "notes": "Removed a case about an unrelated examination issue.",
  "selected_case_ids": ["CASE_OBJECT_ID_1", "CASE_OBJECT_ID_2", "CASE_OBJECT_ID_3"],
  "expected_updated_at": "2026-10-25T10:00:00.000Z"
}
```

Decisions accept `CONFIRMED`, `DISMISSED`, or `ADJUSTED`. Adjustments select
at least the configured minimum number of cases, removing original members or
adding recent non-closed cases found with `GET /api/ripple-radar/:id/candidates?search=...`.
Manually added complaints are visibly distinguished and receive no similarity
score; manual inclusion is not misrepresented as an algorithmic match.
If an adjusted member no longer has a retained scored link inside the selected
group, it is labeled as manually retained and displayed without a similarity
score rather than receiving an invented score.
The expected timestamp prevents overwriting a concurrent review. Decisions,
notes, reviewer identity, timestamps, and before/after membership are kept in
the cluster's review history; original case records and their history are not
modified. Use the dashboard's complaint links to open the existing register
filtered to an individual case.

The review response returns the updated cluster with its new status and
appended `review_history` entry, including reviewer and timestamp.

Mongoose schema indexes cover the complaint received-time/status scan,
cluster membership/status filtering, and relationship lookups used by next
actions. The application creates these indexes through Mongoose when it
connects; no SQL migration is required.
