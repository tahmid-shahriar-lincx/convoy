const axios = require('axios')

const SLACK_API_BASE = 'https://slack.com/api'

const DEFAULT_REQUEST_DELAY_MS =
  parseInt(process.env.SLACK_REQUEST_DELAY_MS || '250', 10)
const DEFAULT_PAGE_DELAY_MS =
  parseInt(process.env.SLACK_PAGE_DELAY_MS || '1000', 10)
const DEFAULT_RATE_LIMIT_MAX_RETRIES =
  parseInt(process.env.SLACK_RATE_LIMIT_MAX_RETRIES || '8', 10)

module.exports = {
  getChannels,
  validateToken,
  getUsers,
  getConversations
}

function sleep (ms) {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryAfterMs (error) {
  const header = error?.response?.headers?.['retry-after']
  const seconds = parseInt(header || '0', 10)
  if (!seconds || Number.isNaN(seconds)) return null
  return seconds * 1000
}

async function slackGet (endpoint, requestOptions = {}, retryOptions = {}) {
  const {
    requestDelayMs = DEFAULT_REQUEST_DELAY_MS,
    maxRetries = DEFAULT_RATE_LIMIT_MAX_RETRIES,
    attempt = 0
  } = retryOptions

  await sleep(requestDelayMs)

  try {
    return await axios.get(`${SLACK_API_BASE}${endpoint}`, {
      timeout: 0,
      ...requestOptions
    })
  } catch (error) {
    const status = error?.response?.status
    if (status === 429 && attempt < maxRetries) {
      const waitMs = getRetryAfterMs(error) || DEFAULT_PAGE_DELAY_MS
      console.log(`⏳ Slack rate limited (429). Waiting ${waitMs}ms...`)
      await sleep(waitMs)
      return slackGet(endpoint, requestOptions, {
        requestDelayMs,
        maxRetries,
        attempt: attempt + 1
      })
    }
    throw error
  }
}

async function validateToken (token, dCookie = null) {
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (dCookie) {
      headers.Cookie = `d=${dCookie}`
    }

    return await axios.post(`${SLACK_API_BASE}/auth.test`, {}, {
      headers
    })
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`)
  }
}

async function getChannels (token, dCookie = null) {
  try {
    const authResponse = await validateToken(token, dCookie)
    if (!authResponse.data.ok) {
      throw new Error(`Invalid token: ${authResponse.data.error}`)
    }

    const channelTypes = 'public_channel,private_channel,mpim,im'
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (dCookie) {
      headers.Cookie = `d=${dCookie}`
    }

    const response = await slackGet('/conversations.list', {
      headers,
      params: {
        types: channelTypes,
        exclude_archived: true,
        limit: 1000
      }
    })

    if (!response.data.ok) {
      throw new Error(`Failed to fetch channels: ${response.data.error}`)
    }

    return response.data.channels.map(channel => ({
      id: channel.id,
      name: channel.name || channel.user,
      display_name: getChannelDisplayName(channel),
      type: getChannelType(channel),
      is_private: channel.is_private || false,
      is_im: channel.is_im || false,
      is_mpim: channel.is_mpim || false,
      created: new Date(channel.created * 1000).toISOString(),
      num_members: channel.num_members || 0,
      last_read: channel.last_read || null,
      latest: channel.latest
        ? {
            timestamp: channel.latest.ts,
            text: channel.latest.text || '',
            user: channel.latest.user || ''
          }
        : null
    }))
  } catch (error) {
    if (error.response) {
      throw new Error(`Slack API error: ${error.response.data.error}`)
    }
    throw new Error(`Failed to fetch channels: ${error.message}`)
  }
}

function getChannelDisplayName (channel) {
  if (channel.name) {
    return channel.is_private ? `🔒 ${channel.name}` : `# ${channel.name}`
  }
  if (channel.is_im) {
    return '💬 Direct Message'
  }
  if (channel.is_mpim) {
    return '👥 Group Message'
  }
  return channel.id
}

function getChannelType (channel) {
  if (channel.is_im) return 'dm'
  if (channel.is_mpim) return 'group_dm'
  if (channel.is_private) return 'private'
  if (channel.is_general) return 'public'
  return 'public'
}

async function getUsers (token, dCookie = null) {
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (dCookie) {
      headers.Cookie = `d=${dCookie}`
    }

    const users = []
    let cursor = null
    let hasMore = true

    while (hasMore) {
      const params = {
        limit: 200
      }

      if (cursor) {
        params.cursor = cursor
      }

      const response = await slackGet('/users.list', {
        headers,
        params
      })

      if (!response.data.ok) {
        if (response.data.error === 'ratelimited') {
          await sleep(DEFAULT_PAGE_DELAY_MS)
          continue
        }
        throw new Error(`Failed to fetch users: ${response.data.error}`)
      }

      const slackUsers = response.data.members || []

      for (const user of slackUsers) {
        if (user.deleted || user.is_bot) {
          continue
        }

        users.push({
          user_id: user.id,
          username: user.name || null,
          real_name: user.real_name || null,
          display_name: user.profile?.display_name || user.real_name || user.name || null
        })
      }

      hasMore = response.data.response_metadata && response.data.response_metadata.next_cursor
      cursor = hasMore ? response.data.response_metadata.next_cursor : null

      if (hasMore) {
        await sleep(DEFAULT_PAGE_DELAY_MS)
      }
    }

    return users
  } catch (error) {
    if (error.response) {
      throw new Error(`Slack API error: ${error.response.data.error}`)
    }
    throw new Error(`Failed to fetch users: ${error.message}`)
  }
}

async function getThreadReplies (token, channelId, threadTs, dCookie = null, onProgress = null, userMap = null, includeBotMessages = false) {
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (dCookie) {
      headers.Cookie = `d=${dCookie}`
    }

    const replies = []
    let cursor = null
    let hasMore = true

    while (hasMore) {
      const params = {
        channel: channelId,
        ts: threadTs,
        limit: 100
      }

      if (cursor) {
        params.cursor = cursor
      }

      const response = await slackGet('/conversations.replies', {
        headers,
        params
      })

      if (!response.data.ok) {
        if (response.data.error === 'ratelimited') {
          await sleep(DEFAULT_PAGE_DELAY_MS)
          continue
        }
        throw new Error(`Failed to fetch thread replies: ${response.data.error}`)
      }

      const messages = response.data.messages || []

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        if (message.ts === threadTs && i === 0) {
          continue
        }

        if (!includeBotMessages && (message.bot_id || message.subtype === 'bot_message')) {
          continue
        }

        const userId = message.user || 'unknown'
        const username = userMap && userMap.has(userId) ? userMap.get(userId) : userId

        const reply = {
          message_id: message.ts,
          channel_id: channelId,
          user_id: userId,
          username,
          message_text: message.text || '',
          message_type: message.subtype || 'message',
          timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
          thread_id: threadTs,
          message_json: JSON.stringify(message)
        }

        replies.push(reply)
      }

      hasMore = response.data.has_more && response.data.response_metadata && response.data.response_metadata.next_cursor
      cursor = hasMore ? response.data.response_metadata.next_cursor : null

      if (hasMore) {
        await sleep(DEFAULT_PAGE_DELAY_MS)
      }
    }

    return replies
  } catch (error) {
    if (error.response) {
      throw new Error(`Slack API error: ${error.response.data.error}`)
    }
    throw new Error(`Failed to fetch thread replies: ${error.message}`)
  }
}

async function getConversations (token, channelId, startDate, endDate, dCookie = null, onProgress = null, userMap = null, includeBotMessages = false) {
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (dCookie) {
      headers.Cookie = `d=${dCookie}`
    }

    const startTimestamp = new Date(startDate).getTime() / 1000
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime() / 1000

    const conversations = []
    let cursor = null
    let hasMore = true
    let messagesProcessed = 0
    let threadsProcessed = 0
    let threadRepliesProcessed = 0

    console.log(`🚚 Starting conversation sync for channel ${channelId}`)
    console.log(`📅 Date range: ${startDate} to ${endDate}`)
    console.log(`⏰ Timestamp range: ${startTimestamp} to ${endTimestamp}`)

    while (hasMore) {
      const params = {
        channel: channelId,
        limit: 100,
        oldest: startTimestamp.toString(),
        latest: endTimestamp.toString(),
        inclusive: true
      }

      if (cursor) {
        params.cursor = cursor
      }

      const response = await slackGet('/conversations.history', {
        headers,
        params
      })

      if (!response.data.ok) {
        if (response.data.error === 'ratelimited') {
          await sleep(DEFAULT_PAGE_DELAY_MS)
          continue
        }
        throw new Error(`Failed to fetch conversations: ${response.data.error}`)
      }

      const messages = response.data.messages || []

      const filteredMessages = messages.filter(msg => {
        const msgTimestamp = parseFloat(msg.ts)
        return msgTimestamp >= startTimestamp && msgTimestamp <= endTimestamp
      })

      for (const message of filteredMessages) {
        if (message.thread_ts && message.thread_ts !== message.ts) {
          continue
        }

        if (!includeBotMessages && (message.bot_id || message.subtype === 'bot_message')) {
          continue
        }

        const userId = message.user || 'unknown'
        const username = userMap && userMap.has(userId) ? userMap.get(userId) : userId

        const conversation = {
          message_id: message.ts,
          channel_id: channelId,
          user_id: userId,
          username,
          message_text: message.text || '',
          message_type: message.subtype || 'message',
          timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
          thread_id: null,
          message_json: JSON.stringify(message)
        }

        conversations.push(conversation)
        messagesProcessed++

        if (message.reply_count > 0 || message.replies) {
          try {
            threadsProcessed++
            if (onProgress) {
              await onProgress({
                messagesProcessed,
                threadsProcessed,
                threadRepliesProcessed,
                currentBatch: messages.length,
                hasMore: response.data.has_more,
                status: `Fetching thread replies for message ${message.ts}...`
              })
            }
            await sleep(DEFAULT_REQUEST_DELAY_MS)
            const threadReplies = await getThreadReplies(token, channelId, message.ts, dCookie, onProgress, userMap, includeBotMessages)
            conversations.push(...threadReplies)
            threadRepliesProcessed += threadReplies.length
            messagesProcessed += threadReplies.length
          } catch (error) {
            console.error(`⚠️ Error fetching thread replies for message ${message.ts}:`, error.message)
          }
        }
      }

      if (onProgress && messagesProcessed % 10 === 0) {
        await onProgress({
          messagesProcessed,
          threadsProcessed,
          threadRepliesProcessed,
          currentBatch: messages.length,
          hasMore: response.data.has_more
        })
      }

      hasMore = response.data.has_more && response.data.response_metadata && response.data.response_metadata.next_cursor
      cursor = hasMore ? response.data.response_metadata.next_cursor : null

      if (hasMore) {
        await sleep(DEFAULT_PAGE_DELAY_MS)
      }

      console.log(`📦 Processed ${messagesProcessed} messages...`)
    }

    console.log(`✅ Completed sync. Total messages: ${conversations.length} (${threadsProcessed} threads, ${threadRepliesProcessed} thread replies)`)
    return conversations
  } catch (error) {
    if (error.response) {
      throw new Error(`Slack API error: ${error.response.data.error}`)
    }
    throw new Error(`Failed to fetch conversations: ${error.message}`)
  }
}
