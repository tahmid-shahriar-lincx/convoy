const database = require('../database')
const { extractTasksWithMultiPass } = require('../external/ollama')
const userModel = require('../models/user')

module.exports = {
  generateTasks,
  prepareTaskPipeline,
  getConversationsForTaskGeneration,
  getConversationsWithThreadAwareFiltering,
  resolveUserNamesInMessages,
  organizeConversationsByThreads,
  prepareThreadedConversationData,
  prepareThreadedConversationText,
  prepareConversationText
}

function getConversationsForTaskGeneration (filters) {
  const db = database.initialize()
  const { channelId, startDate, endDate, limit = 10000, offset = 0 } = filters

  let query = `
    SELECT
      message_id,
      channel_id,
      channel_name,
      user_id,
      username,
      message_text,
      timestamp,
      thread_id,
      message_type,
      workspace_id
    FROM conversations
    WHERE channel_id = ?
  `

  const params = [channelId]

  if (startDate) {
    query += ' AND date(timestamp) >= date(?)'
    params.push(startDate)
  }

  if (endDate) {
    query += ' AND date(timestamp) <= date(?)'
    params.push(endDate)
  }

  query += ` ORDER BY
    CASE WHEN thread_id IS NULL THEN 0 ELSE 1 END,
    thread_id,
    timestamp ASC,
    message_id ASC
    LIMIT ? OFFSET ?`
  params.push(limit, offset)

  return db.prepare(query).all(...params)
}

function resolveUserNamesInMessages (messages, userMap) {
  return messages.map(message => {
    let username = message.username
    if (userMap.has(message.user_id)) {
      username = userMap.get(message.user_id)
    }

    if (!username || username === message.user_id) {
      username = message.user_id || 'Unknown'
    }

    return {
      ...message,
      username
    }
  })
}

function organizeConversationsByThreads (conversations) {
  const threads = new Map()
  const standaloneMessages = []
  const parentMessageMap = new Map()

  for (const message of conversations) {
    if (!message.thread_id) {
      if (!parentMessageMap.has(message.message_id)) {
        parentMessageMap.set(message.message_id, {
          messageId: message.message_id,
          timestamp: message.timestamp,
          user: message.username,
          text: message.message_text,
          replies: []
        })
      }

      if (threads.has(message.message_id)) {
        parentMessageMap.get(message.message_id).replies = threads.get(message.message_id)
        threads.delete(message.message_id)
      } else {
        standaloneMessages.push(parentMessageMap.get(message.message_id))
      }
    } else {
      const threadId = message.thread_id
      if (!threads.has(threadId)) {
        threads.set(threadId, [])
      }

      const reply = {
        messageId: message.message_id,
        timestamp: message.timestamp,
        user: message.username,
        text: message.message_text
      }

      threads.get(threadId).push(reply)

      if (parentMessageMap.has(threadId)) {
        parentMessageMap.get(threadId).replies.push(reply)
      }
    }
  }

  for (const [, replies] of threads) {
    replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  }

  const finalThreads = []
  for (const [parentMessageId, parentMessage] of parentMessageMap) {
    if (parentMessage.replies.length > 0) {
      finalThreads.push({
        threadId: parentMessageId,
        parentMessage: {
          messageId: parentMessage.messageId,
          timestamp: parentMessage.timestamp,
          user: parentMessage.user,
          text: parentMessage.text
        },
        replies: parentMessage.replies,
        messageCount: 1 + parentMessage.replies.length
      })
    }
  }

  const threadedMessageIds = new Set(finalThreads.map(t => t.parentMessage.messageId))
  const filteredStandalone = standaloneMessages.filter(msg => !threadedMessageIds.has(msg.messageId))

  return {
    threads: finalThreads,
    standaloneMessages: filteredStandalone
  }
}

function formatThreadAsJson (thread) {
  return {
    type: 'thread',
    threadId: thread.threadId,
    messageCount: thread.messageCount,
    messages: [
      {
        role: 'parent',
        messageId: thread.parentMessage.messageId,
        timestamp: thread.parentMessage.timestamp,
        user: thread.parentMessage.user,
        text: thread.parentMessage.text
      },
      ...thread.replies.map(reply => ({
        role: 'reply',
        messageId: reply.messageId,
        timestamp: reply.timestamp,
        user: reply.user,
        text: reply.text
      }))
    ]
  }
}

function formatStandaloneMessagesAsJson (messages) {
  return {
    type: 'messages',
    messages: messages.map(msg => ({
      messageId: msg.messageId,
      timestamp: msg.timestamp,
      user: msg.user,
      text: msg.text
    }))
  }
}

function prepareThreadedConversationData (threadedData, channelName, dateRange) {
  const { threads, standaloneMessages } = threadedData

  return {
    channel: channelName,
    dateRange,
    totalThreads: threads.length,
    totalStandaloneMessages: standaloneMessages.length,
    structure: {
      threads: threads.map(formatThreadAsJson),
      standaloneMessages: standaloneMessages.length > 0
        ? formatStandaloneMessagesAsJson(standaloneMessages).messages
        : []
    }
  }
}

function prepareThreadedConversationText (threadedData, channelName, dateRange) {
  const conversationData =
    prepareThreadedConversationData(threadedData, channelName, dateRange)
  return JSON.stringify(conversationData, null, 2)
}

function identifyRelevantThreads (db, channelId, startDate, endDate) {
  const query = `
    SELECT DISTINCT c.thread_id
    FROM conversations c
    WHERE c.channel_id = ?
      AND c.thread_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM conversations c2
        WHERE c2.thread_id = c.thread_id
          AND date(c2.timestamp) >= date(?)
          AND date(c2.timestamp) <= date(?)
      )
  `

  try {
    const threads = db.prepare(query).all(channelId, startDate, endDate)
    return new Set(threads.map(t => t.thread_id))
  } catch (error) {
    console.error('Error identifying relevant threads:', error)
    return new Set()
  }
}

function fetchCompleteConversations (db, channelId, threadIds, startDate, endDate, limit, offset) {
  const threadIdsArray = Array.from(threadIds)
  const threadPlaceholders = threadIdsArray.length > 0
    ? threadIdsArray.map(() => '?').join(',')
    : 'NULL'
  let query = `
    SELECT
      message_id,
      channel_id,
      channel_name,
      user_id,
      username,
      message_text,
      timestamp,
      thread_id,
      message_type,
      workspace_id
    FROM conversations
    WHERE channel_id = ?
      AND (
        thread_id IN (${threadPlaceholders})
        OR
        message_id IN (${threadPlaceholders})
        OR
        (thread_id IS NULL AND date(timestamp) >= date(?) AND date(timestamp) <= date(?))
      )
  `

  const params = [channelId, ...threadIdsArray, ...threadIdsArray, startDate, endDate]

  query += ` ORDER BY
    CASE WHEN thread_id IS NULL THEN 0 ELSE 1 END,
    thread_id,
    timestamp ASC,
    message_id ASC
    LIMIT ? OFFSET ?`

  params.push(limit, offset)

  try {
    return db.prepare(query).all(...params)
  } catch (error) {
    console.error('Error fetching complete conversations:', error)
    return []
  }
}

function getConversationsWithThreadAwareFiltering (filters) {
  const db = database.initialize()
  const { channelId, startDate, endDate, limit = 10000, offset = 0 } = filters

  const threadIds = identifyRelevantThreads(db, channelId, startDate, endDate)

  return fetchCompleteConversations(db, channelId, threadIds, startDate, endDate, limit, offset)
}

async function generateTasks (options) {
  const {
    channelId,
    channelName,
    startDate,
    endDate,
    ollamaUrl,
    model = 'gemma3:4b',
    numCtx = null,
    systemPrompt = null,
    examplesCriteria = null,
    useThreading = true,
    threadAwareDateFiltering = true
  } = options

  try {
    const conversations = useThreading && threadAwareDateFiltering
      ? await getConversationsWithThreadAwareFiltering({
        channelId,
        startDate,
        endDate
      })
      : await getConversationsForTaskGeneration({
        channelId,
        startDate,
        endDate
      })

    if (conversations.length === 0) {
      return {
        success: true,
        messagesAnalyzed: 0,
        tasksExtracted: 0,
        tasks: [],
        channelName,
        dateRange: `${startDate} to ${endDate}`
      }
    }

    let conversationText
    let threadStats = {}

    if (useThreading) {
      const workspaceId = conversations[0]?.workspace_id

      const userMap = userModel.getUserMap(workspaceId)
      const resolvedConversations = resolveUserNamesInMessages(conversations, userMap)

      const threadedData = organizeConversationsByThreads(resolvedConversations)

      threadStats = {
        totalThreads: threadedData.threads.length,
        totalStandalone: threadedData.standaloneMessages.length,
        totalMessages: conversations.length
      }

      conversationText = prepareThreadedConversationText(
        threadedData,
        channelName,
        `${startDate} to ${endDate}`
      )
    } else {
      conversationText = prepareConversationText(conversations)
    }

    const extractedTasks = await extractTasksWithMultiPass({
      conversationText,
      ollamaUrl,
      model,
      numCtx,
      systemPrompt,
      examplesCriteria
    })

    const organizedTasks = organizeTaskHierarchy(extractedTasks)

    return {
      success: true,
      messagesAnalyzed: conversations.length,
      tasksExtracted: organizedTasks.length,
      tasks: organizedTasks,
      channelName,
      dateRange: `${startDate} to ${endDate}`,
      ...(useThreading && {
        threadStats,
        conversationFormat: 'threaded-json',
        threadAwareDateFiltering,
        dateFilteringMethod: threadAwareDateFiltering
          ? 'thread-aware (complete threads included)'
          : 'individual message filtering'
      })
    }
  } catch (error) {
    console.error('Task generation failed:', error)
    throw new Error(`Task generation failed: ${error.message}`)
  }
}

async function prepareTaskPipeline (options) {
  const {
    channelId,
    channelName,
    startDate,
    endDate,
    useThreading = true,
    threadAwareDateFiltering = true
  } = options

  const conversations = useThreading && threadAwareDateFiltering
    ? await getConversationsWithThreadAwareFiltering({
      channelId,
      startDate,
      endDate
    })
    : await getConversationsForTaskGeneration({
      channelId,
      startDate,
      endDate
    })

  const workspaceId = conversations[0]?.workspace_id
  const userMap = userModel.getUserMap(workspaceId)
  const resolvedConversations = resolveUserNamesInMessages(conversations, userMap)
  const threadedData = organizeConversationsByThreads(resolvedConversations)

  const threadStats = {
    totalThreads: threadedData.threads.length,
    totalStandalone: threadedData.standaloneMessages.length,
    totalMessages: conversations.length
  }

  const dateRange = `${startDate} to ${endDate}`
  const conversationData = prepareThreadedConversationData(
    threadedData,
    channelName,
    dateRange
  )

  return {
    success: true,
    prepared: {
      channelId,
      channelName,
      dateRange,
      threadStats,
      threads: conversationData.structure.threads,
      standaloneMessages: conversationData.structure.standaloneMessages
    }
  }
}

function organizeTaskHierarchy (tasks) {
  return tasks.map(task => ({
    task_title: task.task_title,
    task_description: task.task_description || ''
  }))
}

function formatConversationMessage (conv) {
  const date = new Date(conv.timestamp)
  const timeStr = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const username = conv.username || conv.user_id || 'Unknown'
  const message = conv.message_text || ''

  return `[${timeStr}] ${username}: ${message}`
}

function prepareConversationText (conversations) {
  const sorted = conversations.sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  )

  return sorted.map(formatConversationMessage).join('\n')
}
