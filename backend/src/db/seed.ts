import 'dotenv/config'
import { supabase } from '../lib/supabase'
import { RVU_COMPANIES } from '../data/companies'

// ---------------------------------------------------------------------------
// Curriculum data
// ---------------------------------------------------------------------------

const RVU_CURRICULUM = {
  universityName: 'RV University',
  city: 'Bangalore',
  website: 'rvu.edu.in',
  schools: [
    {
      code: 'SoCSE',
      name: 'School of Computer Science and Engineering',
      programmes: [
        'B.Tech. (Hons.) CSE',
        'B.Sc. (Hons.) Computer Science',
        'B.C.A. (Hons.)',
        'B.C.A. (Hons.) Software Product Engineering (Kalvium)',
        'M.Tech. CSE',
      ],
      skills: [
        'Python', 'Java', 'C++', 'JavaScript', 'TypeScript', 'React', 'Node.js',
        'SQL', 'MongoDB', 'Machine Learning', 'Data Science', 'AWS', 'Docker',
        'Cybersecurity', 'System Design', 'Flutter', 'Git', 'Agile',
      ],
      jobKeywords: [
        'software engineer', 'developer', 'data scientist', 'ml engineer', 'devops',
        'full stack', 'backend', 'frontend', 'mobile developer', 'cybersecurity',
        'SDE', 'QA engineer',
      ],
    },
    {
      code: 'SoB',
      name: 'School of Business',
      programmes: [
        'BBA (Hons.)', 'BBA (Hons.) Professional', 'BBA (Hons.) Data Science',
        'B.Com (Hons.)', 'MBA',
      ],
      skills: [
        'Business Management', 'Marketing', 'Finance', 'Accounting', 'Tally', 'GST',
        'Excel', 'Power BI', 'Business Analytics', 'Digital Marketing', 'Supply Chain',
        'HR Management', 'SAP', 'Leadership',
      ],
      jobKeywords: [
        'business analyst', 'marketing executive', 'sales executive', 'HR executive',
        'finance analyst', 'accountant', 'management trainee', 'business development',
        'digital marketing', 'operations executive',
      ],
    },
    {
      code: 'SDI',
      name: 'School of Design and Innovation',
      programmes: ['B.Des. (Hons.)', 'M.Des.'],
      skills: [
        'UI Design', 'UX Design', 'Figma', 'Adobe XD', 'Photoshop', 'Illustrator',
        'InDesign', 'Product Design', 'Visual Communication', 'Typography', 'Branding',
        'Motion Graphics', 'After Effects', 'Prototyping',
      ],
      jobKeywords: [
        'UI designer', 'UX designer', 'graphic designer', 'product designer',
        'visual designer', 'motion designer', 'brand designer', 'design intern',
        'interaction designer',
      ],
    },
    {
      code: 'SoLAS',
      name: 'School of Liberal Arts and Sciences',
      programmes: [
        'B.A. (Hons.) Liberal Arts',
        'B.Sc. (Hons.) Psychology',
        'B.Sc. (Hons.) Sociology',
      ],
      skills: [
        'Research', 'Writing', 'Editing', 'Public Speaking', 'Content Creation',
        'Qualitative Research', 'Data Analysis', 'Psychology', 'Critical Thinking',
        'CSR', 'Policy Analysis',
      ],
      jobKeywords: [
        'content writer', 'researcher', 'HR analyst', 'copywriter', 'social media executive',
        'policy analyst', 'counsellor', 'NGO coordinator', 'CSR executive',
        'communications executive',
      ],
    },
    {
      code: 'SoEPP',
      name: 'School of Economics and Public Policy',
      programmes: [
        'B.A. (Hons.) Economics',
        'B.A. (Hons.) Economics and Public Policy',
        'M.A. Economics',
      ],
      skills: [
        'Econometrics', 'Macroeconomics', 'Microeconomics', 'R', 'Python', 'STATA',
        'SPSS', 'Excel', 'Financial Economics', 'Policy Analysis', 'Statistical Analysis',
        'Data Visualization',
      ],
      jobKeywords: [
        'economist', 'policy analyst', 'research analyst', 'financial analyst',
        'banking analyst', 'economic consultant', 'think tank researcher',
      ],
    },
    {
      code: 'SoL',
      name: 'School of Law',
      programmes: [
        'B.A. LL.B. (Hons.)', 'B.B.A. LL.B. (Hons.)', 'LL.B.', 'LL.M.',
      ],
      skills: [
        'Contract Law', 'Corporate Law', 'IPR', 'Cyber Law', 'Criminal Law',
        'Constitutional Law', 'Legal Research', 'Legal Drafting', 'Compliance',
        'Due Diligence', 'Arbitration', 'Litigation',
      ],
      jobKeywords: [
        'lawyer', 'legal executive', 'compliance officer', 'legal intern', 'associate',
        'legal analyst', 'paralegal', 'contract specialist', 'corporate counsel',
        'IPR analyst',
      ],
    },
    {
      code: 'SoFMCA',
      name: 'School of Film, Media and Creative Arts',
      programmes: [
        'B.A. (Hons.) Journalism and Mass Communication',
        'B.A. (Hons.) Film and Television Production',
        'B.A. (Hons.) Media Studies',
        'M.A. Mass Communication',
      ],
      skills: [
        'Journalism', 'News Writing', 'Video Editing', 'Premiere Pro', 'DaVinci Resolve',
        'Social Media Management', 'Content Strategy', 'Copywriting', 'SEO', 'PR',
        'Brand Communications', 'Podcast Production', 'Cinematography',
      ],
      jobKeywords: [
        'journalist', 'content creator', 'video editor', 'social media manager',
        'copywriter', 'PR executive', 'media executive', 'digital content', 'reporter',
        'communications',
      ],
    },
    {
      code: 'SoAHP',
      name: 'School of Allied and Healthcare Professions',
      programmes: [
        'B.Sc. Medical Laboratory Technology',
        'B.Sc. Radiology and Imaging Technology',
        'B.Sc. Optometry',
        'B.Sc. Cardiac Care Technology',
      ],
      skills: [
        'Clinical Laboratory', 'Pathology', 'Haematology', 'Microbiology', 'Radiology',
        'MRI', 'CT Scan', 'Ultrasound', 'Patient Care', 'Healthcare IT', 'EMR Systems',
        'Clinical Research',
      ],
      jobKeywords: [
        'lab technician', 'radiology technician', 'medical technologist', 'clinical researcher',
        'optometrist', 'cardiac technician', 'healthcare analyst', 'diagnostics',
      ],
    },
    {
      code: 'SCEPS',
      name: 'School for Continuing Education and Professional Studies',
      programmes: [
        'PG Diploma programmes',
        'Certificate programmes (Data Analytics, Digital Marketing, Business Management)',
        'Accelerated Masters Programmes',
      ],
      skills: [
        'Professional upskilling', 'Executive education', 'Domain certifications',
        'Leadership', 'Management', 'Applied skills',
      ],
      jobKeywords: [
        'executive trainee', 'professional development', 'management associate',
        'operations trainee',
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function upsertUniversity() {
  const { data, error } = await supabase
    .from('universities')
    .upsert(
      {
        name: RVU_CURRICULUM.universityName,
        city: RVU_CURRICULUM.city,
        website: RVU_CURRICULUM.website,
        curriculum: RVU_CURRICULUM,
      },
      { onConflict: 'name' }
    )
    .select()
    .single()

  if (error) throw new Error(`universities upsert failed: ${error.message}`)
  return data as { id: string; name: string }
}

async function upsertCompanies() {
  const rows = RVU_COMPANIES.map((c) => ({
    name: c.name,
    tier: c.tier,
    careers_url: c.careersUrl,
    schools: [...c.schools],
    city: c.city,
  }))

  const { error } = await supabase
    .from('companies')
    .upsert(rows, { onConflict: 'name' })

  if (error) throw new Error(`companies upsert failed: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedRVUData() {
  console.log('=== RVU Data Seed ===\n')

  console.log('→ Upserting university + curriculum …')
  const university = await upsertUniversity()
  console.log(`  ✓ University saved  (id: ${university.id})`)

  console.log(`\n→ Upserting ${RVU_COMPANIES.length} companies …`)
  await upsertCompanies()
  console.log(`  ✓ ${RVU_COMPANIES.length} companies saved`)

  const schoolCount = RVU_CURRICULUM.schools.length
  const programmeCount = RVU_CURRICULUM.schools.reduce(
    (acc, s) => acc + s.programmes.length,
    0
  )
  const skillCount = RVU_CURRICULUM.schools.reduce(
    (acc, s) => acc + s.skills.length,
    0
  )
  const keywordCount = RVU_CURRICULUM.schools.reduce(
    (acc, s) => acc + s.jobKeywords.length,
    0
  )

  console.log('\n=== Seed Summary ===')
  console.log(`  University : ${university.name}`)
  console.log(`  Schools    : ${schoolCount}`)
  console.log(`  Programmes : ${programmeCount}`)
  console.log(`  Skills     : ${skillCount} (across all schools)`)
  console.log(`  Keywords   : ${keywordCount} job keywords`)
  console.log(`  Companies  : ${RVU_COMPANIES.length}`)
  console.log('\nSeed complete.')
}

seedRVUData().catch((err) => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
