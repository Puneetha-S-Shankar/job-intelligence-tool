import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'

interface StatsData {
  totalJobs: number
  newToday: number
  activeAlerts: number
  topSkills: { skill: string; count: number }[]
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then((r) => r.data),
  })

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="card">
              <p className="text-sm text-gray-500">Total Jobs Tracked</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{data?.totalJobs ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">New Today</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{data?.newToday ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Active Alerts</p>
              <p className="text-3xl font-bold text-orange-500 mt-1">{data?.activeAlerts ?? 0}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Skills in Demand</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.topSkills ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
