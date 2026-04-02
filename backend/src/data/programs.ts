/**
 * Canonical RVU programme catalogue for SERP queries, AI mapping, and UI filters.
 * program_id is stable; school_code matches job_course_mappings / frontend SCHOOLS.
 */

export interface RvuProgram {
  id: string
  school_code: string
  name: string
  /** Search query stems (location appended at runtime, e.g. "… bangalore") */
  serp_queries: string[]
  /** Hints for AI classification */
  keywords: string[]
}

function prog(
  id: string,
  school_code: string,
  name: string,
  serp_queries: string[],
  keywords: string[]
): RvuProgram {
  return { id, school_code, name, serp_queries, keywords }
}

export const RVU_PROGRAMS: RvuProgram[] = [
  // ── SoLAS ─────────────────────────────────────────────────────────────
  prog('solas-bsc-psychology', 'SoLAS', 'B.Sc. (Hons.) Psychology', ['fresher psychology', 'fresher research assistant psychology', 'graduate trainee psychology'], ['psychology', 'counselling', 'mental health', 'research']),
  prog('solas-bsc-environmental', 'SoLAS', 'B.Sc. (Hons.) Environmental Science', ['fresher environmental science', 'fresher sustainability analyst', 'fresher climate research'], ['environment', 'sustainability', 'climate', 'ecology']),
  prog('solas-ba-philosophy', 'SoLAS', 'B.A. (Hons.) Philosophy', ['fresher research associate humanities', 'fresher content analyst philosophy', 'graduate trainee liberal arts'], ['philosophy', 'ethics', 'critical thinking']),
  prog('solas-ba-politics', 'SoLAS', 'B.A. (Hons.) Politics and International Relations', ['fresher policy research', 'fresher international relations', 'fresher political analyst'], ['politics', 'international relations', 'policy', 'diplomacy']),
  prog('solas-msc-psychology', 'SoLAS', 'M.Sc. Psychology', ['fresher psychology researcher', 'fresher clinical psychology trainee', 'graduate psychology'], ['psychology', 'MSc psychology', 'therapist trainee']),

  // ── SoB ───────────────────────────────────────────────────────────────
  prog('sob-bba-digital-marketing', 'SoB', 'BBA (Hons.) Digital Marketing', ['fresher digital marketing', 'fresher social media marketing', 'fresher performance marketing'], ['digital marketing', 'SEO', 'SEM', 'social media']),
  prog('sob-bba-capital-marketing', 'SoB', 'BBA (Hons.) Capital Marketing', ['fresher marketing executive', 'fresher capital markets marketing', 'fresher financial marketing'], ['capital markets', 'marketing', 'BBA']),
  prog('sob-bba-business-intelligence', 'SoB', 'BBA (Hons.) Business Intelligence & Data Analytics', ['fresher business analyst', 'fresher BI analyst', 'fresher data analytics business'], ['business intelligence', 'analytics', 'Microsoft', 'Excel', 'dashboard']),
  prog('sob-bba-core', 'SoB', 'BBA (Hons.) — Finance, HR, Marketing, Analytics', ['fresher business analyst', 'fresher HR executive', 'fresher finance analyst', 'fresher marketing executive'], ['BBA', 'finance', 'HR', 'marketing', 'analytics']),
  prog('sob-bcom-core', 'SoB', 'B.Com. (Hons.) — Accounting, Taxation, Finance, Banking', ['fresher accountant', 'fresher taxation', 'fresher banking operations', 'fresher finance executive'], ['B.Com', 'accounting', 'tax', 'banking', 'GST']),
  prog('sob-bcom-acca', 'SoB', 'B.Com. (Hons.) International Accounting (ACCA)', ['fresher accountant', 'fresher audit associate', 'fresher finance trainee ACCA'], ['ACCA', 'accounting', 'audit', 'international accounting']),
  prog('sob-mba-ai-ds', 'SoB', 'MBA — AI, Data Science, Business Analytics', ['MBA fresher data science', 'fresher business analytics MBA', 'fresher AI product analyst'], ['MBA', 'data science', 'AI', 'analytics', 'Microsoft']),
  prog('sob-mba-gfm', 'SoB', 'MBA Global Financial Markets / NSE', ['MBA fresher finance', 'fresher equity research', 'fresher financial markets trainee'], ['NSE', 'financial markets', 'trading', 'equity']),
  prog('sob-mba-core', 'SoB', 'MBA — Analytics, Entrepreneurship, Finance, HR, Marketing', ['MBA fresher', 'fresher management trainee', 'fresher HR MBA', 'fresher marketing MBA'], ['MBA', 'management trainee', 'consulting', 'HR', 'marketing']),

  // ── SDI ────────────────────────────────────────────────────────────────
  prog('sdi-bdes-ux-xr', 'SDI', 'B.Des. (Hons.) UX / Digital Interactive / XR', ['fresher UX designer', 'fresher UI designer', 'fresher interaction designer', 'fresher AR VR designer'], ['UX', 'UI', 'XR', 'Figma', 'prototyping']),
  prog('sdi-bdes-interior', 'SDI', 'B.Des. (Hons.) Interior Environments', ['fresher interior designer', 'fresher spatial designer', 'fresher retail design'], ['interior design', 'spatial', 'retail']),
  prog('sdi-bdes-comm-media', 'SDI', 'B.Des. (Hons.) Communication and New Media', ['fresher graphic designer', 'fresher visual designer', 'fresher new media designer'], ['communication design', 'new media', 'branding']),
  prog('sdi-bdes-product', 'SDI', 'B.Des. (Hons.) Product / Industrial / Digital Products', ['fresher product designer', 'fresher industrial designer', 'fresher design engineer'], ['product design', 'industrial design', 'CAD']),
  prog('sdi-bdes-transdisciplinary', 'SDI', 'B.Des. (Hons.) Transdisciplinary Contexts', ['fresher designer', 'fresher design researcher', 'fresher creative technologist'], ['transdisciplinary', 'design thinking', 'innovation']),
  prog('sdi-mdes-ux', 'SDI', 'M.Des. User Experience', ['fresher UX designer', 'graduate UX researcher', 'fresher product UX'], ['M.Des', 'UX research', 'service design']),
  prog('sdi-mdes-communication', 'SDI', 'M.Des. Communication', ['fresher communication designer', 'fresher brand designer', 'fresher design lead trainee'], ['M.Des', 'communication', 'brand']),
  prog('sdi-mdes-product', 'SDI', 'M.Des. Product', ['fresher product designer', 'fresher design strategist'], ['M.Des', 'product design']),

  // ── SoEPP (Economics & Public Policy — aligned with seed) ─────────────
  prog('soepp-bsc-econ-analytics', 'SoEPP', 'B.Sc. (Hons.) Economics with Data Analytics', ['fresher economics analyst', 'fresher data analyst economics', 'fresher econometrics'], ['economics', 'data analytics', 'econometrics', 'Python', 'R']),
  prog('soepp-bsc-econ-policy', 'SoEPP', 'B.Sc. (Hons.) Economics with Development Studies & Public Policy', ['fresher policy analyst', 'fresher development sector', 'fresher economics research'], ['public policy', 'development economics', 'governance']),
  prog('soepp-msc-economics', 'SoEPP', 'M.Sc. Economics', ['fresher economist', 'fresher research analyst economics', 'graduate economics'], ['M.Sc economics', 'macro', 'micro']),
  prog('soepp-ma-public-policy', 'SoEPP', 'M.A. Public Policy and e-Governance', ['fresher policy analyst', 'fresher e-governance', 'fresher government consulting'], ['public policy', 'e-governance', 'digital government']),

  // ── SoCSE ──────────────────────────────────────────────────────────────
  prog('socse-btech-cse', 'SoCSE', 'B.Tech. (Hons.) Computer Science & Engineering', ['fresher software engineer', 'fresher developer', 'fresher backend engineer'], ['CSE', 'software', 'algorithms', 'DSA']),
  prog('socse-btech-ai-ml', 'SoCSE', 'B.Tech. (Hons.) Artificial Intelligence and Machine Learning', ['fresher ML engineer', 'fresher AI engineer', 'fresher data scientist'], ['machine learning', 'AI', 'deep learning', 'TensorFlow']),
  prog('socse-btech-dse', 'SoCSE', 'B.Tech. (Hons.) Data Science and Engineering', ['fresher data engineer', 'fresher data scientist', 'fresher big data'], ['data science', 'ETL', 'Spark', 'SQL']),
  prog('socse-btech-cloud', 'SoCSE', 'B.Tech. (Hons.) Cloud Computing', ['fresher cloud engineer', 'fresher DevOps', 'fresher AWS'], ['cloud', 'AWS', 'Azure', 'Kubernetes']),
  prog('socse-btech-cyber', 'SoCSE', 'B.Tech. (Hons.) Cyber Security', ['fresher security analyst', 'fresher cybersecurity', 'fresher SOC analyst'], ['cybersecurity', 'penetration testing', 'SIEM']),
  prog('socse-bsc-ds', 'SoCSE', 'B.Sc. (Hons.) Data Science', ['fresher data analyst', 'fresher data science', 'fresher analytics'], ['data science', 'statistics', 'Python']),
  prog('socse-bsc-cs', 'SoCSE', 'B.Sc. (Hons.) Computer Science', ['fresher software developer', 'fresher programmer', 'fresher IT'], ['computer science', 'programming', 'algorithms']),
  prog('socse-bca', 'SoCSE', 'B.C.A. (Hons.)', ['fresher software developer', 'fresher web developer', 'fresher IT support'], ['BCA', 'web development', 'Java', 'PHP']),
  prog('socse-mtech-cse', 'SoCSE', 'M.Tech. Computer Science & Engineering', ['fresher software engineer', 'fresher R&D engineer', 'graduate engineer trainee'], ['M.Tech', 'CSE', 'research']),

  // ── SoFMCA ────────────────────────────────────────────────────────────
  prog('sofmca-bsc-film', 'SoFMCA', 'B.Sc. (Hons.) Filmmaking', ['fresher film production', 'fresher assistant director', 'fresher video production'], ['filmmaking', 'cinematography', 'direction']),
  prog('sofmca-bsc-animation', 'SoFMCA', 'B.Sc. (Hons.) Animation, VFX and Gaming', ['fresher animator', 'fresher VFX artist', 'fresher game artist'], ['animation', 'VFX', 'gaming', 'Maya', 'Blender']),
  prog('sofmca-ba-media', 'SoFMCA', 'B.A. (Hons.) Media and Journalism', ['fresher journalist', 'fresher reporter', 'fresher media associate'], ['journalism', 'media', 'news', 'broadcast']),
  prog('sofmca-ba-acting', 'SoFMCA', 'B.A. Acting — Film, TV and OTT', ['fresher actor', 'fresher casting assistant', 'fresher production assistant'], ['acting', 'theatre', 'OTT', 'film']),

  // ── SoL ────────────────────────────────────────────────────────────────
  prog('sol-ballb', 'SoL', 'B.A. LL.B. (Hons.)', ['fresher law associate', 'legal intern', 'fresher compliance'], ['LLB', 'law', 'litigation', 'legal research']),
  prog('sol-bballb', 'SoL', 'B.B.A. LL.B. (Hons.)', ['fresher corporate law', 'legal intern', 'fresher compliance officer'], ['BBA LLB', 'corporate law', 'contracts']),
  prog('sol-bsc-criminology', 'SoL', 'B.Sc. (Hons.) Criminology, Cyber Law and Forensic Sciences', ['fresher cyber law', 'fresher forensic analyst', 'fresher compliance cyber'], ['criminology', 'forensics', 'cyber law']),

  // ── SoAHP ──────────────────────────────────────────────────────────────
  prog('soahp-bsc-mlt', 'SoAHP', 'B.Sc. (Hons.) Medical Laboratory Technology', ['fresher lab technician', 'fresher medical technologist', 'fresher pathology lab'], ['MLT', 'laboratory', 'pathology', 'diagnostics']),
  prog('soahp-bsc-cardiac', 'SoAHP', 'B.Sc. (Hons.) Cardiac Care Technology', ['fresher cardiac technician', 'fresher cath lab', 'fresher healthcare technician'], ['cardiac', 'ECG', 'cardiology']),
  prog('soahp-bsc-anesthesia', 'SoAHP', 'B.Sc. (Hons.) Anaesthesia and Operation Theater Technology', ['fresher OT technician', 'fresher anesthesia technician', 'fresher surgical technologist'], ['anesthesia', 'operation theater', 'surgery support']),

  // ── SCEPS (Continuing / professional — seed-aligned) ─────────────────
  prog('sceps-pg-diploma', 'SCEPS', 'PG Diploma programmes', ['fresher management trainee', 'fresher executive trainee', 'graduate trainee operations'], ['PG diploma', 'professional', 'executive']),
  prog('sceps-certificates', 'SCEPS', 'Certificate programmes', ['fresher digital marketing trainee', 'fresher data analytics trainee', 'fresher business trainee'], ['certificate', 'upskilling', 'analytics']),
  prog('sceps-accelerated-masters', 'SCEPS', 'Accelerated Masters Programmes', ['fresher management associate', 'fresher consultant trainee'], ['accelerated masters', 'management']),
]

const BY_ID: Record<string, RvuProgram> = Object.fromEntries(RVU_PROGRAMS.map((p) => [p.id, p]))

export function getProgramById(id: string): RvuProgram | undefined {
  return BY_ID[id]
}

export function getProgramsForSchool(schoolCode: string): RvuProgram[] {
  return RVU_PROGRAMS.filter((p) => p.school_code === schoolCode)
}

/** Deduped SERP stems for all programmes in the given schools (school-only search). */
export function aggregateSerpQueriesForSchools(schoolCodes: string[]): string[] {
  const set = new Set<string>()
  for (const code of schoolCodes) {
    for (const p of RVU_PROGRAMS) {
      if (p.school_code === code) {
        for (const q of p.serp_queries) set.add(q)
      }
    }
  }
  return [...set]
}

export function serpQueriesForProgramIds(programIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of programIds) {
    const p = BY_ID[id]
    if (p) for (const q of p.serp_queries) set.add(q)
  }
  return [...set]
}

/** JSON string for AI: programmes with id, school, name, keywords */
export function buildProgramsCatalogJsonForAi(): string {
  const slim = RVU_PROGRAMS.map((p) => ({
    id: p.id,
    school_code: p.school_code,
    name: p.name,
    keywords: p.keywords,
  }))
  return JSON.stringify(slim, null, 0)
}
