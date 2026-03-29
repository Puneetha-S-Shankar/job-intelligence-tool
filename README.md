# Job Intelligence Tool

A full-stack monorepo that scrapes job listings, surfaces market insights with charts, and delivers personalised email digests — all powered by Supabase, Recharts, and Claude AI.

---

## Tech Stack

| Layer    | Technologies |
|----------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, TanStack Query v5, React Hook Form + Zod, Recharts, Axios |
| Backend  | Node.js, Express 5, TypeScript, Supabase JS, node-cron, Axios, SendGrid, dotenv, cors, helmet |
| Database | Supabase (Postgres) |

---

## Project Structure

```
job-intelligence-tool/
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── components/     # Shared UI components (Layout, etc.)
│   │   ├── pages/          # Route-level pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Jobs.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Alerts.tsx
│   │   ├── lib/
│   │   │   └── api.ts      # Axios instance
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/                # Express REST API
│   ├── src/
│   │   ├── routes/         # Express routers
│   │   │   ├── jobs.ts
│   │   │   ├── stats.ts
│   │   │   ├── analytics.ts
│   │   │   └── alerts.ts
│   │   ├── jobs/           # Cron workers
│   │   │   ├── scheduler.ts
│   │   │   ├── scraper.ts
│   │   │   └── emailer.ts
│   │   ├── lib/
│   │   │   └── supabase.ts # Supabase client
│   │   ├── app.ts
│   │   └── index.ts
│   ├── .env.example
│   └── tsconfig.json
│
├── package.json            # Root — runs both via concurrently
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
# Edit backend/.env with your credentials
```

Required variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon or service-role key |
| `CLAUDE_API_KEY` | Anthropic Claude API key |
| `SENDGRID_API_KEY` | SendGrid API key for email alerts |
| `EMAIL_FROM` | Sender email address |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Backend port (default `3001`) |

### 3. Set up Supabase tables

Create the following tables in your Supabase project:

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  title text not null,
  company text,
  location text,
  description text,
  url text,
  posted_at timestamptz
);

create table job_skills (
  id uuid primary key default gen_random_uuid(),
  job_external_id text references jobs(external_id),
  skill text,
  unique (job_external_id, skill)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  keywords text not null,
  frequency text check (frequency in ('daily','weekly')),
  active boolean default true,
  created_at timestamptz default now()
);
```

### 4. Run in development

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3001/api  
- Health check: http://localhost:3001/health

### 5. Build for production

```bash
npm run build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard KPIs |
| GET | `/api/jobs` | Paginated job list |
| GET | `/api/jobs/:id` | Single job detail |
| GET | `/api/analytics` | Trend & skill distribution data |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |
| DELETE | `/api/alerts/:id` | Remove an alert |

---

## Cron Jobs

| Schedule | Task |
|----------|------|
| Every 6 hours | Scrape & upsert new job listings |
| Daily at 08:00 | Send daily email digests |
| Monday at 08:00 | Send weekly email digests |
