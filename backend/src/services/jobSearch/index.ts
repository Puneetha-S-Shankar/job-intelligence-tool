// ─── JOB SEARCH MASTER ORCHESTRATOR ──────────────────────────────────────────
// Layer 1 — Live search (called on user click via GET /api/jobs/search)
//
// Flow:
//   1. Query DB with all applied filters  → fast, cached results
//   2. Parallel: call SERP API with same filters → live results
//   3. Save any new SERP jobs to DB (fire-and-forget)
//   4. Merge + deduplicate DB + live results
//   5. Return unified response
//
// No Playwright. No Cheerio. No scraping on user click.

import { supabase } from "../../db/supabase";
import { searchJobsInDB } from "./dbSearchService";
import { searchLinkedInJobs } from "./serpApiService";
import { mergeAndDedupe } from "./mergeService";
import { saveJobGetId } from "./scraperService";
import type { SearchFilters, SearchResponse } from "./types";

// Re-export everything useful for external consumers
export { runFullScrapingPipeline } from "./scraperService";
export type { SearchFilters, SearchResponse } from "./types";

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function searchJobs(filters: SearchFilters): Promise<SearchResponse> {
  // Resolve school codes upfront — used for SERP tagging, school badge display, and DB mapping
  const schoolCodes = filters.schools?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

  // Run DB query, SERP fetch, and university ID lookup all concurrently
  const [dbResult, liveJobs, universityId] = await Promise.all([
    searchJobsInDB(filters),
    searchLinkedInJobs(filters),
    getUniversityId(),
  ]);

  // Save SERP jobs to DB in parallel and capture their real DB IDs.
  // Awaiting here (instead of fire-and-forget) means every job in the response
  // carries a real DB ID, so "Send to Officer" and "View Details" work immediately
  // without requiring the user to refresh.
  let savedIds: (string | null)[] = new Array(liveJobs.length).fill(null);
  if (liveJobs.length > 0 && !universityId) {
    console.warn(
      "[searchJobs] No university ID (RV University row missing?) — SERP jobs cannot be persisted; UI will show live_* IDs only.",
    );
  }
  if (universityId && liveJobs.length > 0) {
    savedIds = await Promise.all(
      liveJobs.map(job => saveJobGetId(job, universityId, schoolCodes).catch(() => null))
    );
  }

  const { jobs, liveCount } = mergeAndDedupe(dbResult.jobs, liveJobs, schoolCodes, savedIds);

  return {
    jobs,
    total: dbResult.total + liveCount,
    page: dbResult.page,
    perPage: dbResult.perPage,
    liveCount,
    source: liveCount > 0 ? "db+live" : "db",
  };
}

// ── Cached university ID lookup ───────────────────────────────────────────────
let _cachedUniversityId: string | null = null;

async function getUniversityId(): Promise<string | null> {
  if (_cachedUniversityId) return _cachedUniversityId;
  const { data } = await supabase
    .from("universities")
    .select("id")
    .eq("name", "RV University")
    .single();
  _cachedUniversityId = data?.id ?? null;
  return _cachedUniversityId;
}
