// ─── SHARED TYPES FOR JOB SEARCH PIPELINE ────────────────────────────────────
// Single source of truth for all types used across scraperService,
// serpApiService, dbSearchService, mergeService, and index.ts

// ── Raw job coming out of any scraping / SERP source ─────────────────────────
export interface RawJob {
  title: string;
  company: string;
  location: string;
  description?: string;
  salary?: string;
  jobType?: string;
  experienceRequired?: string;
  sourceUrl: string;
  source: "linkedin" | "naukri" | "shine" | "instahire" | "company_site" | "serp";
  postedDate?: Date;
  skills?: string[];
}

// ── Filters passed from the frontend / route handler ─────────────────────────
// These mirror the query params on GET /api/jobs/search
export interface SearchFilters {
  query?: string;
  schools?: string;        // comma-separated school codes e.g. "CSE,MBA"
  location?: string;       // comma-separated e.g. "Bangalore,Hyderabad"
  company?: string;
  minScore?: string;       // numeric string
  jobType?: string;        // "fulltime" | "internship" | "parttime"
  salary_min?: string;     // numeric string (INR)
  salary_max?: string;
  posted?: string;         // "7d" | "30d" | "all"
  fresherOnly?: string;    // "true" | "false"
  sort?: string;           // "score" | "date" | "salary"
  page?: string;
  perPage?: string;
}

// ── Response shape returned from searchJobs() and the /search route ──────────
export interface SearchResponse {
  jobs: DBJob[];
  total: number;
  page: number;
  perPage: number;
  liveCount: number;   // how many jobs came from SERP (not cached in DB)
  source: "db" | "db+live";
}

// ── Minimal DB job shape (full row from Supabase) ────────────────────────────
// Kept loose so it matches whatever Supabase returns without a generated schema
export type DBJob = Record<string, unknown> & {
  id: string;
  title: string;
  company: string;
  location: string;
  source_url?: string;
};

// ── Result coming back from dbSearchService ───────────────────────────────────
export interface DBSearchResult {
  jobs: DBJob[];
  total: number;
  page: number;
  perPage: number;
}
