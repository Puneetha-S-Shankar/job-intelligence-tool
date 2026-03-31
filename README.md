# Job Intelligence Tool

A full-stack placement intelligence platform for RVU Placements. Scrapes job listings, AI-enriches them with school mappings and red-flag detection, lets directors distribute jobs to officers, and tracks outcomes through a conversion funnel — all in a single monorepo.

---

## Tech Stack

| Layer    | Technologies |
|----------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, TanStack Query v5, Axios |
| Backend  | Node.js, Express 5, TypeScript, Supabase JS, node-cron, Axios, SendGrid |
| Database | Supabase (Postgres) |
| AI       | Google Gemini / Anthropic Claude (via unified `aiProvider`) |

---

## Project Structure

```
job-intelligence-tool/
├── frontend/
│   └── src/
│       ├── types/
│       │   └── index.ts            # Shared TypeScript types (mirrors backend)
│       ├── lib/
│       │   └── api.ts              # Axios instance (base URL: VITE_API_URL || localhost:4000)
│       ├── hooks/
│       │   └── useJobs.ts          # TanStack Query hooks for jobs API
│       ├── components/
│       │   ├── Layout.tsx          # Teal sidebar shell (responsive)
│       │   └── JobCard.tsx         # Reusable job card with score/school badges
│       ├── pages/
│       │   ├── DailyDigest.tsx     # / — top 30 fresher-friendly jobs
│       │   ├── SearchJobs.tsx      # /search — filtered, paginated job search
│       │   ├── JobDetail.tsx       # /jobs/:id — 2-col detail: header, placement intelligence, contacts, AI actions
│       │   ├── OfficerDashboard.tsx # /officer — assigned jobs + status updater
│       │   ├── DirectorDashboard.tsx # /director — KPIs, charts, admin actions
│       │   └── Login.tsx           # /login — sign-in screen
│       ├── App.tsx
│       ├── main.tsx
│       └── vite-env.d.ts
│
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── jobs.ts             # /api/jobs
│       │   ├── distributions.ts    # /api/distributions
│       │   ├── officer.ts          # /api/officer
│       │   ├── analytics.ts        # /api/analytics
│       │   ├── templates.ts        # /api/templates
│       │   ├── admin.ts            # /api/admin
│       │   ├── stats.ts            # /api/stats (legacy)
│       │   └── alerts.ts           # /api/alerts (legacy)
│       ├── types/
│       │   └── index.ts            # Domain interfaces (Job, Outcome, User, …)
│       ├── db/
│       │   └── supabase.ts         # Primary Supabase client
│       ├── lib/
│       │   └── supabase.ts         # Secondary Supabase client (alerts/stats)
│       ├── services/
│       │   ├── enrichmentService.ts
│       │   ├── claudeService.ts
│       │   └── ai/                 # Gemini + Claude provider abstraction
│       ├── jobs/
│       │   ├── scheduler.ts        # node-cron schedule
│       │   ├── scraper.ts          # Job scraper
│       │   └── emailer.ts          # SendGrid email alerts
│       └── server.ts               # Express app entry point (port 4000)
│
├── package.json                    # Root — runs both with concurrently
└── README.md
```

---

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd job-intelligence-tool
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon or service-role key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `CLAUDE_API_KEY` | Anthropic Claude API key (fallback) |
| `SENDGRID_API_KEY` | SendGrid key for email alerts |
| `EMAIL_FROM` | Sender address for digests |
| `CLIENT_ORIGIN` | Frontend origin for CORS (default `http://localhost:5173`) |
| `PORT` | Backend port (default `4000`) |

Frontend env (`frontend/.env`):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default `http://localhost:4000`) |

### 3. Run in development

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health check: `GET http://localhost:4000/api/health`

### 4. Build for production

```bash
npm run build
```

---

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `jobs` | Core job listings scraped and enriched by AI |
| `job_course_mappings` | Normalized school-to-job mappings produced by AI enrichment |
| `job_distributions` | Records of jobs sent from director to officer |
| `outcomes` | Placement outcome per distribution (status funnel) |
| `company_stats` | Pre-aggregated conversion stats per company |
| `company_contacts` | HR contacts associated with companies |
| `users` | Platform users (admin / director / officer) |
| `universities` | University + curriculum data |
| `alerts` | Email alert subscriptions |

> **Important:** `schools` is **not** a column on `jobs`. School mappings live exclusively in `job_course_mappings`.

---

## Backend API Reference

All routes are mounted under the Express app in `server.ts`. Base path: `/api`.

---

### `GET /api/health`

Health check. Returns `{ ok: true, ts: "<ISO timestamp>" }`.

---

### `/api/jobs` — `routes/jobs.ts`

#### `GET /api/jobs/daily-digest`

Returns the top 30 active fresher-friendly jobs sorted by `conversion_score` descending. Each job includes its nested `job_course_mappings` array and a `contacts` array fetched in a single batch query against `company_contacts`.

**Response**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "title": "Software Engineer",
      "company": "Acme Corp",
      "location": "Bangalore",
      "job_type": "Full-time",
      "salary_min": 600000,
      "salary_max": 1200000,
      "is_fresher_friendly": true,
      "conversion_score": 82,
      "has_red_flags": false,
      "red_flags": null,
      "posted_date": "2026-03-28T00:00:00Z",
      "job_course_mappings": [
        { "school_code": "SoCSE", "school_name": "School of CSE", "confidence": 0.92 }
      ],
      "contacts": [
        { "name": "Jane HR", "email": "hr@acme.com", "is_verified": true }
      ]
    }
  ],
  "count": 30
}
```

**Error responses:** `500 { error: string }`

---

#### `GET /api/jobs/search`

Filtered, paginated job search. All query parameters are optional.

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `schools` | `string` | Comma-separated school codes — filters via `job_course_mappings` |
| `location` | `string` | Case-insensitive partial match on `location` |
| `company` | `string` | Case-insensitive partial match on `company` |
| `minScore` | `number` | Minimum `conversion_score` |
| `jobType` | `string` | Exact match on `job_type` |
| `salary_min` | `number` | Minimum `salary_min` value |
| `salary_max` | `number` | Maximum `salary_max` value |
| `posted` | `7d` \| `30d` \| `all` | Recency filter on `posted_date` |
| `fresherOnly` | `true` | Only return `is_fresher_friendly = true` jobs |
| `page` | `number` | Page number (default `1`) |
| `perPage` | `number` | Results per page, max 100 (default `20`) |

**Response**
```json
{
  "jobs": [ /* array of Job + job_course_mappings */ ],
  "total": 142,
  "page": 1,
  "perPage": 20
}
```

**Error responses:** `500 { error: string }`

---

#### `GET /api/jobs/:id`

Full job detail with related data fetched in parallel.

**Response**
```json
{
  "id": "uuid",
  "title": "...",
  "company": "...",
  "description": "...",
  "skills": ["Node.js", "React"],
  "has_red_flags": false,
  "red_flags": null,
  "source_url": "https://...",
  "course_mappings": [
    { "school_code": "SoCSE", "confidence": 0.9, "reasoning": "..." }
  ],
  "contacts": [ /* CompanyContact[] */ ],
  "company_stats": {
    "total_distributed": 12,
    "total_offers": 3,
    "conversion_rate": 25.0
  }
}
```

**Error responses:** `404 { error: "Job not found" }`, `500 { error: string }`

---

#### `POST /api/jobs`

Manually create a job (director / admin).

**Request body**
```json
{
  "title": "Data Analyst",
  "company": "TechCorp",
  "location": "Bangalore",
  "job_type": "Full-time",
  "salary_min": 500000,
  "salary_max": 900000,
  "is_fresher_friendly": true
}
```

`title` and `company` are required. All other fields optional.

**Response:** `201` + inserted job row.

**Error responses:** `400 { error: "title and company are required" }`, `500 { error: string }`

---

### `/api/distributions` — `routes/distributions.ts`

#### `POST /api/distributions/send`

Send one or more jobs to one or more officers. Creates a `job_distributions` row per officer and an `outcomes` row with `status = 'not_started'` for each.

**Request body**
```json
{
  "jobId": "uuid",
  "officerIds": ["uuid-1", "uuid-2"],
  "note": "Please follow up by Friday"
}
```

**Response**
```json
{ "success": true, "count": 2 }
```

**Error responses:** `400` (missing fields or invalid officer IDs), `404` (job not found), `500`

---

#### `GET /api/distributions`

List all distributions with nested job info and outcomes. Optionally filter by officer or director.

**Query parameters**

| Param | Description |
|-------|-------------|
| `officer_id` | Filter by assigned officer UUID |
| `director_id` | Filter by director UUID |

**Response** — raw array (no wrapper):
```json
[
  {
    "id": "uuid",
    "job_id": "uuid",
    "officer_id": "uuid",
    "sent_at": "2026-03-28T10:00:00Z",
    "note": "...",
    "jobs": {
      "id": "uuid", "title": "...", "company": "...",
      "salary_min": 600000, "conversion_score": 74
    },
    "outcomes": [
      { "id": "uuid", "status": "contacted", "notes": "Called on Mon", "updated_at": "..." }
    ]
  }
]
```

**Error responses:** `500 { error: string }`

---

### `/api/officer` — `routes/officer.ts`

#### `GET /api/officer/jobs`

Returns all distributions assigned to the given officer, including nested job fields and outcome status. Sorted by `sent_at` descending.

**Query parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `officer_id` | Yes | Officer UUID |

**Response** — raw array:
```json
[
  {
    "id": "dist-uuid",
    "sent_at": "...",
    "note": "...",
    "jobs": {
      "id": "uuid", "title": "...", "company": "...",
      "location": "Bangalore", "salary_min": 700000, "salary_max": 1200000,
      "conversion_score": 80, "is_fresher_friendly": true,
      "has_red_flags": false, "posted_date": "..."
    },
    "outcomes": [
      { "status": "in_progress", "notes": "Emailed HR", "updated_at": "..." }
    ]
  }
]
```

**Error responses:** `400 { error: "officer_id query param is required" }`, `500`

---

#### `PATCH /api/officer/jobs/:distributionId`

Update the outcome status for a given distribution. On transitions to `contacted`, `interview`, or `offer`, automatically recalculates and upserts `company_stats` for the job's company.

**Request body**
```json
{ "status": "interview", "notes": "Scheduled for 2 April" }
```

Valid `status` values: `not_started` | `contacted` | `in_progress` | `interview` | `offer` | `rejected` | `closed`

**Response:** Updated `outcomes` row.

**Error responses:** `400 { error: "status is required" }`, `500`

---

### `/api/analytics` — `routes/analytics.ts`

#### `GET /api/analytics/metrics`

Placement KPIs for the current month plus officer-level offer breakdown and 6-month distribution trend.

**Response**
```json
{
  "totalJobsSentThisMonth": 48,
  "totalOffersThisMonth": 6,
  "conversionRate": "12.5",
  "topCompanies": [
    { "company": "Infosys", "total_offers": 4, "total_distributed": 20, "conversion_rate": 20.0 }
  ],
  "jobsByStatus": {
    "not_started": 12, "contacted": 18, "interview": 8, "offer": 6, "rejected": 4
  },
  "byOfficer": { "Priya": 3, "Arjun": 2 },
  "byMonth": [
    { "month": "2025-10", "count": 30 },
    { "month": "2025-11", "count": 42 }
  ]
}
```

**Error responses:** `500 { error: string }`

---

#### `GET /api/analytics`

Legacy analytics endpoint used by the frontend Analytics page.

**Response**
```json
{
  "trends": [
    { "date": "2026-03-01", "count": 5 },
    { "date": "2026-03-02", "count": 8 }
  ],
  "skillShare": [
    { "name": "SoCSE", "value": 120 },
    { "name": "SoME", "value": 74 }
  ]
}
```

`trends` — job count per day for the last 30 days (from `posted_date`).  
`skillShare` — top 6 school codes by mapping frequency (from `job_course_mappings`).

**Error responses:** `500 { error: string }`

---

### `/api/templates` — `routes/templates.ts`

Both endpoints call an external AI service (Claude) and may take several seconds.

#### `POST /api/templates/email`

Generates a personalised outreach email for the officer to send to company HR.

**Request body**
```json
{ "jobId": "uuid", "officerId": "uuid" }
```

**Response** — AI-generated email template:
```json
{ "subject": "Placement Opportunity — ...", "body": "Dear HR Team, ..." }
```

**Error responses:** `400` (missing fields), `404` (job/officer not found), `502` (AI error)

---

#### `POST /api/templates/call-script`

Generates a structured cold-call script for a given job.

**Request body**
```json
{ "jobId": "uuid" }
```

**Response** — AI-generated call script object (structure determined by `generateCallScript`).

**Error responses:** `400 { error: "jobId is required" }`, `404`, `502`

---

### `/api/admin` — `routes/admin.ts`

#### `POST /api/admin/trigger-scrape`

Manually triggers the job scraper (`scrapeJobs()`). Useful outside the 6-hour cron window.

**Response**
```json
{ "success": true, "message": "Scrape triggered successfully" }
```

**Error responses:** `500 { error: string }`

---

#### `POST /api/admin/enrich-all`

Runs AI enrichment on up to 50 unenriched jobs (`enriched_at IS NULL`). For each job, runs three AI tasks in parallel:

1. **Fresher detection** — sets `is_fresher_friendly` on the `jobs` row
2. **Red flag detection** — sets `has_red_flags` and `red_flags[]` on the `jobs` row
3. **Course mapping** — upserts rows into `job_course_mappings` (NOT into `jobs.schools`)

Sets `enriched_at = now()` after a successful enrichment.

**Response**
```json
{ "enriched": 42, "total": 50, "errors": ["Job X (uuid): timeout"] }
```

Or if nothing to enrich:
```json
{ "enriched": 0, "message": "No unenriched jobs found" }
```

**Error responses:** `500 { error: string }`

---

#### `GET /api/admin/stats`

Snapshot stats for the admin/director overview.

**Response**
```json
{
  "totalJobs": 312,
  "todayJobs": 14,
  "bySource": { "naukri": 180, "linkedin": 132 },
  "bySchool": { "SoCSE": 142, "SoME": 88, "SoA": 60 }
}
```

`bySchool` is derived from `job_course_mappings.school_code`, not from any `jobs.schools` column.

**Error responses:** `500 { error: string }`

---

### `/api/stats` — `routes/stats.ts` *(legacy)*

#### `GET /api/stats`

Simple dashboard KPIs. Uses `posted_at` (not `posted_date`) and the `job_skills` table. Kept for legacy compatibility.

**Response**
```json
{
  "totalJobs": 312,
  "newToday": 14,
  "activeAlerts": 8,
  "topSkills": [{ "skill": "Python", "count": 45 }]
}
```

---

### `/api/alerts` — `routes/alerts.ts` *(legacy)*

#### `GET /api/alerts`

Returns all alert subscriptions sorted by creation date descending. Response is a **raw array** (no wrapper object).

```json
[
  { "id": "uuid", "email": "user@example.com", "keywords": "React,Node", "frequency": "daily", "active": true }
]
```

**Error responses:** `500 { error: string }`

---

#### `POST /api/alerts`

Creates an email alert subscription.

**Request body**
```json
{ "keywords": "React,Node.js", "email": "priya@rvu.edu.in", "frequency": "daily" }
```

`keywords`, `email`, and `frequency` are all required.

**Response:** `201` + inserted alert row.

**Error responses:** `400 { error: string }`, `500 { error: string }`

---

#### `DELETE /api/alerts/:id`

Deletes the alert with the given `id`.

**Response:** `204 No Content`

**Error responses:** `500 { error: string }`

---

## Cron Jobs — `jobs/scheduler.ts`

| Schedule | Task |
|----------|------|
| Every 6 hours | Run `scrapeJobs()` — scrape and upsert new listings |
| Daily at 08:00 | Send daily email digests to matching alert subscribers |
| Monday at 08:00 | Send weekly email digests |

---

## Frontend Reference

Base URL: `VITE_API_URL || http://localhost:4000`. All calls go through the Axios instance at `src/lib/api.ts` which prepends `/api`.

---

### `src/lib/api.ts`

Axios instance with:
- `baseURL` set to `${VITE_API_URL}/api` (falls back to `http://localhost:4000/api`)
- 10-second timeout
- Response interceptor that logs API errors to the console

---

### `src/types/index.ts`

Shared TypeScript interfaces that mirror the backend `backend/src/types/index.ts` exactly, plus frontend-specific wire types:

| Type | Description |
|------|-------------|
| `Job` | Core job row |
| `JobCourseMapping` | School-to-job mapping row |
| `CompanyContact` | HR contact row |
| `CompanyStats` | Pre-aggregated company conversion stats |
| `OutcomeStatus` | Union of all valid outcome statuses |
| `Outcome` | Placement outcome row |
| `DigestJob` | `Job` + `job_course_mappings[]` + `contacts[]` (daily-digest wire shape) |
| `DailyDigestResponse` | `{ jobs: DigestJob[], count: number }` |
| `SearchJob` | `Job` + `job_course_mappings[]` (search wire shape) |
| `SearchResponse` | `{ jobs: SearchJob[], total, page, perPage }` |
| `JobDetail` | `Job` + `course_mappings[]` + `contacts[]` + `company_stats` (detail wire shape) |
| `OfficerDistribution` | Distribution + nested job subset + outcomes (officer view) |
| `Distribution` | Full distribution + nested job + outcomes (director view) |
| `AnalyticsMetrics` | Response shape for `/api/analytics/metrics` |
| `AdminStats` | Response shape for `/api/admin/stats` |
| `JobFilters` | Search filter params object |

---

### `src/hooks/useJobs.ts`

TanStack Query hooks. All hooks return `{ data, isLoading, error, refetch }`.

#### `useDailyDigest()`

Calls `GET /api/jobs/daily-digest`. Returns `{ data: DigestJob[], count, isLoading, error, refetch }`.
- Query key: `['jobs', 'daily-digest']`
- Stale time: 5 minutes

#### `useJobs(filters: JobFilters)`

Calls `GET /api/jobs/search` with the provided filter object converted to query params. Returns `{ data: SearchJob[], total, page, perPage, isLoading, error, refetch }`.
- Query key: `['jobs', 'search', params]` — re-fetches automatically when filters change
- Stale time: 2 minutes

#### `useJob(id: string | undefined)`

Calls `GET /api/jobs/:id`. Disabled when `id` is undefined. Returns `{ data: JobDetail | null, isLoading, error, refetch }`.
- Query key: `['job', id]`
- Stale time: 5 minutes

---

### `src/components/Layout.tsx`

Persistent sidebar shell rendered for all routes except `/login`.

**Features:**
- Teal sidebar (`#0F766E`) with JIT logo and "by RVU Placements" subtitle
- Nav links: Daily Digest (`/`), Search (`/search`), Officer View (`/officer`), Director View (`/director`)
- Active route: white background, teal text
- Bottom section: user name placeholder, role badge, sign-out button
- Mobile: sidebar collapses; top bar with hamburger toggle renders below `lg` breakpoint
- Main content area scrolls independently via `overflow-y-auto`

---

### `src/components/JobCard.tsx`

Reusable card for displaying a single job. Used by `DailyDigest` and `SearchJobs`.

**Props**
| Prop | Type | Description |
|------|------|-------------|
| `job` | `Job` | Job row |
| `course_mappings` | `JobCourseMapping[]` | School mappings for this job |
| `isSelected` | `boolean` | Whether the checkbox is checked |
| `onSelect` | `(id) => void` | Checkbox toggle handler |
| `onSendToOfficer` | `(id) => void` | "Send to Officer" button handler |

**Score badge colours:**
- `>= 70` → teal
- `40–69` → yellow
- `< 40` → red

**Star rating logic:**
- `>= 80` → 5 stars
- `60–79` → 4 stars
- `40–59` → 3 stars
- `< 40` → 2 stars

**School badges** display as `<school_code> <confidence%>` (e.g. `SoCSE 92%`) sourced from `course_mappings`. Never uses a `schools` field on the job itself.

---

### `src/pages/DailyDigest.tsx` — route `/`

**API calls:**
- `useDailyDigest()` → `GET /api/jobs/daily-digest` on mount
- `POST /api/distributions/send` via `useMutation` when the send-to-officer modal is submitted

**Features:**
- Header: "Today's Top Opportunities", auto-ranked subtitle, today's date
- Refresh button to manually re-fetch
- Select-all / deselect-all controls
- Multi-select checkboxes on each `JobCard`
- Floating action bar (teal): "Send Selected to Officer" — appears only when at least one job is selected
- **Send-to-officer modal**: accepts comma-separated officer UUIDs and an optional note; posts to `/api/distributions/send` once per selected job
- Loading: animated pulse skeleton cards
- Error: centered error message with retry button
- Empty state: "No jobs scraped yet. Check back after 6 AM or trigger a manual scrape."

---

### `src/pages/SearchJobs.tsx` — route `/search`

**API calls:**
- `useJobs(filters)` → `GET /api/jobs/search` with query params; re-fetches whenever `filters` state changes

**Features:**
- Left filter sidebar (sticky): location, company, school codes (comma-separated), min score slider (0–100), job type dropdown, salary range (min/max), posted recency toggle (Any time / 7d / 30d), fresher-only checkbox
- Filters are staged in a `draft` state and only applied to the query on "Apply" click
- "Reset" clears all filters
- Results column: job count, `JobCard` list (without checkboxes), pagination (Previous / Next)
- Responsive: sidebar collapses into a column above the results on small screens

---

### `src/pages/JobDetail.tsx` — route `/jobs/:id`

**API calls:**

| Hook / Mutation | Endpoint | When triggered |
|-----------------|----------|----------------|
| `useJob(id)` | `GET /api/jobs/:id` | On mount; re-runs when `id` changes |
| `useMutation` — `SendModal` | `POST /api/distributions/send` | "Send to Officer" button |
| `useMutation` — `DraftEmailModal` | `POST /api/templates/email` — body `{ jobId, officerId }` | "Generate Email" inside modal |
| `useMutation` — `CallScriptModal` | `POST /api/templates/call-script` — body `{ jobId }` | "Generate Script" inside modal |

The response shape consumed is the flat `JobDetail` wire type — **no nested `job` object**:
```
{ id, title, company, location, job_type, experience_required,
  salary_min, salary_max, description, skills, conversion_score,
  is_fresher_friendly, has_red_flags, red_flags, source_url,
  posted_date, course_mappings[], contacts[], company_stats }
```

**Responsive layout:**
- Desktop (`lg`): two columns — left `2/3` + right `1/3`
- Mobile: single stacked column + fixed bottom action bar

---

**Left column**

**1. Header card**
- Company name + **Tier badge** (A / B / C) derived from `company_stats.conversion_rate`:
  - Tier A → `conversion_rate ≥ 25%` (green)
  - Tier B → `conversion_rate ≥ 10%` (blue)
  - Tier C → `< 10%` (grey)
  - Badge only rendered when `company_stats` is non-null
- Job title (`h1`)
- Meta chips: location, job type, experience required, posted date
- "View original" link from `source_url` (opens in new tab)

**2. Placement Intelligence card** (teal `#0F766E` gradient background)
- `conversion_score` displayed as `XX%` large number
- 5-star rating computed from score: `≥80` → 5, `≥60` → 4, `≥40` → 3, else → 2
- Likelihood label: `≥80` → "High Likelihood", `≥60` → "Good Chance", `≥40` → "Moderate Fit", `<40` → "Low Likelihood"
- **Fresher Friendly** badge (green pill) — shown when `is_fresher_friendly = true`
- **Has Red Flags** badge (red pill) — shown when `has_red_flags = true`
- Red flag chips — each string in `red_flags[]` rendered as an individual pill tag
- **School mapping badges** from `course_mappings[]`: format `<school_code> <confidence%>` (e.g. `SoCSE 92%`); tooltip shows `reasoning`
- Fallback text if `course_mappings` is empty: "School mappings will appear after AI enrichment."

**3. Job details card**
- Salary range formatted: `₹X.XL – ₹X.XL` (uses `salary_min` / `salary_max`)
- Skills chips from `skills[]`
- Full job description with **expand / collapse** toggle at 600-character threshold

---

**Right column**

**4. Contact Information** (uses `contacts[]` from API response)

Each contact rendered in a `ContactCard` showing:
- Name + role
- Confidence badge: `is_verified = true` → `100%` green + **Verified** pill; `false` → `50%` grey
- Email as `mailto:` link
- Phone as `tel:` link (if present)
- LinkedIn as external link (if present)

Empty state when `contacts.length === 0`:
> "Extracting contacts… check back soon"

**5. Action buttons** (sticky on desktop via `lg:sticky lg:top-6`)

| Button | Behaviour |
|--------|-----------|
| **Draft Email** | Opens `DraftEmailModal` — prompts for officer UUID, POSTs `{ jobId, officerId }` to `/api/templates/email`, displays AI-generated subject + body, copy-to-clipboard |
| **Call Script** | Opens `CallScriptModal` — POSTs `{ jobId }` to `/api/templates/call-script`, displays formatted AI script, copy-to-clipboard |
| **Send to Officer** | Opens `SendModal` — accepts comma-separated officer UUIDs + optional note, POSTs to `/api/distributions/send` |
| **Save** | Local toggle — fills bookmark icon; no backend call |
| **Skip** | Calls `navigate(-1)` |

Company track record card renders beneath the action buttons when `company_stats` is present (distributed, contacted, interviews, offers, conversion rate with colour coding).

**Mobile bottom bar** (fixed, `lg:hidden`): compact Email / Call Script / Send / Save buttons that open the same modals.

**States:**
- **Loading**: full-page animated pulse skeleton matching the two-column layout
- **Error / not found**: centred card with error message and "Back to Daily Digest" link

---

### `src/pages/OfficerDashboard.tsx` — route `/officer`

**API calls:**
- `GET /api/officer/jobs?officer_id=<id>` via `useQuery` — enabled only after officer ID is entered
- `PATCH /api/officer/jobs/:distributionId` via `useMutation` — called when a status button or note is saved; invalidates `['officer-jobs']` on success

**Features:**
- Officer ID entry screen (UUID input) shown before any data is loaded
- Summary stat row: Total Assigned, Offers, Interviews, In Progress
- Filter tabs by outcome status (shows counts)
- Each `DistributionCard` shows:
  - Job title (links to `/jobs/:id`), company, sent date, location/type/salary/fresher tags
  - Director note (if set)
  - Inline status button grid — clicking any status immediately calls PATCH
  - Expandable notes input — saves notes alongside the current status
- "Switch officer" link resets to the ID entry screen

---

### `src/pages/DirectorDashboard.tsx` — route `/director`

**API calls:**
- `GET /api/analytics/metrics` via `useQuery` → KPI cards and charts
- `GET /api/admin/stats` via `useQuery` → total jobs, today's jobs, bySchool chart
- `GET /api/distributions` via `useQuery` (optionally filtered by `director_id`) → distributions table
- `POST /api/admin/trigger-scrape` via `useMutation` — "Trigger Scrape" button
- `POST /api/admin/enrich-all` via `useMutation` — "Enrich All" button

**Features:**
- Header action buttons: Trigger Scrape, Enrich All (with loading states and success banners)
- KPI cards: Jobs Sent (month), Offers (month), Conversion Rate, Total Jobs
- Inline bar charts (pure Tailwind, no external chart library):
  - Outcomes by Status
  - Top 5 Officers by offers this month
  - Monthly Distribution Volume (6 months)
  - Jobs by School (from `admin/stats`)
- Top Companies table: company, distributed, offers, conversion %
- Distributions table: filterable by director UUID, shows latest outcome status per row, capped at 20 visible rows

---

### `src/pages/Login.tsx` — route `/login`

Standalone full-page login screen (does not render `Layout`).

**Features:**
- Centered card with JIT logo and "by RVU Placements" subtitle
- Email + password fields (required)
- Auth is a placeholder — on submit navigates to `/` after 800 ms

> Connect to real auth (Supabase Auth, JWT, etc.) by replacing the `setTimeout` in `handleSubmit`.

---

## Frontend Routes Summary

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | `Login` | Sign-in screen (no layout) |
| `/` | `DailyDigest` | Today's top fresher-friendly jobs |
| `/search` | `SearchJobs` | Filtered, paginated job search |
| `/jobs/:id` | `JobDetail` | Full job detail — placement intelligence, contacts, Draft Email / Call Script / Send to Officer actions |
| `/officer` | `OfficerDashboard` | Officer's assigned jobs + status updater |
| `/director` | `DirectorDashboard` | Director KPIs, charts, admin actions |
