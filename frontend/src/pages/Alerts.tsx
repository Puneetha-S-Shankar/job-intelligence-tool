import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

const alertSchema = z.object({
  keywords: z.string().min(1, 'At least one keyword is required'),
  email: z.string().email('Invalid email address'),
  frequency: z.enum(['daily', 'weekly']),
})

type AlertForm = z.infer<typeof alertSchema>

interface Alert { id: string; keywords: string; email: string; frequency: string }

export default function Alerts() {
  const qc = useQueryClient()
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts').then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AlertForm>({
    resolver: zodResolver(alertSchema),
    defaultValues: { frequency: 'daily' },
  })

  const createAlert = useMutation({
    mutationFn: (data: AlertForm) => api.post('/alerts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); reset() },
  })

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Alerts</h2>
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Alert</h3>
        <form onSubmit={handleSubmit((d) => createAlert.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input {...register('keywords')} className="input" placeholder="e.g. React, TypeScript, remote" />
            {errors.keywords && <p className="text-red-500 text-xs mt-1">{errors.keywords.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input {...register('email')} type="email" className="input" placeholder="you@example.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select {...register('frequency')} className="input">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={createAlert.isPending}>
            {createAlert.isPending ? 'Creating…' : 'Create Alert'}
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Alerts</h3>
        {isLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-gray-400">No alerts yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{alert.keywords}</p>
                  <p className="text-sm text-gray-500">{alert.email} · {alert.frequency}</p>
                </div>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">Active</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
