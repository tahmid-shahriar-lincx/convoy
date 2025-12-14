import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Box, Typography, Chip, Paper } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import invariant from 'tiny-invariant'

import { tasksApi } from '../services/api'

const COLUMN_DEFS = [
  { id: 'todo', title: 'Todo' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' }
]

function TaskCard ({ task, columnId }) {
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
      sx={{
        p: 2,
        mb: 2,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        },
        '&:active': {
          cursor: 'grabbing'
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
          whiteSpace: 'normal'
        }}
      >
        {task.task_title || '(untitled)'}
      </Typography>

      {task.task_description && (
        <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
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
            clickable
          />
        )}
      </Box>
    </Paper>
  )
}

function TaskColumn ({ column, tasks, onDrop }) {
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

function ManageTasksPage () {
  const queryClient = useQueryClient()

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
                    />
                  ))}
                </Box>
                )}
          </Box>
          )}
    </div>
  )
}

export default ManageTasksPage
