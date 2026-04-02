import axios from "axios";
import { supabase } from "../../db/supabase";
import type { RawJob, SearchFilters } from "./types";

// ─── SCHOOL → SEARCH QUERY MAPPING ───────────────────────────────────────────
// Maps RVU school codes to relevant fresher job search terms.
// When a school filter is applied, only these queries run — keeping SERP usage low.

// Keys must match the school codes used in the frontend SCHOOLS array and stored
// in job_course_mappings.school_code — these are RVU-specific codes.
const SCHOOL_QUERY_MAP: Record<string, string[]> = {
  // School of Computer Science & Engineering
  SoCSE: [
    "fresher software engineer bangalore",
    "fresher developer bangalore",
    "fresher data analyst bangalore",
    "fresher data scientist bangalore",
    "fresher ML engineer bangalore",
  ],
  // School of Business
  SoB: [
    "fresher business analyst bangalore",
    "management trainee bangalore",
    "MBA fresher bangalore",
    "fresher operations executive bangalore",
    "fresher marketing executive bangalore",
    "fresher finance analyst bangalore",
  ],
  // School of Design & Innovation
  SDI: [
    "fresher UI UX designer bangalore",
    "fresher graphic designer bangalore",
    "fresher product designer bangalore",
    "fresher industrial designer bangalore",
  ],
  // School of Liberal Arts & Sciences
  SoLAS: [
    "fresher content writer bangalore",
    "fresher research analyst bangalore",
    "fresher HR executive bangalore",
    "fresher social media executive bangalore",
    "fresher communications associate bangalore",
  ],
  // School of Engineering, Physics & Chemistry
  SoEPP: [
    "fresher electronics engineer bangalore",
    "fresher embedded systems bangalore",
    "fresher VLSI engineer bangalore",
    "fresher mechanical engineer bangalore",
    "fresher chemical engineer bangalore",
    "fresher electrical engineer bangalore",
  ],
  // School of Law
  SoL: [
    "fresher law associate bangalore",
    "legal trainee bangalore",
    "fresher compliance officer bangalore",
    "fresher legal analyst bangalore",
  ],
  // School of Film, Media & Creative Arts
  SoFMCA: [
    "fresher journalist bangalore",
    "fresher media associate bangalore",
    "fresher video editor bangalore",
    "fresher content creator bangalore",
    "fresher copywriter bangalore",
  ],
  // School of Allied Health Professions
  SoAHP: [
    "fresher healthcare associate bangalore",
    "fresher clinical researcher bangalore",
    "fresher medical technologist bangalore",
    "fresher hospital administrator bangalore",
  ],
  // School of Commerce, Economics & Policy Studies
  SCEPS: [
    "fresher economics analyst bangalore",
    "fresher financial analyst bangalore",
    "fresher research analyst bangalore",
    "fresher policy analyst bangalore",
    "fresher accountant bangalore",
    "fresher CA trainee bangalore",
  ],
};

// Default queries used when no school filter is applied
const DEFAULT_QUERIES = [
  "fresher jobs bangalore",
  "entry level jobs bangalore",
  "graduate trainee bangalore",
  "fresher software engineer bangalore",
  "fresher business analyst bangalore",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function normalizeLocation(raw: string): string {
  const map: Record<string, string> = {
    "bengaluru": "Bangalore", "bengaluru, karnataka": "Bangalore",
    "bangalore urban": "Bangalore", "bangalore, karnataka": "Bangalore",
    "delhi ncr": "Delhi", "new delhi": "Delhi",
    "gurugram": "Gurgaon", "gurgaon, haryana": "Gurgaon",
  };
  return map[raw.toLowerCase().trim()] ?? raw.trim();
}

// Map SerpAPI "posted_at" strings to a Date object
function parsePostedAt(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const now = Date.now();
  if (lower.includes("hour") || lower.includes("just now")) return new Date(now - 3_600_000);
  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) return new Date(now - parseInt(daysMatch[1]) * 86_400_000);
  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) return new Date(now - parseInt(weeksMatch[1]) * 7 * 86_400_000);
  return undefined;
}

// ─── NORMALIZE SERP RESULT → RawJob ──────────────────────────────────────────

function normalizeSerpJob(raw: Record<string, any>): RawJob | null {
  const title = raw.title?.trim();
  const company = raw.company_name?.trim();
  if (!title || !company) return null;

  const ext = raw.detected_extensions ?? {};
  // Prefer real apply URL; fall back to Google search only when we have no link.
  // (Previous `|| ... ? ... : ""` bound wrong — it often replaced real links.)
  const applyLink: string =
    raw.apply_options?.[0]?.link?.trim() ||
    (raw.job_id
      ? `https://www.google.com/search?q=${encodeURIComponent(title + " " + company)}`
      : "");

  const descParts: string[] = [];
  if (raw.description) descParts.push(raw.description);
  const highlights = raw.job_highlights ?? {};
  for (const key of Object.keys(highlights)) {
    if (Array.isArray(highlights[key])) {
      descParts.push(`${key}: ${(highlights[key] as string[]).join(", ")}`);
    }
  }

  return {
    title,
    company,
    location: normalizeLocation(raw.location ?? "Bangalore"),
    description: descParts.join("\n\n") || undefined,
    salary: ext.salary ?? undefined,
    jobType: ext.schedule_type?.toLowerCase().includes("full") ? "fulltime"
      : ext.schedule_type?.toLowerCase().includes("intern") ? "internship"
      : undefined,
    experienceRequired: ext.work_from_home ? undefined : "0-2 years",
    sourceUrl: applyLink,
    source: "serp",
    postedDate: parsePostedAt(ext.posted_at),
  };
}

// ─── RESOLVE SCHOOL CODES → QUERIES ──────────────────────────────────────────
// When schools filter is applied, resolve their courses from DB curriculum
// to build relevant SERP queries. Falls back to static map if DB lookup fails.

async function resolveQueriesForSchools(
  schoolCodes: string[],
  baseLocation: string
): Promise<string[]> {
  const queries = new Set<string>();

  // Try to get curriculum from DB for richer keyword expansion
  try {
    const { data: uni } = await supabase
      .from("universities")
      .select("curriculum")
      .limit(1)
      .single();

    if (uni?.curriculum) {
      const curriculum = uni.curriculum as Record<string, any>;
      for (const code of schoolCodes) {
        const school = curriculum[code];
        if (school?.courses) {
          for (const course of school.courses as string[]) {
            queries.add(`fresher ${course.toLowerCase()} ${baseLocation}`);
          }
        }
      }
    }
  } catch {
    // DB lookup failed — fall back to static map below
  }

  // Always supplement with static map entries.
  // Match directly on code — keys are RVU-format (SoCSE, SoB, …), not uppercase.
  for (const code of schoolCodes) {
    const staticQueries = SCHOOL_QUERY_MAP[code];
    if (staticQueries) {
      for (const q of staticQueries) queries.add(q);
    }
  }

  // If nothing resolved, use defaults
  if (queries.size === 0) {
    for (const q of DEFAULT_QUERIES) queries.add(q);
  }

  return [...queries];
}

// ─── COMPANY-BASED LINKEDIN SEARCH (used by daily scheduler) ─────────────────
// For each company in our DB, searches LinkedIn for recent fresher openings.
// This is school-agnostic — it's driven by companies we already track.

export async function searchJobsByCompanies(
  companyNames: string[],
  location = "Bangalore",
): Promise<RawJob[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.warn("[SERP] SERP_API_KEY not set — skipping company search");
    return [];
  }

  const allJobs: RawJob[] = [];
  const seenUrls = new Set<string>();

  for (const company of companyNames) {
    const query = `${company} fresher jobs ${location}`;
    try {
      const { data } = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_jobs",
          q: query,
          location: `${location}, Karnataka, India`,
          chips: "date_posted:month",
          api_key: apiKey,
          num: 5,
        },
        timeout: 30000,
      });

      for (const raw of (data.jobs_results ?? []) as Record<string, any>[]) {
        const job = normalizeSerpJob(raw);
        if (!job) continue;
        if (job.sourceUrl && seenUrls.has(job.sourceUrl)) continue;
        if (job.sourceUrl) seenUrls.add(job.sourceUrl);
        allJobs.push(job);
      }

      await new Promise(r => setTimeout(r, 1200));
    } catch (err: any) {
      console.error(`[SERP] Company search failed for "${company}":`, err.message);
    }
  }

  console.log(`[SERP] ${allJobs.length} jobs fetched for ${companyNames.length} companies`);
  return allJobs;
}

// ─── MAIN EXPORT: searchLinkedInJobs ─────────────────────────────────────────
// Calls SerpAPI Google Jobs engine and returns normalised RawJob[].
// "LinkedIn" in the name reflects the intent (jobs from LinkedIn via SERP);
// the underlying engine is Google Jobs which surfaces LinkedIn postings.

export async function searchLinkedInJobs(filters: SearchFilters): Promise<RawJob[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.warn("[SERP] SERP_API_KEY not set — skipping live search");
    return [];
  }

  const baseLocation = filters.location?.split(",")[0]?.trim() || "Bangalore";

  // Resolve queries based on school filter or use defaults
  const schoolCodes = filters.schools
    ? filters.schools.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const queries = schoolCodes.length > 0
    ? await resolveQueriesForSchools(schoolCodes, baseLocation)
    : DEFAULT_QUERIES;

  // Build date chip: if posted filter is applied, match it
  let dateChip = "date_posted:month";
  if (filters.posted === "7d")  dateChip = "date_posted:week";
  if (filters.posted === "30d") dateChip = "date_posted:month";

  const allJobs: RawJob[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const { data } = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_jobs",
          q: query,
          location: `${baseLocation}, Karnataka, India`,
          chips: dateChip,
          api_key: apiKey,
          num: 10,
        },
        timeout: 50000,
      });

      const results: Record<string, any>[] = data.jobs_results ?? [];

      for (const raw of results) {
        const job = normalizeSerpJob(raw);
        if (!job) continue;
        // Dedup within this batch by URL
        if (job.sourceUrl && seenUrls.has(job.sourceUrl)) continue;
        if (job.sourceUrl) seenUrls.add(job.sourceUrl);
        allJobs.push(job);
      }

    } catch (err: any) {
      console.error(`[SERP] Failed for query "${query}":`, err.message);
    }
  }

  console.log(`[SERP] ${allJobs.length} live jobs fetched from SerpAPI`);
  return allJobs;
}
