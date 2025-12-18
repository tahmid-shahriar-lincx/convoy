const model = require('./models')
const slackApi = require('./external/slack-api')
const { extractThreadTasks: extractTasksFromThread } = require('./external/ollama')
const tokenService = require('./services/token-service')
const statsService = require('./services/stats-service')
const conversationService = require('./services/conversation-service')
const taskGenerationService = require('./services/task-generation-service-simplified')
const taskService = require('./services/task-service')
const taskMergeService = require('./services/task-merge-service')
const promptService = require('./services/prompt-service')

async function getOllamaModels (req, res) {
  const { ollamaUrl } = req.query

  if (!ollamaUrl) {
    return res.status(400).json({
      success: false,
      error: 'Ollama URL is required'
    })
  }

  try {
    const axios = require('axios')
    const url = ollamaUrl.startsWith('http://') || ollamaUrl.startsWith('https://')
      ? `${ollamaUrl}/api/tags`
      : `http://${ollamaUrl}/api/tags`

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const models = response.data.models || []
    const modelNames = models.map(model => model.name || model.model || model).filter(Boolean)

    res.json({
      success: true,
      models: modelNames,
      count: modelNames.length
    })
  } catch (error) {
    console.error('❌ Error fetching Ollama models:', error.message)
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch models from Ollama'
    })
  }
}

module.exports = {
  getTokens,
  getStats,
  saveToken,
  extractApiToken,
  resetToken,
  getChannels,
  refreshChannels,
  renewToken,
  syncConversations,
  getConversations,
  getUsers,
  generateTasks,
  prepareTaskPipeline,
  extractThreadTasks,
  mergeTaskCandidates,
  saveTask,
  getTasks,
  deleteTask,
  updateTask,
  updateTaskKanban,
  getOllamaModels,
  getPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  setDefaultPrompt
}

function getTokens (req, res) {
  try {
    const tokens = model.getAllTokens()
    const tokenCount = model.getTokenCount()

    res.json({
      success: true,
      count: tokenCount,
      tokens
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tokens'
    })
  }
}

function getStats (req, res) {
  try {
    const stats = statsService.getDatabaseStats()

    res.json(stats)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database stats'
    })
  }
}

async function saveToken (req, res) {
  try {
    const result = await tokenService.saveTokenWithValidation({
      token: req.body.token,
      dCookie: req.body.dCookie || null,
      request: req
    })

    if (!result.success) {
      return res.status(400).send(result.error)
    }

    res.redirect('/?success=true')
  } catch (error) {
    console.error('❌ Error deploying token to convoy:', error.message)
    res.status(500).send('Error loading token into convoy')
  }
}

async function extractApiToken (req, res) {
  try {
    const { workspaceUrl, dCookie } = req.body

    if (!workspaceUrl || !dCookie) {
      return res.status(400).json({
        success: false,
        error: 'Workspace URL and d cookie are required'
      })
    }

    const result = await tokenService.extractAndSaveToken({
      workspaceUrl,
      dCookie,
      request: req
    })

    res.json({
      success: true,
      token: result.token,
      user: result.testResponse.data.user,
      team: result.testResponse.data.team,
      url: result.testResponse.data.url,
      tokenId: result.tokenId
    })
  } catch (error) {
    console.error('❌ Error extracting API token:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function resetToken (req, res) {
  try {
    model.deleteAllTokens()
    res.redirect('/')
  } catch (error) {
    console.error('❌ Error removing tokens:', error.message)
    res.status(500).send('Error removing tokens')
  }
}

async function getChannels (req, res) {
  try {
    const tokens = model.getAllTokens()
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No token deployed. Please add a token first.'
      })
    }

    const activeToken = tokens[0]
    const workspaceId = activeToken.workspaceName || 'unknown'

    const storedChannels = model.getAllChannels(workspaceId)

    if (storedChannels.length > 0) {
      console.log(
        `📋 Returning ${storedChannels.length} channels from database for workspace: ${workspaceId}`
      )
      return res.json({
        success: true,
        channels: storedChannels,
        token_info: {
          id: activeToken.id,
          created: activeToken.createdAt
        },
        source: 'database'
      })
    }

    console.log(
      `🚚 Fetching channels from Slack API using deployed token ID: ${activeToken.id}`
    )

    const dCookie = activeToken.dCookie || null
    const channels = await slackApi.getChannels(
      activeToken.tokenValue,
      dCookie
    )

    console.log(`📋 Successfully fetched ${channels.length} channels from Slack API`)

    const saveResult = model.saveChannelsBulk(channels, workspaceId)
    console.log(`💾 Stored ${saveResult.savedCount} channels in database`)

    res.json({
      success: true,
      channels,
      token_info: {
        id: activeToken.id,
        created: activeToken.createdAt
      },
      source: 'api'
    })
  } catch (error) {
    console.error('❌ Error fetching channels:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function refreshChannels (req, res) {
  try {
    const tokens = model.getAllTokens()
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No token deployed. Please add a token first.'
      })
    }

    const activeToken = tokens[0]
    const workspaceId = activeToken.workspaceName || 'unknown'

    console.log(
      `🔄 Refreshing channels from Slack API using deployed token ID: ${activeToken.id}`
    )

    const dCookie = activeToken.dCookie || null
    const channels = await slackApi.getChannels(
      activeToken.tokenValue,
      dCookie
    )

    console.log(`📋 Successfully fetched ${channels.length} channels from Slack API`)

    const deletedCount = model.deleteChannelsByWorkspace(workspaceId)
    console.log(`🗑️ Deleted ${deletedCount} existing channels from database`)

    const saveResult = model.saveChannelsBulk(channels, workspaceId)
    console.log(`💾 Stored ${saveResult.savedCount} channels in database`)

    res.json({
      success: true,
      channels,
      token_info: {
        id: activeToken.id,
        created: activeToken.createdAt
      },
      deleted: deletedCount,
      saved: saveResult.savedCount
    })
  } catch (error) {
    console.error('❌ Error refreshing channels:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function renewToken (req, res) {
  try {
    const tokens = model.getAllTokens()
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No token found. Please add a token first.'
      })
    }

    const currentToken = tokens[0]

    const result = await tokenService.renewTokenFromWorkspace({
      currentToken,
      request: req
    })

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      })
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      team: result.team,
      url: result.url,
      tokenId: result.tokenId
    })
  } catch (error) {
    console.error('❌ Error renewing API token:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function syncConversations (req, res) {
  const { channelId, channelName, startDate, endDate, includeBotMessages = false } = req.body

  if (!channelId || !channelName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: channelId, channelName'
    })
  }

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: startDate, endDate'
    })
  }

  try {
    const tokens = model.getAllTokens()
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No token deployed. Please add a token first.'
      })
    }

    const activeToken = tokens[0]
    const workspaceId = activeToken.workspaceName || 'unknown'

    const result = await conversationService.syncConversations({
      channelId,
      channelName,
      startDate,
      endDate,
      includeBotMessages,
      token: activeToken.tokenValue,
      dCookie: activeToken.dCookie,
      workspaceId
    })

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      })
    }

    res.json({
      success: true,
      ...result,
      message: `Successfully synced ${channelName} (${result.messagesSynced || 0} messages)`
    })
  } catch (error) {
    console.error('❌ Error syncing conversations:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function getConversations (req, res) {
  const { channelId, startDate, endDate, limit = 100, offset = 0 } = req.query

  try {
    const result = model.getConversations({
      channelId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json({
      success: true,
      conversations: result.conversations,
      pagination: result.pagination
    })
  } catch (error) {
    console.error('❌ Error fetching conversations:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function getUsers (req, res) {
  try {
    const users = model.getAllUsers()
    const userMap = {}
    users.forEach(user => {
      const displayName = user.display_name || user.real_name || user.username || user.user_id
      userMap[user.user_id] = displayName
    })

    res.json({
      success: true,
      users,
      userMap
    })
  } catch (error) {
    console.error('❌ Error fetching users:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function generateTasks (req, res) {
  const {
    channelId,
    channelName,
    startDate,
    endDate,
    ollamaUrl,
    model,
    numCtx,
    systemPrompt,
    examplesCriteria,
    useThreading,
    promptTemplate,
    requiredGroundingRules,
    defaultSystemMessage
  } = req.body

  if (!channelId || !channelName || !startDate || !endDate || !ollamaUrl || !model) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: channelId, channelName, startDate, endDate, ollamaUrl, model'
    })
  }

  try {
    const threadingMode = useThreading !== false ? 'enabled' : 'disabled'

    console.log(`🧪 Generating task list (not saved) for channel: ${channelName}`)
    console.log(`📋 Threading: ${threadingMode}`)

    const result = await taskGenerationService.generateTasks({
      channelId,
      channelName,
      startDate,
      endDate,
      ollamaUrl,
      model,
      numCtx,
      systemPrompt,
      examplesCriteria,
      useThreading: useThreading !== false,
      promptTemplate,
      requiredGroundingRules,
      defaultSystemMessage
    })

    res.json(result)
  } catch (error) {
    console.error('❌ Error generating tasks:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function prepareTaskPipeline (req, res) {
  const {
    channelId,
    channelName,
    startDate,
    endDate
  } = req.body

  if (!channelId || !channelName || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: channelId, channelName, startDate, endDate'
    })
  }

  try {
    const result = await taskGenerationService.prepareTaskPipeline({
      channelId,
      channelName,
      startDate,
      endDate,
      useThreading: true
    })
    res.json(result)
  } catch (error) {
    console.error('❌ Error preparing task pipeline:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function extractThreadTasks (req, res) {
  const {
    thread,
    ollamaUrl,
    model,
    numCtx,
    systemPrompt,
    examplesCriteria,
    promptTemplate,
    requiredGroundingRules,
    defaultSystemMessage
  } = req.body

  if (!thread || !ollamaUrl || !model) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: thread, ollamaUrl, model'
    })
  }

  try {
    const tasks = await extractTasksFromThread({
      thread,
      ollamaUrl,
      model,
      numCtx: Number.isFinite(numCtx) ? numCtx : null,
      systemPrompt,
      examplesCriteria,
      promptTemplate,
      requiredGroundingRules,
      defaultSystemMessage
    })

    res.json({
      success: true,
      threadId: (thread.threadId || '').toString(),
      tasks
    })
  } catch (error) {
    console.error('❌ Error extracting thread tasks:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function mergeTaskCandidates (req, res) {
  const { candidates, strategy } = req.body

  if (!Array.isArray(candidates)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: candidates (array)'
    })
  }

  try {
    const tasks = taskMergeService.mergeTaskCandidates({
      candidates,
      strategy
    })

    res.json({
      success: true,
      tasks
    })
  } catch (error) {
    console.error('❌ Error merging task candidates:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function getTasks (req, res) {
  try {
    const { channelId, limit = 200, offset = 0 } = req.query
    const result = taskService.listTasks({
      channelId: channelId || null,
      limit,
      offset
    })

    res.json(result)
  } catch (error) {
    console.error('❌ Error getting tasks:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function saveTask (req, res) {
  try {
    const {
      channelId,
      channelName,
      model,
      task_title: taskTitle,
      task_description: taskDescription,
      parent_thread_id: parentThreadId
    } = req.body

    if (!taskTitle || !taskTitle.toString().trim()) {
      return res.status(400).json({
        success: false,
        error: 'Task title is required'
      })
    }

    const result = taskService.saveTask({
      channelId: channelId || null,
      channelName: channelName || null,
      model: model || null,
      taskTitle,
      taskDescription,
      parentThreadId: parentThreadId || null
    })

    res.json(result)
  } catch (error) {
    console.error('❌ Error saving task:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function deleteTask (req, res) {
  const { taskId } = req.params

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required'
    })
  }

  try {
    const id = parseInt(taskId, 10)
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        error: 'Task ID must be a number'
      })
    }

    const result = taskService.deleteTask(id)
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      })
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error deleting task:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function updateTask (req, res) {
  const { taskId } = req.params
  const { task_title: taskTitle, task_description: taskDescription } = req.body

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required'
    })
  }

  try {
    const result = taskService.updateTask(taskId, {
      taskTitle,
      taskDescription
    })

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Task not found'
      })
    }

    res.json(result)
  } catch (error) {
    console.error('❌ Error updating task:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

function updateTaskKanban (req, res) {
  const { taskId } = req.params
  const { columnId, position } = req.body || {}

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required'
    })
  }

  if (!columnId) {
    return res.status(400).json({
      success: false,
      error: 'columnId is required'
    })
  }

  try {
    const result = taskService.updateTaskKanban(taskId, {
      columnId: columnId.toString(),
      position
    })

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Task not found'
      })
    }

    res.json(result)
  } catch (error) {
    console.error('❌ Error updating task kanban:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function getPrompts (req, res) {
  try {
    const { type, createdBy } = req.query
    const prompts = await promptService.getPrompts({ type, createdBy })

    res.json({
      success: true,
      prompts
    })
  } catch (error) {
    console.error('❌ Error fetching prompts:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function getPrompt (req, res) {
  try {
    const { id } = req.params
    const prompt = await promptService.getPrompt(id)

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      })
    }

    res.json({
      success: true,
      prompt
    })
  } catch (error) {
    console.error('❌ Error fetching prompt:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function createPrompt (req, res) {
  try {
    const { name, description, promptTemplate, isDefault = false, createdBy } = req.body

    if (!name || !promptTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Name and promptTemplate are required'
      })
    }

    const prompt = await promptService.createPrompt({
      name,
      description,
      promptTemplate,
      isDefault,
      createdBy
    })

    res.status(201).json({
      success: true,
      prompt
    })
  } catch (error) {
    console.error('❌ Error creating prompt:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function updatePrompt (req, res) {
  try {
    const { id } = req.params
    const { name, description, promptTemplate, isDefault } = req.body

    const prompt = await promptService.updatePrompt(id, {
      name,
      description,
      promptTemplate,
      isDefault
    })

    res.json({
      success: true,
      prompt
    })
  } catch (error) {
    console.error('❌ Error updating prompt:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function deletePrompt (req, res) {
  try {
    const { id } = req.params
    const success = await promptService.deletePrompt(id)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found or cannot be deleted'
      })
    }

    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error deleting prompt:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

async function setDefaultPrompt (req, res) {
  try {
    const { id } = req.params
    const prompt = await promptService.setDefaultPrompt(id)

    res.json({
      success: true,
      prompt
    })
  } catch (error) {
    console.error('❌ Error setting default prompt:', error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
