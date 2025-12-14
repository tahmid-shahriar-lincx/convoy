import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { channelsApi, conversationsApi } from '../services/api'
import toast from 'react-hot-toast'
import DateRangePicker from '../components/DateRangePicker'
import {
  TextField,
  Button,
  Box,
  Alert,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Autocomplete,
  IconButton,
  Tooltip
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'

const ConversationsPage = () => {
  const [selectedChannel, setSelectedChannel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeBotMessages] = useState(false)
  const queryClient = useQueryClient()

  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.getChannels,
    enabled: true, // Load channels automatically on page mount
    staleTime: 5 * 60 * 1000 // Consider channels fresh for 5 minutes
  })

  const refreshChannelsMutation = useMutation({
    mutationFn: channelsApi.refreshChannels,
    onSuccess: () => {
      toast.success('Channels refreshed successfully!')
      queryClient.invalidateQueries(['channels'])
    },
    onError: (error) => {
      toast.error(`Failed to refresh channels: ${error.message}`)
    }
  })

  const syncConversationsMutation = useMutation({
    mutationFn: conversationsApi.syncConversations,
    onSuccess: (data) => {
      const message = data?.message || `Successfully synced ${data?.messagesSynced || 0} messages`
      toast.success(message)
      queryClient.invalidateQueries(['conversations'])
    },
    onError: (error) => {
      toast.error(`Failed to sync conversations: ${error.message}`)
    }
  })

  const isSyncing = syncConversationsMutation.isPending

  const handleSync = (e) => {
    e.preventDefault()
    if (!selectedChannel) {
      toast.error('Please select a channel')
      return
    }

    const selectedChannelObj = channels.find(ch => ch.id === selectedChannel)
    if (!selectedChannelObj) {
      toast.error('Selected channel not found')
      return
    }

    syncConversationsMutation.mutate({
      channelId: selectedChannel,
      channelName: selectedChannelObj.name || selectedChannelObj.display_name,
      startDate,
      endDate,
      includeBotMessages
    })
  }

  return (
    <div className='container'>
      <Typography variant='h1' gutterBottom>
        Conversation Sync
      </Typography>
      <Typography variant='body1' sx={{ mb: 3 }}>
        Sync and manage your Slack conversations
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h2' gutterBottom>
            Sync New Conversations
          </Typography>

          {channelsLoading
            ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
              )
            : channels && channels.length > 0
              ? (
                <Box component='form' onSubmit={handleSync} noValidate>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                    <Autocomplete
                      sx={{ flex: 1, minWidth: 280 }}
                      options={channels || []}
                      getOptionLabel={(option) => option.name || option.display_name || option.id}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props
                        return (
                          <Box component='li' key={key} {...otherProps}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant='body1'>
                                {option.name || option.display_name || option.id}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {option.is_private ? '🔒 Private' : '📢 Public'} • {option.id}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      }}
                      value={(channels || []).find(channel => channel.id === selectedChannel) || null}
                      onChange={(event, newValue) => {
                        setSelectedChannel(newValue ? newValue.id : '')
                      }}
                      disabled={channelsLoading}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size='small'
                          placeholder='Search channels...'
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>
                                {params.InputProps.startAdornment}
                              </>
                            )
                          }}
                        />
                      )}
                      loading={channelsLoading}
                      noOptionsText='No channels found'
                      clearText='Clear'
                      openText='Open'
                      closeText='Close'
                    />
                    <Tooltip title='Refresh channels' placement='top'>
                      <span>
                        <IconButton
                          onClick={() => refreshChannelsMutation.mutate()}
                          disabled={refreshChannelsMutation.isLoading}
                          aria-label='Refresh channels'
                          size='small'
                        >
                          {refreshChannelsMutation.isLoading
                            ? (
                              <CircularProgress size={18} />
                              )
                            : (
                              <RefreshIcon fontSize='small' />
                              )}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Box sx={{ flex: 1.4, minWidth: 520 }}>
                      <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                      />
                    </Box>
                  </Box>

                  <Button
                    type='submit'
                    variant='contained'
                    startIcon={
                  isSyncing
                    ? (
                      <CircularProgress size={20} sx={{ color: 'white' }} />
                      )
                    : (
                      <SyncIcon />
                      )
                }
                    disabled={isSyncing || !selectedChannel}
                    size='large'
                  >
                    {isSyncing ? 'Syncing...' : 'Start Sync'}
                  </Button>
                </Box>
                )
              : (
                <Alert severity='info' sx={{ textAlign: 'center', py: 4 }}>
                  No channels found. Make sure you have an active token, then use the refresh icon to load from Slack.
                </Alert>
                )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ConversationsPage
