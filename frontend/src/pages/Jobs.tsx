import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface Job {
  id: string
  title: string
  company: string
  location: string
  postedAt: string
  skills: string[]
}

export default function Jobs() {
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((r) => r.data),
  })

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Listings</h2>
      {isLoading ? (
        <div className="text-gray-500">Loading jobs...</div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{job.company} · {job.location}</p>
                </div>
                <span className="text-xs text-gray-400">{job.postedAt}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {job.skills.map((skill) => (
                  <span key={skill} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <p className="text-gray-400 text-center py-16">No jobs found. Configure your scraper to start collecting data.</p>
          )}
        </div>
      )}
    </div>
  )
}
