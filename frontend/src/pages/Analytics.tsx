import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import api from '../lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

interface TrendPoint { date: string; count: number }
interface SkillShare { name: string; value: number }
interface AnalyticsData { trends: TrendPoint[]; skillShare: SkillShare[] }

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => api.get('/analytics').then((r) => r.data),
  })

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h2>
      {isLoading ? (
        <div className="text-gray-500">Loading analytics...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="card col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Job Posting Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.trends ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Skill Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data?.skillShare ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {(data?.skillShare ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
