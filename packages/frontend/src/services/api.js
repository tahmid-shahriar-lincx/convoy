import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      if (globalThis.console) {
        globalThis.console.error('Unauthorized - redirecting to login')
      }
      if (globalThis.window) {
        globalThis.window.location.href = '/reset'
      }
    }

    const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred'
    return Promise.reject(new Error(errorMessage))
  }
)

export const tokenApi = {
  getTokens: async () => {
    const response = await api.get('/api/tokens')
    return response.tokens || []
  },
  saveToken: (tokenData) => api.post('/save-token', tokenData),
  extractToken: (cookieData) => api.post('/api/extract-token', cookieData),
  renewToken: (tokenData) => api.post('/api/renew-token', tokenData),
  resetToken: () => api.get('/reset')
}

export const statsApi = {
  getStats: () => api.get('/api/stats')
}

export const channelsApi = {
  getChannels: async () => {
    const response = await api.get('/api/channels')
    return response.channels || []
  },
  refreshChannels: () => api.post('/api/channels/refresh')
}

export const conversationsApi = {
  syncConversations: (data) => api.post('/api/sync-conversations', data, { timeout: 0 }),
  getConversations: async (params) => {
    const response = await api.get('/api/conversations', { params })
    return response.conversations || []
  }
}

export const taskGenerationApi = {
  generateTasks: (data) => api.post('/api/tasks/generate', data, { timeout: 0 }),
  preparePipeline: (data) =>
    api.post('/api/tasks/pipeline/prepare', data, { timeout: 0 }),
  extractThread: (data) =>
    api.post('/api/tasks/pipeline/extract-thread', data, { timeout: 0 }),
  mergeCandidates: (data) =>
    api.post('/api/tasks/pipeline/merge', data, { timeout: 0 })
}

export const tasksApi = {
  getTasks: async (params) => {
    const response = await api.get('/api/tasks', { params })
    return response.tasks || []
  },
  saveTask: (data) => api.post('/api/tasks', data),
  deleteTask: (taskId) => api.delete(`/api/tasks/${taskId}`),
  updateTaskKanban: (taskId, data) => api.put(`/api/tasks/${taskId}/kanban`, data)
}

export const ollamaApi = {
  getModels: (ollamaUrl) => api.get('/api/ollama/models', { params: { ollamaUrl } })
}

export const promptsApi = {
  getPrompts: async (params) => {
    const response = await api.get('/api/prompts', { params })
    return response.prompts || []
  },
  getPrompt: async (id) => {
    const response = await api.get(`/api/prompts/${id}`)
    return response.prompt
  },
  createPrompt: (data) => api.post('/api/prompts', data),
  updatePrompt: (id, data) => api.put(`/api/prompts/${id}`, data),
  deletePrompt: (id) => api.delete(`/api/prompts/${id}`),
  setDefaultPrompt: (id) => api.put(`/api/prompts/${id}/default`)
}

export default api
