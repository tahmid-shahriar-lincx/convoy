const database = require('../database')
const { extractThreadTasks } = require('../external/ollama')
const userModel = require('../models/user')

module.exports = {
  generateTasks,
  prepareTaskPipeline
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
    examplesCriteria = null
  } = options

  try {
    const conversations = await getConversationsForTaskGeneration({
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

    const workspaceId = conversations[0]?.workspace_id
    const userMap = userModel.getUserMap(workspaceId)
    const resolvedConversations = resolveUserNamesInMessages(conversations, userMap)

    const threadedData = organizeConversationsByThreads(resolvedConversations)

    const allTasks = []
    let messagesAnalyzed = 0

    for (const thread of threadedData.threads) {
      messagesAnalyzed += thread.messageCount

      try {
        const extractedTasks = await extractThreadTasks({
          thread: {
            threadId: thread.threadId,
            messageCount: thread.messageCount,
            messages: thread.messages
          },
          ollamaUrl,
          model,
          numCtx,
          systemPrompt,
          examplesCriteria
        })

        allTasks.push(...extractedTasks.map(task => ({
          task_title: task.task_title,
          task_description: task.task_description || ''
        })))
      } catch (error) {
        console.error(`Error processing thread ${thread.threadId}:`, error.message)
      }
    }

    for (const standalone of threadedData.standaloneMessages) {
      messagesAnalyzed += 1

      try {
        const extractedTasks = await extractThreadTasks({
          thread: {
            threadId: standalone.messageId,
            messageCount: 1,
            messages: [{
              role: 'parent',
              messageId: standalone.messageId,
              timestamp: standalone.timestamp,
              user: standalone.user,
              text: standalone.text
            }]
          },
          ollamaUrl,
          model,
          numCtx,
          systemPrompt,
          examplesCriteria
        })

        allTasks.push(...extractedTasks.map(task => ({
          task_title: task.task_title,
          task_description: task.task_description || ''
        })))
      } catch (error) {
        console.error(`Error processing standalone message ${standalone.messageId}:`, error.message)
      }
    }

    return {
      success: true,
      messagesAnalyzed,
      tasksExtracted: allTasks.length,
      tasks: allTasks,
      channelName,
      dateRange: `${startDate} to ${endDate}`
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
    endDate
  } = options

  const conversations = await getConversationsForTaskGeneration({
    channelId,
    startDate,
    endDate
  })

  const workspaceId = conversations[0]?.workspace_id
  const userMap = userModel.getUserMap(workspaceId)
  const resolvedConversations = resolveUserNamesInMessages(conversations, userMap)

  const threadedData = organizeConversationsByThreads(resolvedConversations)

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
      threadStats: {
        totalThreads: threadedData.threads.length,
        totalStandalone: threadedData.standaloneMessages.length,
        totalMessages: conversations.length
      },
      threads: conversationData.structure.threads,
      standaloneMessages: conversationData.structure.standaloneMessages
    }
  }
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

function fetchFullThreads (db, channelId, threadIds, startDate, endDate) {
  const threadIdsArray = Array.from(threadIds)

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

  if (threadIdsArray.length > 0) {
    const threadPlaceholders = threadIdsArray.map(() => '?').join(',')
    query += ` AND (
      thread_id IN (${threadPlaceholders})
      OR
      message_id IN (${threadPlaceholders})
      OR
      (thread_id IS NULL AND date(timestamp) >= date(?) AND date(timestamp) <= date(?))
    )`
    params.push(...threadIdsArray, ...threadIdsArray, startDate, endDate)
  } else {
    query += ` AND thread_id IS NULL
      AND date(timestamp) >= date(?)
      AND date(timestamp) <= date(?)`
    params.push(startDate, endDate)
  }

  query += ` ORDER BY
    CASE WHEN thread_id IS NULL THEN 0 ELSE 1 END,
    thread_id,
    timestamp ASC,
    message_id ASC`

  try {
    return db.prepare(query).all(...params)
  } catch (error) {
    console.error('Error fetching full threads:', error)
    return []
  }
}

function getConversationsForTaskGeneration (filters) {
  const db = database.initialize()
  const { channelId, startDate, endDate } = filters

  const threadIds = identifyRelevantThreads(db, channelId, startDate, endDate)

  return fetchFullThreads(db, channelId, threadIds, startDate, endDate)
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

  for (const message of conversations) {
    if (!message.thread_id) {
      standaloneMessages.push({
        messageId: message.message_id,
        timestamp: message.timestamp,
        user: message.username,
        text: message.message_text
      })
    } else {
      const threadId = message.thread_id
      if (!threads.has(threadId)) {
        threads.set(threadId, [])
      }

      threads.get(threadId).push({
        messageId: message.message_id,
        timestamp: message.timestamp,
        user: message.username,
        text: message.message_text
      })
    }
  }

  const finalThreads = []
  for (const [threadId, replies] of threads) {
    const parentMessage = conversations.find(m =>
      m.message_id === threadId && !m.thread_id
    )

    if (parentMessage) {
      const allMessages = [
        {
          role: 'parent',
          messageId: parentMessage.message_id,
          timestamp: parentMessage.timestamp,
          user: parentMessage.username,
          text: parentMessage.message_text
        },
        ...replies.sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp)
        ).map(reply => ({
          role: 'reply',
          messageId: reply.messageId,
          timestamp: reply.timestamp,
          user: reply.user,
          text: reply.text
        }))
      ]

      finalThreads.push({
        threadId,
        messageCount: allMessages.length,
        messages: allMessages
      })
    }
  }

  return {
    threads: finalThreads,
    standaloneMessages
  }
}

function prepareThreadedConversationData (threadedData, channelName, dateRange) {
  const { threads, standaloneMessages } = threadedData

  return {
    channel: channelName,
    dateRange,
    structure: {
      threads: threads.map(thread => ({
        threadId: thread.threadId,
        messageCount: thread.messageCount,
        messages: thread.messages
      })),
      standaloneMessages: standaloneMessages.map(msg => ({
        messageId: msg.messageId,
        timestamp: msg.timestamp,
        user: msg.user,
        text: msg.text
      }))
    }
  }
}


