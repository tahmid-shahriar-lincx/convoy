import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import TokenPage from './pages/TokenPage'
import ConversationsPage from './pages/ConversationsPage'
import TasksPage from './pages/TasksPage'
import ManageTasksPage from './pages/ManageTasksPage'
import ThemeProvider from './theme/ThemeProvider'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function App () {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <Routes>
              <Route path='/' element={<Dashboard />} />
              <Route path='/tokens' element={<TokenPage />} />
              <Route path='/conversations' element={<ConversationsPage />} />
              <Route path='/tasks' element={<TasksPage />} />
              <Route path='/manage-tasks' element={<ManageTasksPage />} />
            </Routes>
          </Layout>
          <Toaster
            position='bottom-right'
            toastOptions={{
              duration: 4000,
              style: {
                background: '#313244',
                color: '#cdd6f4',
                border: '1px solid #45475a'
              }
            }}
          />
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
