const database = require('../database')
const { normalizeWorkspaceUrl } = require('./utils')

module.exports = {
  saveTask,
  getTasks,
  deleteTask,
  updateTask,
  updateTaskKanban,
  getTaskCount,
  getLastTaskSavedDate
}

function getWorkspaceUrl (db) {
  const token = db.prepare(
    'SELECT workspaceUrl FROM tokens ORDER BY createdAt DESC LIMIT 1'
  ).get()
  return token?.workspaceUrl || null
}

function computeSlackParentPermalink (workspaceUrl, channelId, parentThreadId) {
  if (!workspaceUrl || !channelId || !parentThreadId) return null

  const ts = parentThreadId.toString().replace('.', '')
  if (!ts) return null

  const base = normalizeWorkspaceUrl(workspaceUrl)
  return `${base}/archives/${channelId}/p${ts}`
}

function resolveWorkspaceId (db, channelId) {
  if (!channelId) return null

  const channel = db.prepare(
    'SELECT workspace_id FROM channels WHERE channel_id = ?'
  ).get(channelId)

  if (channel?.workspace_id) return channel.workspace_id

  const conversation = db.prepare(
    'SELECT workspace_id FROM conversations WHERE channel_id = ? LIMIT 1'
  ).get(channelId)

  return conversation?.workspace_id || null
}

function saveTask (taskData) {
  const db = database.initialize()
  const {
    channelId = null,
    channelName = null,
    model = null,
    taskTitle,
    taskDescription = '',
    parentThreadId = null
  } = taskData

  if (!taskTitle || !taskTitle.toString().trim()) {
    throw new Error('Task title is required')
  }

  const workspaceId = resolveWorkspaceId(db, channelId)
  const workspaceUrl = getWorkspaceUrl(db)
  const parentThreadSlackLink = computeSlackParentPermalink(
    workspaceUrl,
    channelId,
    parentThreadId
  )

  const kanbanColumn = 'todo'
  const kanbanPosition = computeNextKanbanPosition(db, workspaceId, kanbanColumn)

  const stmt = db.prepare(`
    INSERT INTO saved_tasks (
      channel_id,
      channel_name,
      model,
      task_title,
      task_description,
      parent_thread_id,
      parent_thread_slack_link,
      kanban_column,
      kanban_position,
      workspace_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    channelId,
    channelName,
    model,
    taskTitle.toString().trim(),
    (taskDescription || '').toString(),
    parentThreadId ? parentThreadId.toString() : null,
    parentThreadSlackLink,
    kanbanColumn,
    kanbanPosition,
    workspaceId
  )

  return {
    success: true,
    task: {
      id: result.lastInsertRowid,
      channel_id: channelId,
      channel_name: channelName,
      model,
      task_title: taskTitle.toString().trim(),
      task_description: (taskDescription || '').toString(),
      parent_thread_id: parentThreadId ? parentThreadId.toString() : null,
      parent_thread_slack_link: parentThreadSlackLink,
      kanban_column: kanbanColumn,
      kanban_position: kanbanPosition,
      workspace_id: workspaceId
    }
  }
}

function getTasks (filters = {}) {
  const db = database.initialize()
  const { channelId, limit = 200, offset = 0 } = filters

  let query = `
    SELECT
      id,
      channel_id,
      channel_name,
      model,
      task_title,
      task_description,
      parent_thread_id,
      parent_thread_slack_link,
      kanban_column,
      kanban_position,
      workspace_id,
      created_at
    FROM saved_tasks
    WHERE 1=1
  `

  const params = []

  if (channelId) {
    query += ' AND channel_id = ?'
    params.push(channelId)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const tasks = db.prepare(query).all(...params)

  return {
    success: true,
    tasks,
    count: tasks.length
  }
}

function deleteTask (taskId) {
  const db = database.initialize()

  const stmt = db.prepare('DELETE FROM saved_tasks WHERE id = ?')
  const result = stmt.run(taskId)

  return {
    success: result.changes > 0,
    taskId
  }
}

function updateTask (taskId, taskData = {}) {
  const db = database.initialize()
  const { taskTitle, taskDescription } = taskData

  const id = parseInt(taskId, 10)
  if (!Number.isFinite(id)) throw new Error('Task ID must be a number')

  const stmt = db.prepare(`
    UPDATE saved_tasks
    SET task_title = COALESCE(?, task_title),
        task_description = COALESCE(?, task_description)
    WHERE id = ?
  `)

  const result = stmt.run(
    taskTitle !== undefined ? taskTitle.toString().trim() : null,
    taskDescription !== undefined ? taskDescription.toString() : null,
    id
  )

  if (result.changes === 0) {
    return { success: false, error: 'Task not found' }
  }

  const updatedTask = db.prepare('SELECT * FROM saved_tasks WHERE id = ?').get(id)

  return {
    success: true,
    task: updatedTask
  }
}

function updateTaskKanban (taskId, kanbanData = {}) {
  const db = database.initialize()
  const { columnId, position } = kanbanData

  const allowedColumns = new Set(['todo', 'doing', 'done', 'icebox'])
  if (!allowedColumns.has(columnId)) {
    throw new Error('Invalid kanban column')
  }

  const id = parseInt(taskId, 10)
  if (!Number.isFinite(id)) throw new Error('Task ID must be a number')

  const task = db.prepare(`
    SELECT id, workspace_id, kanban_column, kanban_position
    FROM saved_tasks
    WHERE id = ?
  `).get(id)

  if (!task) {
    return { success: false, error: 'Task not found' }
  }

  const workspaceId = task.workspace_id || null
  const fromColumnId = (task.kanban_column || 'todo').toString()
  const fromPosition = Number.isFinite(task.kanban_position)
    ? task.kanban_position
    : 0

  const toPosition = clampKanbanPosition(
    db,
    workspaceId,
    columnId,
    Number.isFinite(position) ? position : parseInt(position, 10)
  )

  if (fromColumnId === columnId && fromPosition === toPosition) {
    return {
      success: true,
      taskId: id,
      kanban_column: fromColumnId,
      kanban_position: fromPosition
    }
  }

  db.exec('BEGIN')
  try {
    if (fromColumnId === columnId) {
      shiftWithinColumn({
        db,
        workspaceId,
        columnId,
        taskId: id,
        fromPosition,
        toPosition
      })
    } else {
      shiftAcrossColumns({
        db,
        workspaceId,
        taskId: id,
        fromColumnId,
        fromPosition,
        toColumnId: columnId,
        toPosition
      })
    }

    db.prepare(
      'UPDATE saved_tasks SET kanban_column = ?, kanban_position = ? WHERE id = ?'
    ).run(columnId, toPosition, id)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    success: true,
    taskId: id,
    kanban_column: columnId,
    kanban_position: toPosition
  }
}

function getTaskCount () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM saved_tasks')
  const result = stmt.get()
  return result.count
}

function getLastTaskSavedDate () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT MAX(created_at) as lastTaskSaved FROM saved_tasks')
  const result = stmt.get()
  return result?.lastTaskSaved || null
}

function workspaceClause (workspaceId) {
  if (workspaceId) {
    return { clause: 'workspace_id = ?', params: [workspaceId] }
  }
  return { clause: 'workspace_id IS NULL', params: [] }
}

function computeNextKanbanPosition (db, workspaceId, columnId) {
  const { clause, params } = workspaceClause(workspaceId)
  const row = db.prepare(`
    SELECT MAX(kanban_position) as maxPos
    FROM saved_tasks
    WHERE ${clause} AND kanban_column = ?
  `).get(...params, columnId)
  const maxPos = Number.isFinite(row?.maxPos) ? row.maxPos : -1
  return maxPos + 1
}

function clampKanbanPosition (db, workspaceId, columnId, requested) {
  const { clause, params } = workspaceClause(workspaceId)
  const row = db.prepare(`
    SELECT MAX(kanban_position) as maxPos
    FROM saved_tasks
    WHERE ${clause} AND kanban_column = ?
  `).get(...params, columnId)
  const maxPos = Number.isFinite(row?.maxPos) ? row.maxPos : -1
  const maxAllowed = maxPos + 1
  const value = Number.isFinite(requested) ? requested : maxAllowed
  return Math.max(0, Math.min(value, maxAllowed))
}

function shiftWithinColumn (opts) {
  const { db, workspaceId, columnId, taskId, fromPosition, toPosition } = opts
  if (fromPosition === toPosition) return

  const { clause, params } = workspaceClause(workspaceId)

  if (toPosition > fromPosition) {
    db.prepare(`
      UPDATE saved_tasks
      SET kanban_position = kanban_position - 1
      WHERE ${clause}
        AND kanban_column = ?
        AND id != ?
        AND kanban_position > ?
        AND kanban_position <= ?
    `).run(...params, columnId, taskId, fromPosition, toPosition)
    return
  }

  db.prepare(`
    UPDATE saved_tasks
    SET kanban_position = kanban_position + 1
    WHERE ${clause}
      AND kanban_column = ?
      AND id != ?
      AND kanban_position >= ?
      AND kanban_position < ?
  `).run(...params, columnId, taskId, toPosition, fromPosition)
}

function shiftAcrossColumns (opts) {
  const {
    db,
    workspaceId,
    taskId,
    fromColumnId,
    fromPosition,
    toColumnId,
    toPosition
  } = opts

  const { clause, params } = workspaceClause(workspaceId)

  db.prepare(`
    UPDATE saved_tasks
    SET kanban_position = kanban_position - 1
    WHERE ${clause}
      AND kanban_column = ?
      AND id != ?
      AND kanban_position > ?
  `).run(...params, fromColumnId, taskId, fromPosition)

  db.prepare(`
    UPDATE saved_tasks
    SET kanban_position = kanban_position + 1
    WHERE ${clause}
      AND kanban_column = ?
      AND id != ?
      AND kanban_position >= ?
  `).run(...params, toColumnId, taskId, toPosition)
}
