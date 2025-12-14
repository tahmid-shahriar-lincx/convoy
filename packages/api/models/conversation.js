const database = require('../database')
const userModel = require('./user')

module.exports = {
  createConversationData,
  getConversations,
  getConversationsByThread,
  getThreadReplies,
  saveConversationsBulk,
  saveConversation,
  getConversationCount,
  getMessageCount,
  getLastSyncDate
}

function createConversationData (options) {
  const {
    channelId,
    channelName,
    userId,
    username,
    messageText,
    timestamp,
    messageType = 'message',
    threadId,
    messageId,
    workspaceId
  } = options
  return {
    channelId,
    channelName,
    userId,
    username,
    messageText,
    timestamp,
    messageType,
    threadId,
    messageId,
    workspaceId
  }
}

function buildConversationQuery (filters) {
  const {
    channelId,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = filters

  let query = `
    SELECT channel_id, channel_name, user_id, username,
           message_text, timestamp, message_type, thread_id, message_id
    FROM conversations
    WHERE 1=1
  `
  const params = []

  if (channelId) {
    query += ' AND channel_id = ?'
    params.push(channelId)
  }

  if (startDate) {
    query += ' AND timestamp >= ?'
    params.push(startDate)
  }

  if (endDate) {
    query += ' AND timestamp <= ?'
    params.push(endDate + 'T23:59:59')
  }

  return { query, params, limit, offset }
}

function resolveUsernames (items) {
  const userMap = userModel.getUserMap()
  items.forEach(item => {
    if (item.username === item.user_id && userMap.has(item.user_id)) {
      item.username = userMap.get(item.user_id)
    }
  })
}

function getConversations (filters = {}) {
  const db = database.initialize()
  const { channelId, startDate, endDate, limit = 100, offset = 0 } = filters

  let query = `
    SELECT
      channel_id,
      channel_name,
      DATE(timestamp) as date,
      COUNT(*) as message_count,
      MIN(timestamp) as first_message,
      MAX(timestamp) as last_message,
      MAX(created_at) as updated_at
    FROM conversations
    WHERE 1=1
  `
  const params = []

  if (channelId) {
    query += ' AND channel_id = ?'
    params.push(channelId)
  }

  if (startDate) {
    query += ' AND DATE(timestamp) >= ?'
    params.push(startDate)
  }

  if (endDate) {
    query += ' AND DATE(timestamp) <= ?'
    params.push(endDate)
  }

  query += `
    GROUP BY channel_id, channel_name, DATE(timestamp)
    ORDER BY date DESC
    LIMIT ?
  `
  params.push(parseInt(limit))

  const summaries = db.prepare(query).all(...params)

  const conversations = summaries.map((summary, index) => ({
    id: `${summary.channel_id}-${summary.date}`,
    channel_id: summary.channel_id,
    channel_name: summary.channel_name,
    date: summary.date,
    message_count: summary.message_count,
    updated_at: summary.updated_at,
    first_message: summary.first_message,
    last_message: summary.last_message
  }))

  let countQuery = `
    SELECT COUNT(DISTINCT channel_id || '-' || DATE(timestamp)) as total
    FROM conversations
    WHERE 1=1
  `
  const countParams = []

  if (channelId) {
    countQuery += ' AND channel_id = ?'
    countParams.push(channelId)
  }

  if (startDate) {
    countQuery += ' AND DATE(timestamp) >= ?'
    countParams.push(startDate)
  }

  if (endDate) {
    countQuery += ' AND DATE(timestamp) <= ?'
    countParams.push(endDate)
  }

  const countResult = db.prepare(countQuery).get(...countParams)

  return {
    conversations,
    pagination: {
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: countResult.total > (parseInt(offset) + parseInt(limit))
    }
  }
}

function saveConversationsBulk (conversations, channelName, workspaceId) {
  const db = database.initialize()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO conversations (
      channel_id, channel_name, user_id, username, message_text,
      timestamp, message_type, thread_id, message_id, workspace_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction((convs) => {
    let savedCount = 0
    let skippedCount = 0

    for (const conv of convs) {
      try {
        stmt.run(
          conv.channel_id,
          channelName,
          conv.user_id,
          conv.username,
          conv.message_text,
          conv.timestamp,
          conv.message_type,
          conv.thread_id,
          conv.message_id,
          workspaceId
        )
        savedCount++
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          skippedCount++
          continue
        }
        console.error('❌ Error saving conversation:', error.message)
        throw error
      }
    }

    return { savedCount, skippedCount }
  })

  return transaction(conversations)
}

function organizeByThreads (messages) {
  const parentMessages = []
  const threadRepliesMap = new Map()

  for (const message of messages) {
    if (!message.thread_id) {
      parentMessages.push({
        ...message,
        replies: []
      })
      continue
    }

    const threadId = message.thread_id
    if (!threadRepliesMap.has(threadId)) {
      threadRepliesMap.set(threadId, [])
    }
    threadRepliesMap.get(threadId).push(message)
  }

  return { parentMessages, threadRepliesMap }
}

function attachRepliesToParents (parentMessages, threadRepliesMap) {
  return parentMessages.map(parent => {
    const replies = threadRepliesMap.get(parent.message_id) || []
    replies.sort((a, b) => {
      return new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    })
    return {
      ...parent,
      replies
    }
  })
}

function getConversationsByThread (filters = {}) {
  const db = database.initialize()
  const { query, params } = buildConversationQuery(filters)

  const finalQuery = query + ' ORDER BY timestamp ASC, message_id ASC'
  const allMessages = db.prepare(finalQuery).all(...params)

  resolveUsernames(allMessages)

  const { parentMessages, threadRepliesMap } = organizeByThreads(allMessages)
  const threadedConversations = attachRepliesToParents(
    parentMessages,
    threadRepliesMap
  )

  const { limit = 100, offset = 0 } = filters
  const paginatedParents = threadedConversations.slice(
    offset,
    offset + limit
  )

  let countQuery = 'SELECT COUNT(*) as total FROM conversations ' +
    'WHERE 1=1 AND thread_id IS NULL'
  const countParams = []

  if (filters.channelId) {
    countQuery += ' AND channel_id = ?'
    countParams.push(filters.channelId)
  }

  if (filters.startDate) {
    countQuery += ' AND timestamp >= ?'
    countParams.push(filters.startDate)
  }

  if (filters.endDate) {
    countQuery += ' AND timestamp <= ?'
    countParams.push(filters.endDate + 'T23:59:59')
  }

  const countResult = db.prepare(countQuery).get(...countParams)

  return {
    conversations: paginatedParents,
    pagination: {
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: countResult.total > (parseInt(offset) + parseInt(limit))
    }
  }
}

function getThreadReplies (threadId, filters = {}) {
  const db = database.initialize()
  const { channelId, limit = 100, offset = 0 } = filters

  let query = `
    SELECT channel_id, channel_name, user_id, username, message_text,
           timestamp, message_type, thread_id, message_id
    FROM conversations
    WHERE thread_id = ?
  `
  const params = [threadId]

  if (channelId) {
    query += ' AND channel_id = ?'
    params.push(channelId)
  }

  query += ' ORDER BY timestamp ASC, message_id ASC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const replies = db.prepare(query).all(...params)
  resolveUsernames(replies)

  let countQuery = 'SELECT COUNT(*) as total FROM conversations ' +
    'WHERE thread_id = ?'
  const countParams = [threadId]

  if (channelId) {
    countQuery += ' AND channel_id = ?'
    countParams.push(channelId)
  }

  const countResult = db.prepare(countQuery).get(...countParams)

  return {
    replies,
    pagination: {
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: countResult.total > (parseInt(offset) + parseInt(limit))
    }
  }
}

function saveConversation (conversationData) {
  const db = database.initialize()
  const {
    channelId,
    channelName,
    userId,
    username,
    messageText,
    timestamp,
    messageType = 'message',
    threadId,
    messageId,
    workspaceId
  } = conversationData

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO conversations (
      channel_id, channel_name, user_id, username, message_text,
      timestamp, message_type, thread_id, message_id, workspace_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  try {
    const result = stmt.run(
      channelId, channelName, userId, username, messageText, timestamp,
      messageType, threadId, messageId, workspaceId
    )
    return result.lastInsertRowid
  } catch (error) {
    console.error('❌ Error saving conversation:', error.message)
    throw error
  }
}

function getConversationCount () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM conversations')
  const result = stmt.get()
  return result.count
}

function getMessageCount () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM conversations')
  const result = stmt.get()
  return result.count
}

function getLastSyncDate () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT MAX(created_at) as lastSync FROM conversations')
  const result = stmt.get()
  return result?.lastSync || null
}
