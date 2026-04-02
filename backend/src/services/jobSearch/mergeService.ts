import type { DBJob, RawJob } from "./types";

// ─── MERGE SERVICE ────────────────────────────────────────────────────────────
// Deduplicates and merges DB jobs + live SERP RawJobs into a single sorted list.

// ── Normalise a string for fuzzy comparison ───────────────────────────────────
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// ── Build a dedup key: title+company (both normalised) ────────────────────────
function dedupKey(title: string, company: string): string {
  return `${normalise(title)}::${normalise(company)}`;
}

// ── Convert a RawJob (from SERP) into a shape compatible with DBJob ───────────
// realId: the actual DB job ID if the job was saved/found in DB.
//   - When provided: job behaves like a full DB job ("View Details" + "Send to Officer" enabled)
//   - When null: job is truly live-only ("View Source" only, "Send to Officer" disabled)
function rawJobToDBJob(
  raw: RawJob,
  idx: number,
  schoolCodes: string[],
  realId: string | null
): DBJob {
  const jobId = realId ?? `live_${idx}`;
  const isLive = !realId;
  const now = new Date().toISOString();

  const job_course_mappings = schoolCodes.map((code, ci) => ({
    id: `${jobId}_${ci}`,
    job_id: jobId,
    school_code: code,
    school_name: null,
    confidence: 0.5,
    reasoning: "Matched via live SERP search for this school",
    created_at: now,
  }));

  return {
    id: jobId,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    description: raw.description ?? "",
    job_course_mappings,
    source_url: raw.sourceUrl,
    source: raw.source,
    job_type: raw.jobType ?? "fulltime",
    salary_min: null,
    salary_max: null,
    skills: raw.skills ?? [],
    experience_required: raw.experienceRequired ?? "0-1 years",
    is_fresher_friendly: true,
    conversion_score: 40,
    posted_date: raw.postedDate?.toISOString() ?? now,
    is_active: true,
    _isLive: isLive,
  } as DBJob;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export interface MergeResult {
  jobs: DBJob[];
  liveCount: number;
}

// schoolCodes: the school filter(s) that triggered this search.
// savedIds: real DB IDs returned by saveJobGetId for each liveJob (index-aligned).
//   Jobs with a real ID get full functionality; others are view-source only.
export function mergeAndDedupe(
  dbJobs: DBJob[],
  liveJobs: RawJob[],
  schoolCodes: string[] = [],
  savedIds: (string | null)[] = []
): MergeResult {
  // Build a set of dedup keys from DB jobs (they're ground truth)
  const seen = new Set<string>();
  const seenUrls = new Set<string>();

  for (const job of dbJobs) {
    seen.add(dedupKey(String(job.title), String(job.company)));
    if (job.source_url) seenUrls.add(String(job.source_url));
  }

  const liveDBJobs: DBJob[] = [];
  let liveCount = 0;

  for (let i = 0; i < liveJobs.length; i++) {
    const raw = liveJobs[i];
    const realId = savedIds[i] ?? null;

    // URL-exact dedup (skip jobs already returned by the DB query)
    if (raw.sourceUrl && seenUrls.has(raw.sourceUrl)) continue;

    // Title+company fuzzy dedup
    const key = dedupKey(raw.title, raw.company);
    if (seen.has(key)) continue;

    seen.add(key);
    if (raw.sourceUrl) seenUrls.add(raw.sourceUrl);

    liveDBJobs.push(rawJobToDBJob(raw, i, schoolCodes, realId));
    liveCount++;
  }

  // DB jobs first (higher quality, enriched), live jobs appended after
  return {
    jobs: [...dbJobs, ...liveDBJobs],
    liveCount,
  };
}
