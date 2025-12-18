import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskGenerationApi, ollamaApi, channelsApi, tasksApi, tokenApi, conversationsApi } from '../services/api'
import toast from 'react-hot-toast'
import { format, subDays } from 'date-fns'
import DateRangePicker from '../components/DateRangePicker'
import { DEFAULT_EXAMPLES_CRITERIA, DEFAULT_SYSTEM_PROMPT } from '../prompts/taskPrompts'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import {
  TextField,
  Box,
  Typography,
  Autocomplete,
  CircularProgress,
  IconButton,
  Tooltip,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'

const TasksPage = () => {
  const [selectedModel, setSelectedModel] = useState('')
  const [contextWindow, setContextWindow] = useState(4096)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [examplesCriteria, setExamplesCriteria] = useState(DEFAULT_EXAMPLES_CRITERIA)
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [includeBotMessages] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const thirtyDaysAgo = subDays(today, 30)
    return format(thirtyDaysAgo, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-dd')
  })
  const [generated, setGenerated] = useState(null)
  const [visibleTasks, setVisibleTasks] = useState(null)
  const [savingTaskKey, setSavingTaskKey] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState({
    step: 'idle',
    message: '',
    currentThread: 0,
    totalThreads: 0
  })
  const [advancedControlsExpanded, setAdvancedControlsExpanded] = useState(false)
  const queryClient = useQueryClient()

  const { data: tokens } = useQuery({
    queryKey: ['tokens'],
    queryFn: tokenApi.getTokens
  })

  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.getChannels
  })

  const { data: savedTasks, isLoading: savedTasksLoading } = useQuery({
    queryKey: ['savedTasks'],
    queryFn: () => tasksApi.getTasks({ limit: 200 })
  })

  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['ollamaModels', ollamaUrl],
    queryFn: () => ollamaApi.getModels(ollamaUrl),
    enabled: ollamaUrl.length > 0
  })


  const CONTEXT_WINDOW_MIN = 1024
  const CONTEXT_WINDOW_MAX = 128000
  const CONTEXT_WINDOW_STEP = 1024

  const sanitizeContextWindow = (value) => {
    const next = typeof value === 'string' ? parseInt(value, 10) : value
    if (!Number.isFinite(next)) return 8192
    const clamped = Math.min(CONTEXT_WINDOW_MAX, Math.max(CONTEXT_WINDOW_MIN, next))
    return Math.round(clamped / CONTEXT_WINDOW_STEP) * CONTEXT_WINDOW_STEP
  }

  useEffect(() => {
    const models = availableModels?.models || []
    if (models.length === 0) return

    if (!selectedModel) {
      setSelectedModel(models[0])
      return
    }

    if (!models.includes(selectedModel)) setSelectedModel(models[0])
  }, [availableModels, selectedModel])

  const saveTaskMutation = useMutation({
    mutationFn: tasksApi.saveTask,
    onSuccess: () => {
      toast.success('Task saved')
      queryClient.invalidateQueries(['savedTasks'])
    },
    onError: (error) => {
      toast.error(`Failed to save task: ${error.message}`)
    },
    onSettled: () => {
      setSavingTaskKey(null)
    }
  })

  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: () => {
      toast.success('Task deleted')
      queryClient.invalidateQueries(['savedTasks'])
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`)
    }
  })

  const refreshChannelsMutation = useMutation({
    mutationFn: channelsApi.refreshChannels,
    onSuccess: () => {
      toast.success('Channels refreshed!')
      queryClient.invalidateQueries(['channels'])
    },
    onError: (error) => {
      toast.error(`Failed to refresh channels: ${error.message}`)
    }
  })

  const syncConversationsMutation = useMutation({
    mutationFn: conversationsApi.syncConversations,
    onSuccess: (data) => {
      const message = data?.message || `Synced ${data?.messagesSynced || 0} messages`
      toast.success(message)
      queryClient.invalidateQueries(['conversations'])
    },
    onError: (error) => {
      toast.error(`Failed to sync conversations: ${error.message}`)
    }
  })

  const isGenerating = pipelineStatus.step !== 'idle' && pipelineStatus.step !== 'syncing'

  const handleSyncOnly = async () => {
    const channel = (channels || []).find(c => c.id === selectedChannel) || null
    if (!channel) {
      toast.error('Please select a channel')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Please select a date range')
      return
    }

    try {
      setPipelineStatus({
        step: 'syncing',
        message: 'Syncing conversations...',
        currentThread: 0,
        totalThreads: 0
      })

      await syncConversationsMutation.mutateAsync({
        channelId: channel.id,
        channelName: channel.display_name || channel.name || channel.id,
        startDate,
        endDate,
        includeBotMessages
      })

      setPipelineStatus({
        step: 'idle',
        message: '',
        currentThread: 0,
        totalThreads: 0
      })
    } catch (error) {
      setPipelineStatus({
        step: 'idle',
        message: '',
        currentThread: 0,
        totalThreads: 0
      })
    }
  }

  const handleGenerateTasks = async (e) => {
    e.preventDefault()
    const channel = (channels || []).find(c => c.id === selectedChannel) || null
    if (!channel) {
      toast.error('Please select a channel')
      return
    }
    if (!selectedModel) {
      toast.error('Please select a model')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Please select a date range')
      return
    }

    try {
      setPipelineStatus({
        step: 'syncing',
        message: 'Syncing conversations...',
        currentThread: 0,
        totalThreads: 0
      })

      await syncConversationsMutation.mutateAsync({
        channelId: channel.id,
        channelName: channel.display_name || channel.name || channel.id,
        startDate,
        endDate,
        includeBotMessages
      })

      await runPipeline({
        channelId: channel.id,
        channelName: channel.display_name || channel.name || channel.id
      })
    } catch (error) {
    }
  }

  const runPipeline = async ({ channelId, channelName }) => {
    try {
      setPipelineStatus({
        step: 'preparing',
        message: 'Preparing threads...',
        currentThread: 0,
        totalThreads: 0
      })

      const preparedRes = await taskGenerationApi.preparePipeline({
        channelId,
        channelName,
        startDate,
        endDate,
        threadAwareDateFiltering: true
      })

      const prepared = preparedRes?.prepared || null
      const threads = Array.isArray(prepared?.threads) ? prepared.threads : []
      const standaloneMessages = Array.isArray(prepared?.standaloneMessages)
        ? prepared.standaloneMessages
        : []

      const standaloneAsThreads = standaloneMessages.map(msg => ({
        type: 'thread',
        threadId: msg.messageId,
        messageCount: 1,
        messages: [
          {
            role: 'parent',
            messageId: msg.messageId,
            timestamp: msg.timestamp,
            user: msg.user,
            text: msg.text
          }
        ]
      }))

      const items = [...threads, ...standaloneAsThreads]
      const totalThreads = items.length

      const candidates = []

      setPipelineStatus({
        step: 'extracting',
        message: 'Extracting tasks per thread...',
        currentThread: 0,
        totalThreads
      })

      for (let i = 0; i < items.length; i++) {
        setPipelineStatus({
          step: 'extracting',
          message: `Extracting thread ${i + 1} of ${totalThreads}...`,
          currentThread: i + 1,
          totalThreads
        })

        const thread = items[i]
        const extractRes = await taskGenerationApi.extractThread({
          thread,
          ollamaUrl,
          model: selectedModel,
          numCtx: Number.isFinite(contextWindow) ? contextWindow : undefined,
          systemPrompt,
          examplesCriteria
        })

        const tasks = Array.isArray(extractRes?.tasks) ? extractRes.tasks : []
        for (const t of tasks) candidates.push(t)
      }

      setPipelineStatus({
        step: 'merging',
        message: 'Merging and deduping tasks...',
        currentThread: totalThreads,
        totalThreads
      })

      const mergedRes = await taskGenerationApi.mergeCandidates({
        candidates,
        strategy: 'title-normalize+fuzzy'
      })

      const tasks = Array.isArray(mergedRes?.tasks) ? mergedRes.tasks : []
      const messagesAnalyzed = prepared?.threadStats?.totalMessages || 0

      const result = {
        success: true,
        tasksExtracted: tasks.length,
        messagesAnalyzed,
        tasks,
        channelName,
        threadStats: prepared?.threadStats || null
      }

      toast.success('Tasks generated!')
      setGenerated(result)
      setVisibleTasks(tasks)
      setPipelineStatus({
        step: 'idle',
        message: '',
        currentThread: 0,
        totalThreads: 0
      })
    } catch (error) {
      setPipelineStatus({
        step: 'idle',
        message: '',
        currentThread: 0,
        totalThreads: 0
      })
      toast.error(`Failed to generate tasks: ${error.message}`)
      throw error
    }
  }

  const handleDiscardGenerated = () => {
    setGenerated(null)
    setVisibleTasks(null)
    setPipelineStatus({
      step: 'idle',
      message: '',
      currentThread: 0,
      totalThreads: 0
    })
  }

  const handleSaveTask = (task, idx) => {
    const channel = (channels || []).find(c => c.id === selectedChannel) || null
    if (!channel) {
      toast.error('Select a channel to save tasks')
      return
    }

    const key = `${task.task_title}-${idx}`
    setSavingTaskKey(key)
    saveTaskMutation.mutate({
      channelId: channel.id,
      channelName: channel.display_name || channel.name || channel.id,
      model: selectedModel,
      task_title: task.task_title,
      task_description: task.task_description || '',
      parent_thread_id: task?.sources?.[0]?.threadId || null
    })
  }

  const handleDeleteTask = (taskId) => {
    if (globalThis.window && globalThis.window.confirm('Delete this saved task?')) {
      deleteTaskMutation.mutate(taskId)
    }
  }

  const workspaceUrl =
    Array.isArray(tokens) && tokens.length > 0 ? tokens[0].workspaceUrl : null

  const getParentThreadLink = (threadId) => {
    if (!workspaceUrl || !selectedChannel || !threadId) return null
    const ts = threadId.toString().replace('.', '')
    if (!ts) return null
    const base = workspaceUrl.endsWith('/') ? workspaceUrl.slice(0, -1) : workspaceUrl
    return `${base}/archives/${selectedChannel}/p${ts}`
  }

  const previewRows = useMemo(() => {
    if (!Array.isArray(visibleTasks)) return []
    return visibleTasks.map((t, idx) => ({
      ...t,
      __idx: idx
    }))
  }, [visibleTasks])

  const previewColumns = useMemo(() => {
    return [
      {
        field: 'task_title',
        headerName: 'Title',
        flex: 0.9,
        minWidth: 220
      },
      {
        field: 'task_description',
        headerName: 'Description',
        flex: 1.5,
        minWidth: 320,
        renderCell: (params) => {
          if (!params.value) return ''
          return (
            <span style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
              {params.value}
            </span>
          )
        }
      },
      {
        field: 'parent_thread_slack_link',
        headerName: 'Parent thread',
        flex: 0.8,
        minWidth: 180,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const parentThreadId = params?.row?.sources?.[0]?.threadId || null
          const link = getParentThreadLink(parentThreadId)
          if (!link) return ''
          return (
            <Tooltip title='Open parent thread'>
              <IconButton
                component='a'
                href={link}
                target='_blank'
                rel='noreferrer'
                size='small'
                aria-label='Open parent thread'
              >
                <OpenInNewIcon fontSize='inherit' />
              </IconButton>
            </Tooltip>
          )
        }
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 110,
        getActions: (params) => {
          const idx = params?.row?.__idx
          const key = `${params?.row?.task_title}-${idx}`
          const savingThisRow = saveTaskMutation.isPending && savingTaskKey === key
          return [
            (
              <GridActionsCellItem
                key='save'
                icon={<SaveIcon />}
                label={savingThisRow ? 'Saving…' : 'Save'}
                disabled={savingThisRow || saveTaskMutation.isPending}
                onClick={() => handleSaveTask(params.row, idx)}
                showInMenu={false}
              />
            )
          ]
        }
      }
    ]
  }, [getParentThreadLink, handleSaveTask, saveTaskMutation.isPending, savingTaskKey])

  const savedRows = useMemo(() => {
    if (!Array.isArray(savedTasks)) return []
    return savedTasks
  }, [savedTasks])

  const savedColumns = useMemo(() => {
    return [
      {
        field: 'task_title',
        headerName: 'Title',
        flex: 0.9,
        minWidth: 220
      },
      {
        field: 'task_description',
        headerName: 'Description',
        flex: 1.6,
        minWidth: 320,
        renderCell: (params) => {
          if (!params.value) return ''
          return (
            <span style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
              {params.value}
            </span>
          )
        }
      },
      {
        field: 'channel_name',
        headerName: 'Channel',
        flex: 0.6,
        minWidth: 160
      },
      {
        field: 'parent_thread_slack_link',
        headerName: 'Slack',
        flex: 0.6,
        minWidth: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const link = params.value
          if (!link) return ''
          return (
            <Tooltip title='Open in Slack'>
              <IconButton
                component='a'
                href={link}
                target='_blank'
                rel='noreferrer'
                size='small'
                aria-label='Open in Slack'
              >
                <OpenInNewIcon fontSize='inherit' />
              </IconButton>
            </Tooltip>
          )
        }
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 110,
        getActions: (params) => {
          return [
            (
              <GridActionsCellItem
                key='delete'
                icon={<DeleteIcon />}
                label='Delete'
                disabled={deleteTaskMutation.isPending}
                onClick={() => handleDeleteTask(params.id)}
                showInMenu={false}
              />
            )
          ]
        }
      }
    ]
  }, [deleteTaskMutation.isPending, handleDeleteTask])

  const gridSx = useMemo(() => {
    return {
      '& .MuiDataGrid-cell': {
        alignItems: 'flex-start',
        py: 1
      },
      '& .MuiDataGrid-cellContent': {
        whiteSpace: 'normal'
      }
    }
  }, [])

  return (
    <div className='container'>
      <h1>Tasks</h1>
      <p className='mb-3'>
        Generate and save tasks from your Slack conversations
      </p>

      <div className='card mb-3'>
        <h2>Generate Tasks</h2>

        <form onSubmit={handleGenerateTasks}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'flex-end',
              mb: 2
            }}
          >
            <TextField
              label='Ollama URL'
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder='http://localhost:11434'
              required
              fullWidth
              sx={{ flex: '2 1 360px' }}
            />

            <TextField
              select
              label='AI Model'
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              required
              disabled={modelsLoading}
              fullWidth
              sx={{ flex: '1 1 260px', minWidth: 260 }}
            >
              <MenuItem value=''>Select a model...</MenuItem>
              {availableModels?.models?.map((model) => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label='Context Window Size'
              type='number'
              value={contextWindow}
              onChange={(e) => setContextWindow(sanitizeContextWindow(e.target.value))}
              inputProps={{
                min: CONTEXT_WINDOW_MIN,
                max: CONTEXT_WINDOW_MAX,
                step: CONTEXT_WINDOW_STEP
              }}
              fullWidth
              sx={{ flex: '1 1 240px', minWidth: 240, maxWidth: 420 }}
            />
          </Box>

          {modelsLoading && (
            <Typography variant='body2' sx={{ mb: 2 }}>
              Loading available models...
            </Typography>
          )}

          <Accordion
            expanded={advancedControlsExpanded}
            onChange={(e, expanded) => setAdvancedControlsExpanded(expanded)}
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls='advanced-controls-content'
              id='advanced-controls-header'
            >
              <Typography variant='subtitle1' sx={{ fontWeight: 500 }}>
                Prompt Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 2 }}>
                <TextField
                  label='System Prompt'
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder='System prompt sent to the model'
                  multiline
                  minRows={4}
                  fullWidth
                  helperText='Used for this Generate call only (resets on refresh)'
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <TextField
                  label='Prompt examples/criteria'
                  value={examplesCriteria}
                  onChange={(e) => setExamplesCriteria(e.target.value)}
                  placeholder='Examples/criteria sent to the model'
                  multiline
                  minRows={10}
                  fullWidth
                  helperText='Used for this Generate call only (resets on refresh)'
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
              <Tooltip title='Refresh channels'>
                <IconButton
                  onClick={() => refreshChannelsMutation.mutate()}
                  disabled={refreshChannelsMutation.isLoading}
                  size='small'
                >
                  {refreshChannelsMutation.isLoading ? (
                    <CircularProgress size={18} />
                  ) : (
                    <RefreshIcon fontSize='small' />
                  )}
                </IconButton>
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
          </Box>

          <div className='flex gap-2'>
            <button
              type='submit'
              className='btn'
              disabled={
                isGenerating ||
                pipelineStatus.step === 'syncing' ||
                !selectedChannel ||
                !selectedModel ||
                !startDate ||
                !endDate
              }
              aria-busy={isGenerating}
            >
              {isGenerating
                ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <CircularProgress size={16} />
                    {pipelineStatus.message || 'Processing...'}
                  </span>
                  )
                : (
                    'Sync & Generate Tasks'
                  )}
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={handleSyncOnly}
              disabled={
                syncConversationsMutation.isPending ||
                pipelineStatus.step === 'syncing' ||
                !selectedChannel ||
                !startDate ||
                !endDate
              }
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {pipelineStatus.step === 'syncing' ? (
                  <>
                    <CircularProgress size={16} />
                    Syncing...
                  </>
                ) : (
                  <>
                    <SyncIcon />
                    Sync Only
                  </>
                )}
              </span>
            </button>
          </div>
        </form>

        {visibleTasks && (
          <div className='card mt-3'>
            <h3>Tasks List</h3>
            {generated && (
              <p className='text-muted'>
                Preview only (not saved). {generated.tasksExtracted || 0} tasks • {generated.messagesAnalyzed || 0} messages
              </p>
            )}
            {visibleTasks.length === 0
              ? (
                <p>No tasks generated for this range.</p>
                )
              : (
                <Box sx={{ width: '100%' }}>
                  <DataGrid
                    autoHeight
                    rows={previewRows}
                    columns={previewColumns}
                    getRowId={(row) => `${row.task_title}-${row.__idx}`}
                    disableRowSelectionOnClick
                    showToolbar
                    hideFooter
                    getRowHeight={() => 'auto'}
                    sx={gridSx}
                  />
                </Box>
                )}

            {generated && (
              <div className='mt-2'>
                <button
                  className='btn btn-danger'
                  onClick={handleDiscardGenerated}
                  disabled={saveTaskMutation.isPending}
                >
                  Discard
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className='card'>
        <h2>Saved Tasks</h2>

        {savedTasksLoading
          ? (
            <div className='loading-dock'>
              <p>Loading tasks...</p>
            </div>
            )
          : (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ height: (savedRows.length === 0 ? 260 : 560), width: '100%' }}>
                <DataGrid
                  rows={savedRows}
                  columns={savedColumns}
                  disableRowSelectionOnClick
                  showToolbar
                  loading={savedTasksLoading}
                  pagination
                  pageSizeOptions={[25, 50, 100]}
                  density='compact'
                  initialState={{
                    pagination: { paginationModel: { page: 0, pageSize: 25 } }
                  }}
                  getRowHeight={() => 'auto'}
                  sx={gridSx}
                />
              </Box>
              {(!savedRows || savedRows.length === 0) && (
                <p style={{ marginTop: 12 }}>
                  No saved tasks yet. Generate tasks, then save the ones you want.
                </p>
              )}
            </Box>
            )}
      </div>

    </div>
  )
}

export default TasksPage
