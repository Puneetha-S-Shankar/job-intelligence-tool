import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type {
  DailyDigestResponse,
  SearchResponse,
  JobDetail,
  JobFilters,
} from '../types'

// ---------------------------------------------------------------------------
// useDailyDigest — GET /api/jobs/daily-digest
// ---------------------------------------------------------------------------
export function useDailyDigest() {
  const { data, isLoading, error, refetch } = useQuery<DailyDigestResponse>({
    queryKey: ['jobs', 'daily-digest'],
    queryFn: async () => {
      const res = await api.get<DailyDigestResponse>('/jobs/daily-digest')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  return {
    data: data?.jobs ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

// ---------------------------------------------------------------------------
// useJobs — GET /api/jobs/search
// ---------------------------------------------------------------------------
export function useJobs(filters: JobFilters = {}) {
  const params: Record<string, string> = {}

  if (filters.schools)      params.schools = filters.schools
  if (filters.programs)    params.programs = filters.programs
  if (filters.location)     params.location = filters.location
  if (filters.company)      params.company = filters.company
  if (filters.minScore)     params.minScore = filters.minScore
  if (filters.jobType)      params.jobType = filters.jobType
  if (filters.salary_min)   params.salary_min = filters.salary_min
  if (filters.salary_max)   params.salary_max = filters.salary_max
  if (filters.posted)       params.posted = filters.posted
  if (filters.fresherOnly)  params.fresherOnly = 'true'
  if (filters.sort)         params.sort = filters.sort
  if (filters.page)         params.page = String(filters.page)
  if (filters.perPage)      params.perPage = String(filters.perPage)

  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: ['jobs', 'search', params],
    queryFn: async () => {
      const res = await api.get<SearchResponse>('/jobs/search', { params })
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })

  return {
    data: data?.jobs ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    perPage: data?.perPage ?? 20,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

// ---------------------------------------------------------------------------
// useJob — GET /api/jobs/:id
// ---------------------------------------------------------------------------
export function useJob(id: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery<JobDetail>({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await api.get<JobDetail>(`/jobs/${id}`)
      return res.data
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
