import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import type { AnalyticsMetrics, AdminStats, Distribution } from '../types'

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'teal' | 'green' | 'blue' | 'purple'
}

function StatCard({ label, value, sub, accent = 'teal' }: StatCardProps) {
  const colors = {
    teal: 'text-teal-700',
    green: 'text-green-700',
    blue: 'text-blue-700',
    purple: 'text-purple-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${colors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline bar chart (pure Tailwind, no recharts needed for simple bars)
// ---------------------------------------------------------------------------
interface BarChartProps {
  data: Array<{ label: string; value: number }>
  color?: string
}

function SimpleBarChart({ data, color = 'bg-teal-500' }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className={`${color} h-2 rounded-full transition-all`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function DirectorDashboard() {
  const [directorId, setDirectorId] = useState('')
  const [inputId, setInputId] = useState('')

  const metricsQuery = useQuery<AnalyticsMetrics>({
    queryKey: ['analytics-metrics'],
    queryFn: async () => {
      const res = await api.get<AnalyticsMetrics>('/analytics/metrics')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const statsQuery = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get<AdminStats>('/admin/stats')
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const distributionsQuery = useQuery<Distribution[]>({
    queryKey: ['distributions', directorId],
    queryFn: async () => {
      const res = await api.get<Distribution[]>('/distributions', {
        params: directorId ? { director_id: directorId } : undefined,
      })
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; message: string }>('/admin/trigger-scrape')
      return res.data
    },
  })

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ enriched: number; total: number; errors: string[] }>(
        '/admin/enrich-all'
      )
      return res.data
    },
  })

  const m = metricsQuery.data
  const s = statsQuery.data
  const dists = distributionsQuery.data ?? []
  const isLoading = metricsQuery.isLoading || statsQuery.isLoading

  const statusBreakdown = m?.jobsByStatus
    ? Object.entries(m.jobsByStatus)
        .sort(([, a], [, b]) => b - a)
        .map(([label, value]) => ({ label, value }))
    : []

  const officerPerf = m?.byOfficer
    ? Object.entries(m.byOfficer)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([label, value]) => ({ label, value }))
    : []

  const bySchool = s?.bySchool
    ? Object.entries(s.bySchool)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([label, value]) => ({ label, value }))
    : []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Director Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Placement performance overview</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scrapeMutation.mutate()}
            disabled={scrapeMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {scrapeMutation.isPending ? 'Scraping…' : 'Trigger Scrape'}
          </button>
          <button
            onClick={() => enrichMutation.mutate()}
            disabled={enrichMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {enrichMutation.isPending ? 'Enriching…' : 'Enrich All'}
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {scrapeMutation.isSuccess && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {scrapeMutation.data.message}
        </div>
      )}
      {enrichMutation.isSuccess && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Enriched {enrichMutation.data.enriched} / {enrichMutation.data.total} jobs
          {enrichMutation.data.errors.length > 0 &&
            ` (${enrichMutation.data.errors.length} errors)`}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Jobs Sent (Month)"
              value={m?.totalJobsSentThisMonth ?? 0}
              accent="teal"
            />
            <StatCard
              label="Offers (Month)"
              value={m?.totalOffersThisMonth ?? 0}
              accent="green"
            />
            <StatCard
              label="Conversion Rate"
              value={`${m?.conversionRate ?? '0.0'}%`}
              sub="Sent → Offer"
              accent="blue"
            />
            <StatCard
              label="Total Jobs"
              value={s?.totalJobs ?? 0}
              sub={`${s?.todayJobs ?? 0} today`}
              accent="purple"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Status breakdown */}
            {statusBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Outcomes by Status
                </h2>
                <SimpleBarChart data={statusBreakdown} color="bg-teal-500" />
              </div>
            )}

            {/* Officer performance */}
            {officerPerf.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Top Officers (Offers this Month)
                </h2>
                <SimpleBarChart data={officerPerf} color="bg-green-500" />
              </div>
            )}

            {/* Monthly trend */}
            {m?.byMonth && m.byMonth.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Monthly Distribution Volume
                </h2>
                <SimpleBarChart
                  data={m.byMonth.map((b) => ({ label: b.month, value: b.count }))}
                  color="bg-blue-500"
                />
              </div>
            )}

            {/* School distribution */}
            {bySchool.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Jobs by School
                </h2>
                <SimpleBarChart data={bySchool} color="bg-purple-500" />
              </div>
            )}
          </div>

          {/* Top companies */}
          {m?.topCompanies && m.topCompanies.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Top Companies by Offers
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Company</th>
                      <th className="text-right pb-2 font-medium">Distributed</th>
                      <th className="text-right pb-2 font-medium">Offers</th>
                      <th className="text-right pb-2 font-medium">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {m.topCompanies.map((c) => (
                      <tr key={c.company} className="hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-gray-800">{c.company}</td>
                        <td className="py-2.5 text-right text-gray-600">{c.total_distributed}</td>
                        <td className="py-2.5 text-right font-semibold text-green-700">{c.total_offers}</td>
                        <td className="py-2.5 text-right text-gray-600">{c.conversion_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Distributions view */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Distributions {directorId ? '(filtered by director)' : '(all)'}
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filter by director ID..."
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 w-52"
                />
                <button
                  onClick={() => setDirectorId(inputId.trim())}
                  className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Filter
                </button>
                {directorId && (
                  <button
                    onClick={() => { setDirectorId(''); setInputId('') }}
                    className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {distributionsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : dists.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No distributions found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Job</th>
                      <th className="text-left pb-2 font-medium">Company</th>
                      <th className="text-left pb-2 font-medium">Sent</th>
                      <th className="text-left pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dists.slice(0, 20).map((d) => {
                      const latestOutcome = d.outcomes[d.outcomes.length - 1]
                      return (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="py-2.5 font-medium text-gray-800 max-w-[200px] truncate">
                            {d.jobs.title}
                          </td>
                          <td className="py-2.5 text-gray-600">{d.jobs.company}</td>
                          <td className="py-2.5 text-gray-500">
                            {new Date(d.sent_at).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5">
                            {latestOutcome ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                                {latestOutcome.status.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {dists.length > 20 && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Showing 20 of {dists.length} distributions
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
