import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.data ?? error.message)
    return Promise.reject(error)
  },
)

export default api
