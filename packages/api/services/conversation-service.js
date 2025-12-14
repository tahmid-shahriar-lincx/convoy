const slackApi = require('../external/slack-api')
const model = require('../models')

module.exports = {
  syncConversations
}

const MAX_DATE_RANGE = 365 * 24 * 60 * 60 * 1000

function validateDateRange (startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()

  if (start >= end) {
    return { valid: false, error: 'Start date must be before end date' }
  }

  if (end > now) {
    return { valid: false, error: 'End date cannot be in the future' }
  }

  if (end - start > MAX_DATE_RANGE) {
    return { valid: false, error: 'Date range cannot exceed 1 year' }
  }

  return { valid: true }
}

function formatProgressMessage (progress) {
  if (progress.status) {
    return `📊 ${progress.status}`
  }

  const threadInfo = progress.threadsProcessed > 0
    ? ` (${progress.threadsProcessed} threads, ` +
      `${progress.threadRepliesProcessed} replies)`
    : ''

  return `📊 Progress: ${progress.messagesProcessed} messages ` +
    `processed${threadInfo}...`
}

function createProgressCallback () {
  let totalMessages = 0
  let totalThreads = 0
  let totalThreadReplies = 0

  return async (progress) => {
    totalMessages = Math.max(
      totalMessages,
      progress.messagesProcessed || 0
    )
    totalThreads = Math.max(totalThreads, progress.threadsProcessed || 0)
    totalThreadReplies = Math.max(
      totalThreadReplies,
      progress.threadRepliesProcessed || 0
    )

    console.log(formatProgressMessage(progress))
  }
}

function getUserMapWithFallback (workspaceId) {
  const userMap = model.getUserMap(workspaceId)
  if (userMap.size === 0) {
    console.log('⚠️ No users available, will use user IDs as usernames')
  }
  return userMap
}

async function fetchAndStoreUsers (token, dCookie, workspaceId) {
  console.log('👥 Fetching users from Slack...')

  try {
    const users = await slackApi.getUsers(token, dCookie)
    if (users.length > 0) {
      const userResult = model.saveUsersBulk(users, workspaceId)
      console.log(`✅ Fetched and stored ${userResult.savedCount} users`)
      return model.getUserMap(workspaceId)
    }

    const userMap = model.getUserMap(workspaceId)
    if (userMap.size > 0) {
      console.log(`📦 Using ${userMap.size} existing users from database`)
    }
    return userMap
  } catch (error) {
    console.error('⚠️ Error fetching users:', error.message)
    return getUserMapWithFallback(workspaceId)
  }
}

function calculateThreadStats (conversations) {
  const parentMessages = conversations.filter(c => !c.thread_id)
  const threadReplies = conversations.filter(c => c.thread_id)
  const uniqueThreads = new Set(threadReplies.map(r => r.thread_id)).size

  return {
    parentMessages: parentMessages.length,
    threadReplies: threadReplies.length,
    uniqueThreads
  }
}

async function syncConversations (options) {
  const {
    channelId,
    channelName,
    startDate,
    endDate,
    includeBotMessages = false,
    token,
    dCookie,
    workspaceId
  } = options

  const validation = validateDateRange(startDate, endDate)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  console.log(
    `🚚 Starting conversation sync for channel: ${channelName} (${channelId})`
  )

  const progressCallback = createProgressCallback()

  const userMap = await fetchAndStoreUsers(token, dCookie, workspaceId)

  const conversations = await slackApi.getConversations(
    token,
    channelId,
    startDate,
    endDate,
    dCookie,
    progressCallback,
    userMap,
    includeBotMessages
  )

  if (conversations.length === 0) {
    return {
      success: true,
      messagesSynced: 0,
      duplicatesSkipped: 0,
      message: 'No conversations found in the specified date range'
    }
  }

  const result = model.saveConversationsBulk(
    conversations,
    channelName,
    workspaceId
  )
  const threadStats = calculateThreadStats(conversations)

  console.log(
    `✅ Sync complete: ${result.savedCount} new messages, ` +
    `${result.skippedCount} duplicates skipped`
  )
  console.log(
    `   📌 ${threadStats.parentMessages} parent messages, ` +
    `${threadStats.uniqueThreads} threads, ` +
    `${threadStats.threadReplies} thread replies`
  )

  const message =
    `Successfully synced ${result.savedCount} messages from ` +
    `${channelName} (${threadStats.uniqueThreads} threads, ` +
    `${threadStats.threadReplies} replies)`

  return {
    success: true,
    messagesSynced: result.savedCount,
    duplicatesSkipped: result.skippedCount,
    totalProcessed: conversations.length,
    threadsProcessed: threadStats.uniqueThreads,
    threadRepliesSynced: threadStats.threadReplies,
    message
  }
}
