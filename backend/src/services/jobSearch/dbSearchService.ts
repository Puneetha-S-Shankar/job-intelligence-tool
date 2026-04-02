import { supabase } from "../../db/supabase";
import type { SearchFilters, DBSearchResult, DBJob } from "./types";

// ─── DB SEARCH SERVICE ────────────────────────────────────────────────────────
// Queries the Supabase jobs table with all supported filters.
// Extracted from GET /api/jobs/search so the route stays thin.

export async function searchJobsInDB(filters: SearchFilters): Promise<DBSearchResult> {
  const pageNum    = Math.max(1, parseInt(filters.page    ?? "1"));
  const perPageNum = Math.min(100, Math.max(1, parseInt(filters.perPage ?? "20")));
  const from = (pageNum - 1) * perPageNum;
  const to   = from + perPageNum - 1;

  // ── Step 1: resolve school filter via job_course_mappings ──────────────────
  // Schools map to jobs through the normalized join table — jobs.schools doesn't exist.
  let allowedJobIds: string[] | null = null;
  if (filters.schools) {
    const schoolList = filters.schools.split(",").map(s => s.trim()).filter(Boolean);
    if (schoolList.length > 0) {
      const { data: mappings, error: mappingError } = await supabase
        .from("job_course_mappings")
        .select("job_id")
        .in("school_code", schoolList);

      if (mappingError) throw new Error(mappingError.message);

      allowedJobIds = [...new Set((mappings ?? []).map(m => m.job_id as string))];

      if (allowedJobIds.length === 0) {
        return { jobs: [], total: 0, page: pageNum, perPage: perPageNum };
      }
    }
  }

  // ── Step 2: build jobs query with column-level filters ────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("jobs")
    .select("*, job_course_mappings(*)", { count: "exact" })
    .eq("is_active", true);

  if (allowedJobIds !== null) query = query.in("id", allowedJobIds);

  if (filters.location) {
    const locs = filters.location.split(",").map(l => l.trim()).filter(Boolean);
    if (locs.length === 1) {
      query = query.ilike("location", `%${locs[0]}%`);
    } else if (locs.length > 1) {
      query = query.or(locs.map(l => `location.ilike.%${l}%`).join(","));
    }
  }

  if (filters.company)    query = query.ilike("company", `%${filters.company}%`);
  if (filters.minScore)   query = query.gte("conversion_score", parseFloat(filters.minScore));
  if (filters.jobType) {
    // Normalise to lowercase enum value — e.g. "Internship" → "internship", "Full-time" → "fulltime"
    const normJobType = filters.jobType.toLowerCase().replace(/[^a-z]/g, "");
    query = query.eq("job_type", normJobType);
  }
  if (filters.salary_min) query = query.gte("salary_min", parseInt(filters.salary_min));
  if (filters.salary_max) query = query.lte("salary_max", parseInt(filters.salary_max));
  if (filters.fresherOnly === "true") query = query.eq("is_fresher_friendly", true);

  if (filters.posted === "7d") {
    query = query.gte("posted_date", new Date(Date.now() - 7 * 86_400_000).toISOString());
  } else if (filters.posted === "30d") {
    query = query.gte("posted_date", new Date(Date.now() - 30 * 86_400_000).toISOString());
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (filters.sort === "date") {
    query = query.order("posted_date", { ascending: false, nullsFirst: false });
  } else if (filters.sort === "salary") {
    query = query.order("salary_max", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("conversion_score", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    // PGRST103 = "Requested range not satisfiable" — requested page is beyond
    // available rows (e.g. page 2 when DB has < perPage results).
    // Return an empty page instead of crashing the whole search.
    if (error.code === "PGRST103") {
      return { jobs: [], total: 0, page: pageNum, perPage: perPageNum };
    }
    throw new Error(error.message);
  }

  return {
    jobs: (data ?? []) as DBJob[],
    total: count ?? 0,
    page: pageNum,
    perPage: perPageNum,
  };
}
