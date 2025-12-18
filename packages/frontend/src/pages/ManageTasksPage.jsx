import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Box,
  Typography,
  Chip,
  Paper,
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  TextField,
  Container,
  Slide,
  DialogContent
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import invariant from 'tiny-invariant'

import { tasksApi } from '../services/api'

const Transition = React.forwardRef(function Transition (props, ref) {
  return <Slide direction='up' ref={ref} {...props} />
})

const COLUMN_DEFS = [
  { id: 'todo', title: 'Todo' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' }
]

function TaskCard ({ task, columnId, onClick }) {
  const ref = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const element = ref.current
    invariant(element)

    return draggable({
      element,
      getInitialData: () => ({
        type: 'task',
        taskId: task.id,
        columnId
      }),
      onDragStart: () => {
        setIsDragging(true)
      },
      onDrop: () => {
        setIsDragging(false)
      }
    })
  }, [task.id, columnId])

  const slackLink = task.parent_thread_slack_link || null

  return (
    <Paper
      ref={ref}
      elevation={isDragging ? 8 : 2}
      onClick={() => onClick(task)}
      sx={{
        p: 2,
        mb: 2,
        cursor: 'pointer',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
    >
      <Typography
        variant='h6'
        sx={{
          mb: 1,
          fontSize: '1rem',
          fontWeight: 600,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {task.task_title || '(untitled)'}
      </Typography>

      {task.task_description && (
        <Typography
          variant='body2'
          sx={{
            mb: 2,
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {task.task_description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {task.channel_name && (
          <Chip size='small' label={task.channel_name} />
        )}
        {slackLink && (
          <Chip
            size='small'
            icon={<OpenInNewIcon />}
            label='Open in Slack'
            component='a'
            href={slackLink}
            target='_blank'
            rel='noreferrer'
            onClick={(e) => e.stopPropagation()}
            clickable
          />
        )}
      </Box>
    </Paper>
  )
}

function TaskColumn ({ column, tasks, onDrop, onTaskClick }) {
  const ref = useRef(null)
  const [isDraggedOver, setIsDraggedOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    invariant(element)

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        return source.data.type === 'task'
      },
      onDragEnter: () => {
        setIsDraggedOver(true)
      },
      onDragLeave: () => {
        setIsDraggedOver(false)
      },
      onDrop: ({ source }) => {
        setIsDraggedOver(false)
        const taskId = source.data.taskId
        const fromColumnId = source.data.columnId
        const toColumnId = column.id

        if (fromColumnId !== toColumnId) {
          const position = tasks.length
          onDrop(taskId, toColumnId, position)
        }
      }
    })
  }, [column.id, tasks.length, onDrop])

  return (
    <Box
      ref={ref}
      sx={{
        flex: 1,
        minWidth: 300,
        p: 2,
        borderRadius: 2,
        bgcolor: isDraggedOver ? 'action.hover' : 'background.paper',
        border: isDraggedOver ? '2px dashed' : '1px solid',
        borderColor: isDraggedOver ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease',
        minHeight: 400
      }}
    >
      <Typography variant='h6' sx={{ mb: 2, fontWeight: 600 }}>
        {column.title}
      </Typography>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          columnId={column.id}
          onClick={onTaskClick}
        />
      ))}
      {tasks.length === 0 && (
        <Typography variant='body2' color='text.secondary' sx={{ fontStyle: 'italic' }}>
          No tasks
        </Typography>
      )}
    </Box>
  )
}

function TaskEditModal ({ task, open, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.task_title || '')
      setDescription(task.task_description || '')
    }
  }, [task])

  const handleSave = () => {
    onSave(task.id, { task_title: title, task_description: description })
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id)
    }
  }

  if (!task) return null

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
    >
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge='start'
            color='inherit'
            onClick={onClose}
            aria-label='close'
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant='h6' component='div'>
            Edit Task
          </Typography>
          <Button autoFocus color='inherit' onClick={handleSave}>
            Save
          </Button>
        </Toolbar>
      </AppBar>
      <DialogContent sx={{ p: 4 }}>
        <Container maxWidth='md'>
          <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label='Task Title'
              fullWidth
              variant='outlined'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Enter task title...'
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label='Task Description'
              fullWidth
              multiline
              rows={15}
              variant='outlined'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Enter detailed task description...'
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {task.channel_name && (
                  <Chip label={`Channel: ${task.channel_name}`} variant='outlined' />
                )}
                {task.parent_thread_slack_link && (
                  <Button
                    size='small'
                    startIcon={<OpenInNewIcon />}
                    component='a'
                    href={task.parent_thread_slack_link}
                    target='_blank'
                    rel='noreferrer'
                  >
                    View on Slack
                  </Button>
                )}
              </Box>
              <Button
                color='error'
                variant='outlined'
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                Delete Task
              </Button>
            </Box>
          </Box>
        </Container>
      </DialogContent>
    </Dialog>
  )
}

function ManageTasksPage () {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState(null)

  const { data: savedTasks, isLoading } = useQuery({
    queryKey: ['savedTasks'],
    queryFn: () => tasksApi.getTasks({ limit: 500 })
  })

  const updateKanbanMutation = useMutation({
    mutationFn: ({ taskId, columnId, position }) =>
      tasksApi.updateTaskKanban(taskId, { columnId, position }),
    onError: (error) => {
      toast.error(`Failed to move task: ${error.message}`)
      queryClient.invalidateQueries(['savedTasks'])
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['savedTasks'])
    }
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }) => tasksApi.updateTask(taskId, data),
    onSuccess: () => {
      toast.success('Task updated successfully')
      queryClient.invalidateQueries(['savedTasks'])
      setSelectedTask(null)
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`)
    }
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      toast.success('Task deleted successfully')
      queryClient.invalidateQueries(['savedTasks'])
      setSelectedTask(null)
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`)
    }
  })

  const normalizedTasks = useMemo(() => {
    const tasks = Array.isArray(savedTasks) ? savedTasks : []
    return tasks.map(t => ({
      ...t,
      kanban_column: (t.kanban_column || 'todo').toString(),
      kanban_position: Number.isFinite(t.kanban_position)
        ? t.kanban_position
        : null
    }))
  }, [savedTasks])

  const tasksByColumn = useMemo(() => {
    const byColumn = new Map()
    for (const col of COLUMN_DEFS) byColumn.set(col.id, [])

    for (const t of normalizedTasks) {
      const colId = byColumn.has(t.kanban_column) ? t.kanban_column : 'todo'
      byColumn.get(colId).push(t)
    }

    for (const col of COLUMN_DEFS) {
      const tasks = byColumn.get(col.id) || []
      tasks.sort((a, b) => {
        const ap = a.kanban_position
        const bp = b.kanban_position
        if (ap == null && bp == null) return 0
        if (ap == null) return 1
        if (bp == null) return -1
        return ap - bp
      })
    }

    return byColumn
  }, [normalizedTasks])

  const handleDrop = (taskId, columnId, position) => {
    updateKanbanMutation.mutate({
      taskId,
      columnId,
      position
    })
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
  }

  const handleSaveTask = (taskId, data) => {
    updateTaskMutation.mutate({ taskId, data })
  }

  const handleDeleteTask = (taskId) => {
    deleteTaskMutation.mutate(taskId)
  }

  return (
    <div className='container'>
      <h1>Manage Tasks</h1>
      <p className='mb-3'>Organize your saved tasks by status</p>

      {isLoading
        ? (
          <div className='loading-dock'>
            <p>Loading tasks...</p>
          </div>
          )
        : (
          <Box sx={{ width: '100%' }}>
            {(!normalizedTasks || normalizedTasks.length === 0)
              ? (
                <Typography variant='body1'>
                  No saved tasks yet. Generate tasks on the Tasks page, then save
                  the ones you want.
                </Typography>
                )
              : (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 3,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start'
                  }}
                >
                  {COLUMN_DEFS.map((column) => (
                    <TaskColumn
                      key={column.id}
                      column={column}
                      tasks={tasksByColumn.get(column.id) || []}
                      onDrop={handleDrop}
                      onTaskClick={handleTaskClick}
                    />
                  ))}
                </Box>
                )}
          </Box>
          )}

      <TaskEditModal
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}

export default ManageTasksPage
