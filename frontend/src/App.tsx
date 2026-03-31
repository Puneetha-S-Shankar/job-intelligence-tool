import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DailyDigest from './pages/DailyDigest'
import SearchJobs from './pages/SearchJobs'
import JobDetail from './pages/JobDetail'
import OfficerDashboard from './pages/OfficerDashboard'
import DirectorDashboard from './pages/DirectorDashboard'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<DailyDigest />} />
        <Route path="search" element={<SearchJobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="officer" element={<OfficerDashboard />} />
        <Route path="director" element={<DirectorDashboard />} />
      </Route>
    </Routes>
  )
}
