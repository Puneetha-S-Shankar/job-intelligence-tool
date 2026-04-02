import cron from "node-cron";
import { supabase } from "../../db/supabase";
import { runFullScrapingPipeline, saveJob } from "./scraperService";
import { searchJobsByCompanies } from "./serpApiService";

// ─── DAILY REFRESH ────────────────────────────────────────────────────────────
// Step 1 — Company-driven SERP/LinkedIn search:
//          Pull companies from DB → search LinkedIn for recent fresher openings
//          at each company → save new jobs to DB.
//          School-agnostic: companies are NOT mapped to schools.
//          Jobs get school mappings through a separate enrichment process.
//
// Step 2 — Full scraping pipeline (Playwright + Naukri + Shine + careers pages)
// Step 3 — Send daily email digest if DIRECTOR_EMAIL is set
//
// Exported so admin routes can trigger a manual run via runDailyRefresh().

export async function runDailyRefresh(): Promise<void> {
  console.log("[SCHEDULER] Daily refresh triggered:", new Date().toISOString());

  // ── Step 1: Company-driven SERP LinkedIn search ──────────────────────────────
  // Get companies from the DB and search LinkedIn for recent fresher jobs at them.
  // We cap at 20 companies per run to stay within SERP API usage limits.
  try {
    const { data: university } = await supabase
      .from("universities")
      .select("id")
      .eq("name", "RV University")
      .single();

    if (university) {
      console.log("[SCHEDULER] Step 1: Company-driven LinkedIn (SERP) refresh...");

      const { data: companies } = await supabase
        .from("companies")
        .select("name")
        .eq("scrape_enabled", true)
        .order("last_scraped_at", { ascending: true, nullsFirst: true })
        .limit(20);

      const companyNames = (companies ?? []).map((c: { name: string }) => c.name);

      if (companyNames.length > 0) {
        const liveJobs = await searchJobsByCompanies(companyNames);

        let serpSaved = 0;
        for (const job of liveJobs) {
          const saved = await saveJob(job, university.id);
          if (saved) serpSaved++;
        }
        console.log(
          `[SCHEDULER] SERP refresh: ${serpSaved} new jobs from ${companyNames.length} companies`
        );
      } else {
        console.log("[SCHEDULER] No companies found in DB — skipping SERP step");
      }
    }
  } catch (err) {
    console.error("[SCHEDULER] SERP refresh failed:", err);
  }

  // ── Step 2: Full scraping pipeline (Playwright — slower, runs after SERP) ───
  try {
    console.log("[SCHEDULER] Step 2: Full scraping pipeline...");
    const results = await runFullScrapingPipeline();
    console.log("[SCHEDULER] Scrape complete:", results);
  } catch (err) {
    console.error("[SCHEDULER] Scraping pipeline failed:", err);
  }

  // ── Step 3: Email digest ─────────────────────────────────────────────────────
  try {
    const { data: topJobs } = await supabase
      .from("jobs")
      .select("*, job_course_mappings(*)")
      .eq("is_active", true)
      .eq("is_fresher_friendly", true)
      .order("conversion_score", { ascending: false })
      .limit(20);

    if (process.env.DIRECTOR_EMAIL && topJobs?.length) {
      try {
        const { sendDailyDigest } = await import("../../jobs/emailer");
        await sendDailyDigest(process.env.DIRECTOR_EMAIL, topJobs);
        console.log("[SCHEDULER] Email sent successfully");
      } catch (emailErr) {
        console.error("[SCHEDULER] Email failed:", emailErr);
      }
    }
  } catch (err) {
    console.error("[SCHEDULER] Email digest step failed:", err);
  }
}

// ─── SCHEDULER INIT ───────────────────────────────────────────────────────────
// Called once at server boot. Registers the 6 AM cron — does not run immediately.

export function startScheduler(): void {
  cron.schedule("0 6 * * *", runDailyRefresh, {
    timezone: "Asia/Kolkata",
  });
  console.log("[JOB SEARCH] Daily scheduler initialized");
}
