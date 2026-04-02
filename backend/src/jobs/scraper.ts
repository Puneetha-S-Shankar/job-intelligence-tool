import { chromium, Browser, Page } from "playwright";
import axios from "axios";
import * as cheerio from "cheerio";
import { supabase } from "../db/supabase";
import {
  calculateConversionScore,
  fetchCompanyScoringStats,
} from "../services/scoringService";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface RawJob {
  title: string;
  company: string;
  location: string;
  description?: string;
  salary?: string;
  jobType?: string;
  experienceRequired?: string;
  sourceUrl: string;
  source: "linkedin" | "naukri" | "shine" | "instahire" | "company_site";
  postedDate?: Date;
  skills?: string[];
}

interface CompanyRow {
  id: string;
  name: string;
  careers_url: string;
  tier: number;
  university_id: string;
}

// ─── BROWSER LAUNCH ARGS ─────────────────────────────────────────────────────
// Shared args for every browser launch — optimised for low RAM on free tier

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",  // critical for Railway free tier RAM
  "--disable-gpu",
          // reduces RAM usage significantly
];

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true, args: BROWSER_ARGS });
}

// ─── UTILITY HELPERS ──────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function normalizeLocation(raw: string): string {
  const map: Record<string, string> = {
    "bengaluru": "Bangalore", "bengaluru, karnataka": "Bangalore",
    "bangalore urban": "Bangalore", "bangalore, karnataka": "Bangalore",
    "delhi ncr": "Delhi", "new delhi": "Delhi",
    "gurugram": "Gurgaon", "gurgaon, haryana": "Gurgaon",
  };
  return map[raw.toLowerCase().trim()] ?? raw.trim();
}

function parseSalary(raw: string): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const lpaMatch = raw.match(/(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)\s*lpa/i);
  if (lpaMatch) {
    return {
      min: Math.round(parseFloat(lpaMatch[1]) * 100000),
      max: Math.round(parseFloat(lpaMatch[2]) * 100000),
    };
  }
  const lakhMatch = raw.match(/(\d+\.?\d*)\s*[L₹]\s*[-–]\s*(\d+\.?\d*)\s*[L₹]/i);
  if (lakhMatch) {
    return {
      min: Math.round(parseFloat(lakhMatch[1]) * 100000),
      max: Math.round(parseFloat(lakhMatch[2]) * 100000),
    };
  }
  return { min: null, max: null };
}

function isFresherJob(title: string, experience: string, description: string): boolean {
  const text = `${title} ${experience} ${description}`.toLowerCase();
  const fresherKeywords = [
    "fresher", "fresh graduate", "0-1 year", "0-2 year",
    "entry level", "trainee", "graduate trainee", "junior", "associate",
    "campus hire", "0 years", "no experience",
  ];
  const seniorKeywords = [
    "senior", "lead", "manager", "director", "head of",
    "principal", "architect", "vp ", "vice president", "5+ years", "7+ years",
  ];
  const isFresher = fresherKeywords.some(k => text.includes(k));
  const isSenior = seniorKeywords.some(k => text.includes(k));
  return isFresher && !isSenior;
}

function extractSkills(description: string): string[] {
  const skillKeywords = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL",
    "MongoDB", "AWS", "Docker", "Git", "Figma", "Excel", "Power BI", "Tally",
    "GST", "AutoCAD", "Photoshop", "Illustrator", "Premiere Pro", "After Effects",
    "Machine Learning", "Data Science", "NLP", "TensorFlow", "Flutter", "Swift",
    "Kotlin", "C++", "C#", ".NET", "Spring Boot", "Django", "FastAPI",
    "Communication", "Leadership", "Research", "Legal Drafting", "Compliance",
  ];
  return skillKeywords.filter(s =>
    description.toLowerCase().includes(s.toLowerCase())
  );
}

// ─── DEDUPLICATION ────────────────────────────────────────────────────────────
// Check DB — not in-memory — so it works across scrape runs

async function jobExists(sourceUrl: string): Promise<boolean> {
  if (!sourceUrl) return false;
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("source_url", sourceUrl)
    .limit(1)
    .single();
  return !!data;
}

async function nearDuplicateExists(
  title: string, company: string, location: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .ilike("title", title)
    .ilike("company", company)
    .ilike("location", location)
    .gte("created_at", today.toISOString())
    .limit(1)
    .single();
  return !!data;
}

// ─── COMPANY AUTO-DISCOVERY ───────────────────────────────────────────────────
// When a new company is found in a job posting, add it to the companies table

async function autoAddCompany(
  companyName: string,
  careersUrl: string,
  discoveredFrom: string,
  universityId: string
): Promise<void> {
  if (!companyName || companyName.length < 2) return;

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", companyName)
    .single();

  if (existing) return;

  await supabase.from("companies").insert({
    name: companyName,
    careers_url: careersUrl || null,
    tier: 2,
    is_gcc: false,
    city: "Bangalore",
    discovered_from: discoveredFrom,
    scrape_enabled: true,
    university_id: universityId,
  });

  console.log(`[DISCOVER] New company added: ${companyName} (from ${discoveredFrom})`);
}

// ─── SAVE JOB TO DB ───────────────────────────────────────────────────────────

async function saveJob(job: RawJob, universityId: string): Promise<boolean> {
  try {
    if (job.sourceUrl && await jobExists(job.sourceUrl)) return false;
    if (await nearDuplicateExists(job.title, job.company, job.location)) return false;

    if (!isFresherJob(job.title, job.experienceRequired || "", job.description || "")) {
      return false;
    }

    const salary = parseSalary(job.salary || "");
    const skills = job.skills || extractSkills(job.description || "");
    const companyTrim = job.company.trim();
    const companyStats = await fetchCompanyScoringStats(companyTrim);
    const conversion_score = calculateConversionScore(
      {
        company: companyTrim,
        title: job.title.trim(),
        skills,
        salary_min: salary.min,
        salary_max: salary.max,
        is_fresher_friendly: true,
      },
      companyStats
    );
    console.log(
      `[SCORING] Calculated score ${conversion_score} for ${companyTrim} — ${job.title.trim()}`
    );

    await supabase.from("jobs").insert({
      title: job.title.trim(),
      company: companyTrim,
      location: normalizeLocation(job.location || "Bangalore"),
      description: job.description || "",
      experience_required: job.experienceRequired || "0-1 years",
      salary_min: salary.min,
      salary_max: salary.max,
      skills,
      source_url: job.sourceUrl,
      source: job.source,
      job_type: job.jobType || "fulltime",
      is_fresher_friendly: true,
      conversion_score,
      posted_date: job.postedDate?.toISOString() || new Date().toISOString(),
      is_active: true,
      university_id: universityId,
      // NOTE: no 'schools' column — school mappings only go in job_course_mappings
      // enrichmentService.ts handles that after this job is saved
    });

    return true;
  } catch (err: any) {
    console.error(`[SAVE] Failed to save job "${job.title}" at "${job.company}":`, err.message);
    return false;
  }
}

// ─── SOURCE 1: NAUKRI (Cheerio — server-rendered, fast) ──────────────────────

export async function scrapeNaukri(universityId: string): Promise<number> {
  const queries = [
    "fresher software engineer bangalore",
    "fresher business analyst bangalore",
    "trainee marketing bangalore",
    "fresher graphic designer bangalore",
    "fresher law associate bangalore",
    "fresher journalist bangalore",
    "fresher medical technologist bangalore",
    "fresher economics analyst bangalore",
    "fresher content writer bangalore",
    "fresher HR executive bangalore",
  ];

  let saved = 0;

  for (const query of queries) {
    try {
      const url = `https://www.naukri.com/${query.replace(/\s+/g, "-")}-jobs`;
      const html = await axios.get(url, {
        timeout: 12000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      }).then(r => r.data);

      const $ = cheerio.load(html);

      // Naukri job card selectors (as of 2026 — update if they change)
      // Collect synchronously (cheerio .each doesn't support async), then process
      const naukriJobs: { title: string; company: string; location: string; salary: string; expText: string; sourceUrl: string }[] = [];
      $(".jobTuple, .job-container, article.jobTupleHeader").each((_, el) => {
        const title    = $(el).find(".title, .jobTitle, h2").first().text().trim();
        const company  = $(el).find(".subTitle, .companyName, .company-name").first().text().trim();
        const location = $(el).find(".location, .locWdth").first().text().trim() || "Bangalore";
        const salary   = $(el).find(".salary, .sal").first().text().trim();
        const expText  = $(el).find(".experience, .exp").first().text().trim();
        const link     = $(el).find("a").first().attr("href") || "";
        const sourceUrl = link.startsWith("http") ? link : `https://www.naukri.com${link}`;
        if (title && company) naukriJobs.push({ title, company, location, salary, expText, sourceUrl });
      });

      for (const j of naukriJobs) {
        const didSave = await saveJob({
          title: j.title, company: j.company, location: normalizeLocation(j.location),
          salary: j.salary, experienceRequired: j.expText,
          sourceUrl: j.sourceUrl, source: "naukri",
        }, universityId);
        if (didSave) {
          saved++;
          await autoAddCompany(j.company, "", "naukri", universityId);
        }
      }

      await delay(2000);

    } catch (err: any) {
      console.error(`[NAUKRI] Failed for query "${query}":`, err.message);
    }
  }

  console.log(`[NAUKRI] Saved ${saved} new jobs`);
  return saved;
}

// ─── SOURCE 2: SHINE (Cheerio — server-rendered) ─────────────────────────────

export async function scrapeShine(universityId: string): Promise<number> {
  const queries = [
    "fresher-jobs-in-bangalore",
    "trainee-jobs-in-bangalore",
    "entry-level-jobs-in-bangalore",
  ];

  let saved = 0;

  for (const query of queries) {
    try {
      const html = await axios.get(`https://www.shine.com/job-search/${query}`, {
        timeout: 12000,
        headers: { "User-Agent": "Mozilla/5.0" },
      }).then(r => r.data);

      const $ = cheerio.load(html);

      // Collect synchronously (cheerio .each doesn't support async), then process
      const shineJobs: { title: string; company: string; location: string; sourceUrl: string }[] = [];
      $(".job-listing-section, .jb-body, [class*='jobCard']").each((_, el) => {
        const title    = $(el).find("h3, .job-title, [class*='title']").first().text().trim();
        const company  = $(el).find(".company-name, [class*='company']").first().text().trim();
        const location = $(el).find(".location, [class*='location']").first().text().trim() || "Bangalore";
        const link     = $(el).find("a[href*='/job/']").first().attr("href") || "";
        const sourceUrl = link.startsWith("http") ? link : `https://www.shine.com${link}`;
        if (title && company) shineJobs.push({ title, company, location, sourceUrl });
      });

      for (const j of shineJobs) {
        const didSave = await saveJob({
          title: j.title, company: j.company,
          location: normalizeLocation(j.location),
          sourceUrl: j.sourceUrl, source: "shine",
        }, universityId);
        if (didSave) {
          saved++;
          await autoAddCompany(j.company, "", "shine", universityId);
        }
      }

      await delay(2000);

    } catch (err: any) {
      console.error(`[SHINE] Failed for "${query}":`, err.message);
    }
  }

  console.log(`[SHINE] Saved ${saved} new jobs`);
  return saved;
}

// ─── SOURCE 3: LINKEDIN (Playwright — JS-rendered) ───────────────────────────

export async function scrapeLinkedIn(universityId: string): Promise<number> {
  const queries = [
    "fresher software engineer bangalore",
    "fresher business analyst bangalore",
    "entry level designer bangalore",
    "trainee finance bangalore",
    "fresher law associate bangalore",
    "fresher content writer bangalore",
    "fresher medical technology bangalore",
    "entry level marketing bangalore",
  ];

  let saved = 0;
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    });
    const page: Page = await context.newPage();

    for (const query of queries) {
      try {
        const encoded = encodeURIComponent(query);
        await page.goto(
          // f_E=1,2 = Entry level + Internship; f_TPR=r86400 = posted in last 24 hours
          `https://www.linkedin.com/jobs/search/?keywords=${encoded}&location=Bangalore%2C+Karnataka%2C+India&f_E=1,2&f_TPR=r86400`,
          { waitUntil: "networkidle", timeout: 20000 }
        );

        await page.waitForSelector(".job-search-card, .base-card", { timeout: 50000 })
          .catch(() => {});

        const jobs = await page.evaluate(() => {
          const cards = document.querySelectorAll(".job-search-card, .base-card");
          return Array.from(cards).map(card => ({
            title:      (card.querySelector(".base-search-card__title, h3") as HTMLElement)?.innerText?.trim() || "",
            company:    (card.querySelector(".base-search-card__subtitle, h4") as HTMLElement)?.innerText?.trim() || "",
            location:   (card.querySelector(".job-search-card__location") as HTMLElement)?.innerText?.trim() || "Bangalore",
            sourceUrl:  (card.querySelector("a") as HTMLAnchorElement)?.href || "",
            postedText: (card.querySelector("time") as HTMLTimeElement)?.getAttribute("datetime") || "",
          }));
        });

        for (const job of jobs) {
          if (!job.title || !job.company) continue;

          const didSave = await saveJob({
            title: job.title,
            company: job.company,
            location: normalizeLocation(job.location),
            sourceUrl: job.sourceUrl,
            source: "linkedin",
            postedDate: job.postedText ? new Date(job.postedText) : new Date(),
          }, universityId);

          if (didSave) {
            saved++;
            await autoAddCompany(job.company, "", "linkedin", universityId);
          }
        }

        await delay(4000);

      } catch (err: any) {
        console.error(`[LINKEDIN] Failed for query "${query}":`, err.message);
      }
    }

    await context.close();

  } catch (err: any) {
    console.error("[LINKEDIN] Browser error:", err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  console.log(`[LINKEDIN] Saved ${saved} new jobs`);
  return saved;
}

// ─── SOURCE 4: COMPANY CAREERS PAGES (Playwright — JS-rendered, per-company browser) ──
// Fresh browser per company — complete isolation, no "Target page closed" errors.

export async function scrapeCompanyCareerPages(universityId: string): Promise<number> {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, careers_url, tier, university_id")
    .eq("scrape_enabled", true)
    .not("careers_url", "is", null)
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error || !companies?.length) {
    console.log("[CAREERS] No companies to scrape");
    return 0;
  }

  let saved = 0;

  for (const company of companies as CompanyRow[]) {
    let browser: Browser | null = null;
    try {
      browser = await launchBrowser();

      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      });
      const page = await context.newPage();

      console.log(`[CAREERS] Scraping ${company.name}...`);

      await page.goto(company.careers_url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      await delay(2000);

      const jobs = await page.evaluate((companyName: string) => {
        const results: { title: string; company: string; sourceUrl: string; location: string }[] = [];

        const selectors = [
          "[data-testid='job']",
          "[class*='job-listing']",
          "[class*='JobListing']",
          "[class*='job-card']",
          "[class*='JobCard']",
          "[class*='position']",
          "[class*='opening']",
          "[class*='career-item']",
          "li.job",
          ".job",
        ];

        for (const sel of selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) {
            elements.forEach(el => {
              const titleEl = el.querySelector("h1, h2, h3, h4, strong, [class*='title'], [class*='Title']");
              const title = (titleEl as HTMLElement)?.innerText?.trim();
              const link = (el.querySelector("a") as HTMLAnchorElement)?.href;

              if (title && title.length > 3 && title.length < 200) {
                results.push({
                  title,
                  company: companyName,
                  sourceUrl: link || window.location.href,
                  location: "Bangalore",
                });
              }
            });
            break;
          }
        }

        return results;
      }, company.name);

      for (const job of jobs) {
        const didSave = await saveJob({
          ...job,
          source: "company_site" as const,
        }, universityId);
        if (didSave) {
          saved++;
          console.log(`[CAREERS] Saved: ${job.title} at ${company.name}`);
        }
      }

      await supabase
        .from("companies")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", company.id);

      console.log(`[CAREERS] ✓ ${company.name}: ${jobs.length} jobs found`);

      await context.close();

    } catch (err: any) {
      console.error(`[CAREERS] ✗ ${company.name}: ${err.message}`);

      // Still mark as scraped even on error so it isn't immediately retried
      await supabase
        .from("companies")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", company.id);

    } finally {
      if (browser) {
        await browser.close().catch((e) => {
          console.warn(`[CAREERS] Browser didn't close cleanly for ${company.name}:`, e.message);
        });
      }

      await delay(3000); // let RAM recover between companies
    }
  }

  console.log(`[CAREERS] ✓✓✓ Complete: Saved ${saved} jobs from company career pages`);
  return saved;
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────
// Called by scheduler.ts and the admin trigger-scrape endpoint

export async function runFullScrapingPipeline(): Promise<{
  naukri: number; shine: number; linkedin: number; careers: number; total: number;
}> {
  console.log("[PIPELINE] === STARTING SCRAPING PIPELINE ===", new Date().toISOString());

  const { data: university } = await supabase
    .from("universities")
    .select("id")
    .eq("name", "RV University")
    .single();

  if (!university) {
    console.error("[PIPELINE] RV University not found in DB. Run seed.ts first.");
    return { naukri: 0, shine: 0, linkedin: 0, careers: 0, total: 0 };
  }

  const universityId = university.id;
  const results = { naukri: 0, shine: 0, linkedin: 0, careers: 0, total: 0 };

  console.log("[PIPELINE] Step 1: Naukri + Shine discovery...");
  results.naukri = await scrapeNaukri(universityId);
  results.shine  = await scrapeShine(universityId);

  console.log("[PIPELINE] Step 2: LinkedIn discovery...");
  results.linkedin = await scrapeLinkedIn(universityId);

  console.log("[PIPELINE] Step 3: Company career pages...");
  results.careers = await scrapeCompanyCareerPages(universityId);

  results.total = results.naukri + results.shine + results.linkedin + results.careers;

  console.log("[PIPELINE] === PIPELINE COMPLETE ===");
  console.log(`[PIPELINE] Naukri: ${results.naukri} | Shine: ${results.shine} | LinkedIn: ${results.linkedin} | Careers: ${results.careers} | Total: ${results.total}`);

  return results;
}
