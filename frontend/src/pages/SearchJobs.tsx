import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobs } from '../hooks/useJobs'
import JobCard from '../components/JobCard'
import type { JobFilters } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHOOLS = [
  { code: 'SoCSE',  label: 'SoCSE – Computer Science & Engineering' },
  { code: 'SoB',    label: 'SoB – Business' },
  { code: 'SDI',    label: 'SDI – Design & Innovation' },
  { code: 'SoLAS',  label: 'SoLAS – Liberal Arts & Sciences' },
  { code: 'SoEPP',  label: 'SoEPP – Engineering, Physics & Chem' },
  { code: 'SoL',    label: 'SoL – Law' },
  { code: 'SoFMCA', label: 'SoFMCA – Film, Media & Creative Arts' },
  { code: 'SoAHP',  label: 'SoAHP – Allied Health Professions' },
  { code: 'SCEPS',  label: 'SCEPS – Commerce, Economics & Policy' },
]

const LOCATIONS = ['Bangalore', 'Mumbai', 'Hyderabad', 'Pune', 'Delhi', 'Remote']

const JOB_TYPES = ['Full-time', 'Internship', 'Apprentice', 'Trainee']

// Maps display labels → the lowercase enum values the DB expects
const JOB_TYPE_TO_DB: Record<string, string> = {
  'Full-time':  'fulltime',
  'Internship': 'internship',
  'Apprentice': 'apprentice',
  'Trainee':    'trainee',
}
// Reverse map so we can restore the display label when reading URL params
const DB_TO_JOB_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(JOB_TYPE_TO_DB).map(([label, value]) => [value, label])
)

const SCORE_PRESETS = [
  { label: '80%+',   minScore: '80' },
  { label: '60–80%', minScore: '60' },
  { label: '40–60%', minScore: '40' },
  { label: 'Any',    minScore: ''   },
]

const SALARY_PRESETS = [
  { label: '<2L',  salary_min: '',       salary_max: '200000'  },
  { label: '2–4L', salary_min: '200000', salary_max: '400000'  },
  { label: '4–6L', salary_min: '400000', salary_max: '600000'  },
  { label: '6L+',  salary_min: '600000', salary_max: ''        },
  { label: 'Any',  salary_min: '',       salary_max: ''        },
]

const EXPERIENCE_OPTIONS = [
  { label: 'No exp required', value: 'fresher' },
  { label: '0–1 year',        value: '0-1' },
  { label: '0–2 years',       value: '0-2' },
] as const
type ExperienceValue = (typeof EXPERIENCE_OPTIONS)[number]['value'] | ''

const TIERS = [
  { label: 'Tier 1',  minScore: '70' },
  { label: 'Tier 2',  minScore: '40' },
  { label: 'Startup', minScore: '0'  },
]

const SORT_OPTIONS: { label: string; value: NonNullable<JobFilters['sort']> }[] = [
  { label: 'Conversion Score ↓', value: 'score'  },
  { label: 'Date Posted ↓',      value: 'date'   },
  { label: 'Salary ↓',           value: 'salary' },
]

const PER_PAGE = 20

// ---------------------------------------------------------------------------
// Draft state (rich UI state, uncommitted)
// ---------------------------------------------------------------------------
interface DraftFilters {
  schools: string[]
  locations: string[]
  company: string
  scorePreset: string        // '' | '40' | '60' | '80'
  tiers: string[]            // tier labels selected
  jobTypes: string[]
  experience: ExperienceValue
  salaryPreset: string       // index into SALARY_PRESETS
  posted: '7d' | '30d' | ''
  fresherOnly: boolean
  sort: NonNullable<JobFilters['sort']>
}

const DEFAULT_DRAFT: DraftFilters = {
  schools: [],
  locations: [],
  company: '',
  scorePreset: '',
  tiers: [],
  jobTypes: [],
  experience: '',
  salaryPreset: 'Any',
  posted: '',
  fresherOnly: true,
  sort: 'score',
}

// ---------------------------------------------------------------------------
// Saved searches (localStorage)
// ---------------------------------------------------------------------------
interface SavedSearch {
  id: string
  name: string
  filters: DraftFilters
  createdAt: string
}

const LS_KEY = 'jit_saved_searches'

function loadSavedSearches(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as SavedSearch[]
  } catch {
    return []
  }
}

function persistSavedSearches(items: SavedSearch[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

// ---------------------------------------------------------------------------
// URL ↔ DraftFilters conversions
// ---------------------------------------------------------------------------
function draftToParams(d: DraftFilters): Record<string, string> {
  const p: Record<string, string> = {}
  if (d.schools.length)    p.schools  = d.schools.join(',')
  if (d.locations.length)  p.location = d.locations.join(',')
  if (d.company.trim())    p.company  = d.company.trim()
  if (d.jobTypes.length)   p.jobType  = JOB_TYPE_TO_DB[d.jobTypes[0]] ?? d.jobTypes[0]
  if (d.posted)            p.posted   = d.posted
  if (d.fresherOnly || d.experience === 'fresher' || d.experience === '0-1') {
    p.fresherOnly = 'true'
  }
  if (d.sort !== 'score')  p.sort = d.sort

  // Score: tier takes precedence over scorePreset
  const effectiveScore = deriveMinScore(d)
  if (effectiveScore) p.minScore = effectiveScore

  // Salary
  const sp = SALARY_PRESETS.find((s) => s.label === d.salaryPreset)
  if (sp?.salary_min) p.salary_min = sp.salary_min
  if (sp?.salary_max) p.salary_max = sp.salary_max

  return p
}

function deriveMinScore(d: DraftFilters): string {
  // Tier selection → pick lowest minScore of selected tiers
  if (d.tiers.length > 0) {
    const scores = d.tiers
      .map((t) => TIERS.find((tier) => tier.label === t)?.minScore ?? '0')
      .map(Number)
    const lowest = Math.min(...scores)
    return lowest > 0 ? String(lowest) : ''
  }
  return d.scorePreset
}

function paramsToApiFilters(params: URLSearchParams): JobFilters {
  const p: JobFilters = { page: 1, perPage: PER_PAGE }
  if (params.get('schools'))    p.schools    = params.get('schools')!
  if (params.get('location'))   p.location   = params.get('location')!
  if (params.get('company'))    p.company    = params.get('company')!
  if (params.get('minScore'))   p.minScore   = params.get('minScore')!
  if (params.get('jobType'))    p.jobType    = params.get('jobType')!
  if (params.get('salary_min')) p.salary_min = params.get('salary_min')!
  if (params.get('salary_max')) p.salary_max = params.get('salary_max')!
  if (params.get('posted'))     p.posted     = params.get('posted') as JobFilters['posted']
  if (params.get('fresherOnly') === 'true') p.fresherOnly = true
  if (params.get('sort'))       p.sort       = params.get('sort') as JobFilters['sort']
  if (params.get('page'))       p.page       = parseInt(params.get('page')!)
  return p
}

function paramsToDraft(params: URLSearchParams): DraftFilters {
  const d: DraftFilters = { ...DEFAULT_DRAFT }
  const schools = params.get('schools')
  if (schools) d.schools = schools.split(',').filter(Boolean)
  const location = params.get('location')
  if (location) d.locations = location.split(',').filter(Boolean)
  if (params.get('company')) d.company = params.get('company')!
  const minScore = params.get('minScore')
  if (minScore) {
    const preset = SCORE_PRESETS.find((s) => s.minScore === minScore)
    d.scorePreset = preset ? minScore : ''
  }
  const jobType = params.get('jobType')
  if (jobType) d.jobTypes = [DB_TO_JOB_TYPE[jobType] ?? jobType]
  const posted = params.get('posted')
  if (posted === '7d' || posted === '30d') d.posted = posted
  if (params.get('fresherOnly') === 'true') d.fresherOnly = true
  const sort = params.get('sort')
  if (sort === 'date' || sort === 'salary') d.sort = sort
  const salaryMin = params.get('salary_min')
  const salaryMax = params.get('salary_max')
  if (salaryMin || salaryMax) {
    const match = SALARY_PRESETS.find(
      (s) => s.salary_min === (salaryMin ?? '') && s.salary_max === (salaryMax ?? '')
    )
    d.salaryPreset = match?.label ?? 'Any'
  }
  return d
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ---------------------------------------------------------------------------
// Active filter count (for mobile badge)
// ---------------------------------------------------------------------------
function countActiveFilters(d: DraftFilters): number {
  let n = 0
  if (d.schools.length)    n++
  if (d.locations.length)  n++
  if (d.company.trim())    n++
  if (d.tiers.length || d.scorePreset) n++
  if (d.jobTypes.length)   n++
  if (d.experience)        n++
  if (d.salaryPreset !== 'Any') n++
  if (d.posted)            n++
  if (!d.fresherOnly) n++ // on by default
  return n
}

// ---------------------------------------------------------------------------
// FilterSection wrapper
// ---------------------------------------------------------------------------
function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 pb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:text-gray-900"
      >
        {title}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checkbox option
// ---------------------------------------------------------------------------
function CheckOption({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-[#0F766E] focus:ring-teal-500"
      />
      <span className={`text-sm group-hover:text-gray-900 ${checked ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
        {label}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Radio option
// ---------------------------------------------------------------------------
function RadioOption({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-gray-300 text-[#0F766E] focus:ring-teal-500"
      />
      <span className={`text-sm group-hover:text-gray-900 ${checked ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
        {label}
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Filter panel content
// ---------------------------------------------------------------------------
function FilterPanelContent({
  draft, onChange,
}: {
  draft: DraftFilters
  onChange: (patch: Partial<DraftFilters>) => void
}) {
  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
  }

  return (
    <div className="space-y-4">
      {/* 1. School */}
      <FilterSection title="School">
        {SCHOOLS.map(({ code, label }) => (
          <CheckOption
            key={code}
            label={label}
            checked={draft.schools.includes(code)}
            onChange={() => onChange({ schools: toggleArr(draft.schools, code) })}
          />
        ))}
      </FilterSection>

      {/* 2. Location */}
      <FilterSection title="Location">
        {LOCATIONS.map((loc) => (
          <CheckOption
            key={loc}
            label={loc}
            checked={draft.locations.includes(loc)}
            onChange={() => onChange({ locations: toggleArr(draft.locations, loc) })}
          />
        ))}
      </FilterSection>

      {/* 3. Job Type */}
      <FilterSection title="Job Type" defaultOpen={false}>
        {JOB_TYPES.map((t) => (
          <CheckOption
            key={t}
            label={t}
            checked={draft.jobTypes.includes(t)}
            onChange={() => onChange({ jobTypes: toggleArr(draft.jobTypes, t) })}
          />
        ))}
      </FilterSection>

      {/* 4. Company Tier */}
      <FilterSection title="Company Tier" defaultOpen={false}>
        {TIERS.map(({ label }) => (
          <CheckOption
            key={label}
            label={label}
            checked={draft.tiers.includes(label)}
            onChange={() => {
              const next = toggleArr(draft.tiers, label)
              onChange({ tiers: next, scorePreset: '' }) // tier clears scorePreset
            }}
          />
        ))}
      </FilterSection>

      {/* 5. Conversion Score */}
      <FilterSection title="Conversion Score" defaultOpen={false}>
        {SCORE_PRESETS.map(({ label, minScore }) => (
          <RadioOption
            key={label}
            label={label}
            checked={draft.scorePreset === minScore && draft.tiers.length === 0}
            onChange={() => onChange({ scorePreset: minScore, tiers: [] })}
          />
        ))}
      </FilterSection>

      {/* 6. Experience */}
      <FilterSection title="Experience" defaultOpen={false}>
        <RadioOption
          label="Any"
          checked={draft.experience === ''}
          onChange={() => onChange({ experience: '' })}
        />
        {EXPERIENCE_OPTIONS.map(({ label, value }) => (
          <RadioOption
            key={value}
            label={label}
            checked={draft.experience === value}
            onChange={() => onChange({ experience: value })}
          />
        ))}
      </FilterSection>

      {/* 7. Salary */}
      <FilterSection title="Salary" defaultOpen={false}>
        {SALARY_PRESETS.map(({ label }) => (
          <RadioOption
            key={label}
            label={label}
            checked={draft.salaryPreset === label}
            onChange={() => onChange({ salaryPreset: label })}
          />
        ))}
      </FilterSection>

      {/* 8. Posted */}
      <FilterSection title="Date Posted" defaultOpen={false}>
        <RadioOption label="Anytime"     checked={draft.posted === ''} onChange={() => onChange({ posted: '' })} />
        <RadioOption label="Last 7 days" checked={draft.posted === '7d'} onChange={() => onChange({ posted: '7d' })} />
        <RadioOption label="Last 30 days" checked={draft.posted === '30d'} onChange={() => onChange({ posted: '30d' })} />
      </FilterSection>

      {/* 9. Fresher Friendly toggle */}
      <div className="pt-1">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700 font-medium">Fresher Friendly</span>
          <button
            role="switch"
            aria-checked={draft.fresherOnly}
            onClick={() => onChange({ fresherOnly: !draft.fresherOnly })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
              draft.fresherOnly ? 'bg-[#0F766E]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                draft.fresherOnly ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save Search Modal
// ---------------------------------------------------------------------------
function SaveSearchModal({
  draft,
  onSave,
  onClose,
}: {
  draft: DraftFilters
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Save This Search</h2>
        <p className="text-sm text-gray-500 mb-4">
          {countActiveFilters(draft)} filter{countActiveFilters(draft) !== 1 ? 's' : ''} active
        </p>
        <input
          type="text"
          placeholder="Search name (e.g. SoCSE + Bangalore)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function Pagination({ page, total, perPage, onPageChange }: {
  page: number
  total: number
  perPage: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  if (totalPages <= 1) return null

  // Build page list with ellipsis
  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Prev
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 text-sm rounded-lg transition-colors ${
              p === page
                ? 'bg-[#0F766E] text-white font-bold'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors flex items-center gap-1"
      >
        Next
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function JobSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-1/3" />
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SearchJobs() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Draft = uncommitted UI state
  const [draft, setDraft] = useState<DraftFilters>(() => paramsToDraft(searchParams))

  // Debounced company for auto-fire
  const debouncedCompany = useDebounce(draft.company, 300)

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Active filters come FROM the URL (single source of truth for the query)
  const activeFilters: JobFilters = useMemo(
    () => paramsToApiFilters(searchParams),
    [searchParams]
  )

  const currentPage = activeFilters.page ?? 1

  const { data: jobs, total, isLoading, error, refetch } = useJobs(activeFilters)

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Auto-apply debounced company to URL while user types
  useEffect(() => {
    // Only auto-apply if the company differs from what's in the URL
    if (debouncedCompany !== (searchParams.get('company') ?? '')) {
      const params = draftToParams({ ...draft, company: debouncedCompany })
      setSearchParams({ ...params, page: '1' }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCompany])

  const patchDraft = useCallback((patch: Partial<DraftFilters>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  function handleSearch() {
    const params = draftToParams(draft)
    setSearchParams({ ...params, page: '1' })
    setDrawerOpen(false)
  }

  function handleClear() {
    setDraft(DEFAULT_DRAFT)
    setSearchParams({})
    setDrawerOpen(false)
  }

  function handlePageChange(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSortChange(sort: NonNullable<JobFilters['sort']>) {
    setDraft((d) => ({ ...d, sort }))
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (sort !== 'score') next.set('sort', sort)
      else next.delete('sort')
      next.set('page', '1')
      return next
    })
  }

  function saveSearch(name: string) {
    const item: SavedSearch = {
      id: Date.now().toString(),
      name,
      filters: draft,
      createdAt: new Date().toISOString(),
    }
    const updated = [item, ...savedSearches].slice(0, 10) // keep latest 10
    setSavedSearches(updated)
    persistSavedSearches(updated)
    setShowSaveModal(false)
  }

  function restoreSearch(s: SavedSearch) {
    setDraft(s.filters)
    const params = draftToParams(s.filters)
    setSearchParams({ ...params, page: '1' })
  }

  function deleteSavedSearch(id: string) {
    const updated = savedSearches.filter((s) => s.id !== id)
    setSavedSearches(updated)
    persistSavedSearches(updated)
  }

  const activeFilterCount = useMemo(() => countActiveFilters(draft), [draft])

  // Sync sort dropdown with URL
  const currentSort = (searchParams.get('sort') as JobFilters['sort']) ?? 'score'

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Sticky top bar (mobile) ──────────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#0F766E] text-white text-xs font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search company…"
            value={draft.company}
            onChange={(e) => patchDraft({ company: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* ── Mobile filter drawer ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Filters</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <FilterPanelContent draft={draft} onChange={patchDraft} />
            </div>
            <div className="px-4 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Clear All
              </button>
              <button
                onClick={handleSearch}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex gap-6">

        {/* ── LEFT SIDEBAR (desktop) ────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden sticky top-6">
            {/* Sidebar header */}
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                  {activeFilterCount} active
                </span>
              )}
            </div>

            {/* Company search */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Company</label>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="e.g. Google, Infosys…"
                  value={draft.company}
                  onChange={(e) => patchDraft({ company: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-searches after typing</p>
            </div>

            {/* All other filters */}
            <div className="px-4 py-4 space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto">
              <FilterPanelContent draft={draft} onChange={patchDraft} />
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-4 pt-2 flex gap-2">
              <button
                onClick={handleSearch}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
              >
                Search
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </aside>

        {/* ── RESULTS AREA ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Page header */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Search Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isLoading
                ? 'Searching…'
                : total > 0
                ? `Showing ${total.toLocaleString()} job${total !== 1 ? 's' : ''}`
                : 'No jobs found for current filters'}
            </p>
          </div>

          {/* Saved searches chips */}
          {savedSearches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-teal-200 bg-teal-50 hover:bg-teal-100 text-xs text-teal-800 font-medium transition-colors"
                >
                  <button
                    onClick={() => restoreSearch(s)}
                    className="leading-none"
                    title="Restore search"
                  >
                    <svg className="w-3 h-3 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    {s.name}
                  </button>
                  <button
                    onClick={() => deleteSavedSearch(s.id)}
                    className="ml-1 p-0.5 rounded-full hover:bg-teal-200 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Remove saved search"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Results bar: sort + save */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">Sort:</label>
              <select
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value as NonNullable<JobFilters['sort']>)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save This Search
            </button>
          </div>

          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.schools && activeFilters.schools.split(',').map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-800 font-medium">
                  {s}
                </span>
              ))}
              {activeFilters.location && activeFilters.location.split(',').map((l) => (
                <span key={l} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                  {l}
                </span>
              ))}
              {activeFilters.company && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-medium">
                  Co: {activeFilters.company}
                </span>
              )}
              {activeFilters.minScore && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">
                  Score ≥{activeFilters.minScore}
                </span>
              )}
              {activeFilters.jobType && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 font-medium">
                  {activeFilters.jobType}
                </span>
              )}
              {activeFilters.fresherOnly && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 font-medium">
                  Fresher Friendly
                </span>
              )}
              <button
                onClick={handleClear}
                className="px-2 py-0.5 rounded-full text-xs text-gray-500 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <JobSkeleton key={i} />)}
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-200">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-medium text-gray-700">Failed to load results</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 text-sm text-white bg-[#0F766E] rounded-lg hover:bg-teal-700">
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700">No jobs found for current filters</h3>
              <p className="text-sm text-gray-400 mt-1">Try removing some filters or broadening your search</p>
              <button onClick={handleClear} className="mt-4 text-sm text-teal-600 underline hover:text-teal-800">
                Clear all filters
              </button>
            </div>
          )}

          {/* Job cards */}
          {!isLoading && !error && jobs.length > 0 && (
            <>
              <div className="space-y-4">
                {jobs.map((job) => {
                  // When a school filter is active, only show badges for the
                  // selected schools so the user isn't confused by cross-tagged jobs
                  // showing badges for schools they didn't filter by.
                  const selectedSchools = activeFilters.schools?.split(',').filter(Boolean) ?? []
                  const visibleMappings = selectedSchools.length > 0
                    ? job.job_course_mappings.filter(m => selectedSchools.includes(m.school_code))
                    : job.job_course_mappings

                  return (
                    <JobCard
                      key={job.id}
                      job={job}
                      course_mappings={visibleMappings}
                    />
                  )
                })}
              </div>
              <Pagination
                page={currentPage}
                total={total}
                perPage={PER_PAGE}
                onPageChange={handlePageChange}
              />
              <p className="text-xs text-gray-400 text-center mt-2">
                Page {currentPage} of {totalPages} · {total.toLocaleString()} results
              </p>
            </>
          )}
        </div>
      </div>

      {/* Save Search Modal */}
      {showSaveModal && (
        <SaveSearchModal
          draft={draft}
          onSave={saveSearch}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}
