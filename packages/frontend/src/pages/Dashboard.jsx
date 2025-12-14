import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../services/api'
import { format } from 'date-fns'

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.getStats
  })

  if (statsError) {
    return (
      <div className='container'>
        <div className='alert alert-error'>
          Error loading dashboard: {statsError.message}
        </div>
      </div>
    )
  }

  return (
    <div className='container'>
      <h1>Convoy Dashboard</h1>
      <p className='mb-3'>
        Pack your conversations into valuable cargo
      </p>

      {statsLoading
        ? (
          <div className='loading-dock'>
            <h2>Loading statistics...</h2>
          </div>
          )
        : (
          <div className='grid grid-2 mb-3'>
            <div className='card'>
              <h2>Database Statistics</h2>
              <div className='road-line' />
              <p><strong>Total Tokens:</strong> {stats.totalTokens || 0}</p>
              <p><strong>Total Conversations:</strong> {stats.totalConversations || 0}</p>
              <p><strong>Total Messages:</strong> {stats.totalMessages || 0}</p>
              <p><strong>Total Saved Tasks:</strong> {stats.totalTasks || 0}</p>
            </div>

            <div className='card'>
              <h2>Recent Activity</h2>
              <div className='road-line' />
              <p><strong>Last Sync:</strong> {stats.lastSync ? format(new Date(stats.lastSync), 'MMM dd, yyyy HH:mm') : 'Never'}</p>
              <p><strong>Last Task Saved:</strong> {stats.lastTaskSaved ? format(new Date(stats.lastTaskSaved), 'MMM dd, yyyy HH:mm') : 'Never'}</p>
              <p><strong>Database Size:</strong> {stats.databaseSize || 'Unknown'}</p>
            </div>
          </div>
          )}
    </div>
  )
}

export default Dashboard
