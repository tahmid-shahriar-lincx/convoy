const axios = require('axios')
const fs = require('fs')
const path = require('path')
const taskScoring = require('../services/task-scoring')
const grounding = require('./task-grounding')

const LOGS_DIR = path.join(__dirname, '..', 'logs')

const THREAD_TASK_SCHEMA = {
  type: 'object',
  properties: {
    task_title: { type: 'string' },
    task_description: { type: 'string' }
  },
  required: ['task_title', 'task_description']
}

const THREAD_TASK_ARRAY_SCHEMA = {
  type: 'array',
  items: THREAD_TASK_SCHEMA
}

const DEFAULT_PROMPT_TEMPLATE = `Extract actionable tasks from this single Slack thread. Return a JSON array matching this schema:

\${schemaDescription}

IMPORTANT:
- Only return tasks that are explicitly supported by the thread text.
- If there is no clear actionable work request, return [].
- If there is an explicit request but key details are missing, you may return an "Investigate X" task,
  but it must still be grounded in the thread text and reuse the thread's nouns/entities.
- Prefer concrete, grounded titles that reuse key nouns from the thread.
- task_title should be as specific as the thread allows (but don't return []
  just because the title can't be perfect).
- task_description MUST be a short narrative summary (1-4 sentences).
  It should summarize what happened in the thread and the intended outcome/next action.
  DO NOT include acceptance-criteria templates, bullet lists, or embedded quotes.

\${examplesCriteria}

Thread (JSON):
\${threadJson}`

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

module.exports = {
  extractThreadTasks
}

function validateEvidenceAgainstThread (task, thread) {
  const threadId = (thread?.threadId || '').toString()
  const evidence = task?.evidence || null
  if (!evidence) return false
  if ((evidence?.threadId || '').toString() !== threadId) return false
  const ids = Array.isArray(evidence?.messageIds)
    ? evidence.messageIds.map(id => id.toString()).filter(Boolean)
    : []
  if (ids.length === 0) return false

  const msgIds = new Set(
    (Array.isArray(thread?.messages) ? thread.messages : [])
      .map(m => (m?.messageId || '').toString())
      .filter(Boolean)
  )
  for (const id of ids) {
    if (!msgIds.has(id)) return false
  }
  return true
}

function isPRReviewTask (task) {
  const title = (task?.task_title || '').toString()
  const description = (task?.task_description || '').toString()
  const text = `${title}\n${description}`
  const prReviewPattern =
    /\breview\b[\s\S]{0,40}\b(pr|pull request)\b|\b(pr|pull request)\b[\s\S]{0,40}\breview\b|\bcode review\b/i
  return prReviewPattern.test(text)
}

function writeToLogFile (message) {
  try {
    const timestamp = new Date().toISOString()
    const dateStr = new Date().toISOString().split('T')[0]
    const logFileName = `openrouter-${dateStr}.log`
    const logFilePath = path.join(LOGS_DIR, logFileName)
    const logEntry = `[${timestamp}] ${message}\n`
    fs.appendFileSync(logFilePath, logEntry, 'utf8')
  } catch (error) {
    console.error('Failed to write to log file:', error.message)
  }
}

async function extractThreadTasks (options) {
  const {
    thread,
    apiKey,
    model,
    systemPrompt = null,
    examplesCriteria = null,
    promptTemplate = null,
    requiredGroundingRules = null,
    defaultSystemMessage = null
  } = options

  const threadId = (thread?.threadId || '').toString()
  const messages = Array.isArray(thread?.messages) ? thread.messages : []

  const safeThread = {
    threadId,
    messageCount: Number(thread?.messageCount) || messages.length,
    messages: messages.map(m => ({
      role: (m?.role || '').toString(),
      messageId: (m?.messageId || '').toString(),
      timestamp: (m?.timestamp || '').toString(),
      user: (m?.user || '').toString(),
      text: (m?.text || '').toString()
    }))
  }

  const schemaDescription = JSON.stringify(THREAD_TASK_ARRAY_SCHEMA, null, 2)
  const examplesCriteriaText = typeof examplesCriteria === 'string' &&
    examplesCriteria.trim().length > 0
    ? examplesCriteria
    : ''

  const templateToUse = typeof promptTemplate === 'string' &&
    promptTemplate.trim().length > 0
    ? promptTemplate
    : DEFAULT_PROMPT_TEMPLATE

  const prompt = templateToUse
    .replace(/\${schemaDescription}/g, schemaDescription)
    .replace(/\${examplesCriteria}/g, examplesCriteriaText)
    .replace(/\${threadJson}/g, JSON.stringify(safeThread, null, 2))

  const response = await callOpenRouterAPI({
    model,
    prompt,
    apiKey,
    temperature: 0,
    maxTokens: 3000,
    passName: 'Thread Extraction',
    format: THREAD_TASK_ARRAY_SCHEMA,
    systemPrompt,
    requiredGroundingRules,
    defaultSystemMessage
  })

  const tasks = parseTasksFromResponse(response)

  const sourceText = safeThread.messages.map(m => m.text).join('\n')

  const stats = {
    parsed: tasks.length,
    filteredPRReview: 0,
    repairedEvidence: 0,
    filteredBadEvidence: 0,
    filteredNotGrounded: 0
  }

  const normalizedTasks = tasks
    .filter(task => {
      const keep = !isPRReviewTask(task)
      if (!keep) stats.filteredPRReview++
      return keep
    })
    .map(task => ({
      task_title: task.task_title,
      task_description: task.task_description || '',
      evidence: {
        threadId,
        messageIds: Array.isArray(task?.evidence?.messageIds)
          ? task.evidence.messageIds.map(id => id.toString()).filter(Boolean)
          : []
      }
    }))
    .map(task => {
      if (validateEvidenceAgainstThread(task, safeThread)) return task

      const inferred = grounding.inferEvidenceMessageIds(task, safeThread, {
        maxIds: 3,
        minOverlapTokens: 1
      })
      if (inferred.length > 0) {
        stats.repairedEvidence++
        return {
          ...task,
          evidence: { ...task.evidence, messageIds: inferred }
        }
      }

      stats.filteredBadEvidence++
      return null
    })
    .filter(Boolean)
    .filter(task => {
      const keep = grounding.isTaskGroundedToText(task, sourceText, {
        minOverlapRatio: 0.06,
        minOverlapTokens: 2
      })
      if (!keep) stats.filteredNotGrounded++
      return keep
    })

  const maxPerThread = 3
  const scored = normalizedTasks
    .map(t => ({
      task: t,
      score: taskScoring.scoreTitleSpecificity(t.task_title) +
        taskScoring.scoreDescriptionQuality(t.task_description)
    }))
    .sort((a, b) => b.score - a.score)

  const finalTasks = scored.slice(0, maxPerThread).map(s => s.task)

  writeToLogFile(
    `Post-filter summary [Thread Extraction] threadId=${threadId}: ` +
    `parsed=${stats.parsed}, kept=${normalizedTasks.length}, returned=${finalTasks.length}, ` +
    `prReview=${stats.filteredPRReview}, repairedEvidence=${stats.repairedEvidence}, ` +
    `badEvidence=${stats.filteredBadEvidence}, notGrounded=${stats.filteredNotGrounded}`
  )

  return finalTasks
}

async function callOpenRouterAPI (options) {
  const {
    model,
    prompt,
    apiKey,
    temperature = 0,
    maxTokens = 3000,
    passName,
    format = null,
    systemPrompt = null,
    requiredGroundingRules = null,
    defaultSystemMessage = null
  } = options

  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions'

  const passLabel = passName ? ` [${passName}]` : ''
  const requestLog =
    `🤖 OpenRouter API Request${passLabel}:\n   Model: ${model}\n   ` +
    `Temperature: ${temperature}, Max tokens: ${maxTokens}`
  console.log(`\n${requestLog}`)
  writeToLogFile(requestLog)

  try {
    const groundingRulesToUse = typeof requiredGroundingRules === 'string' &&
      requiredGroundingRules.trim().length > 0
      ? requiredGroundingRules
      : 'NON-NEGOTIABLE RULES:\n' +
        '- Use ONLY the provided conversation/thread text.\n' +
        '- Do NOT use outside knowledge.\n' +
        '- Do NOT invent tasks or context.\n' +
        '- Only return tasks that are explicitly supported by the text.\n' +
        '- If there is no clear actionable work, return [] in the requested JSON format.\n'
    const defaultSystemMsg = typeof defaultSystemMessage === 'string' &&
      defaultSystemMessage.trim().length > 0
      ? defaultSystemMessage
      : format
        ? 'You are a task extraction assistant. Use ONLY the provided text. Do NOT invent tasks. Return tasks strictly in the specified JSON format.'
        : 'You are a task extraction assistant. Return tasks as a JSON array.'
    const userSystem = typeof systemPrompt === 'string' &&
      systemPrompt.trim().length > 0
      ? systemPrompt
      : defaultSystemMsg
    const systemMessage = `${groundingRulesToUse}\n${userSystem}`.trim()
    const userPrompt = prompt
    writeToLogFile(
      `   System prompt: ${systemMessage.replace(/\s+/g, ' ').substring(0, 120)}`
    )

    const requestBody = {
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    }

    if (format) {
      writeToLogFile(
        '   Requesting JSON array format (schema provided in prompt)'
      )
    }

    writeToLogFile(`   Using Chat API: ${apiUrl}`)
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/convoy',
        'X-Title': 'Convoy Task Extraction'
      },
      timeout: 0
    })

    writeToLogFile(`   API URL used: ${apiUrl}`)

    const content = response.data?.choices?.[0]?.message?.content || ''
    const responseLength = content.length
    const fullResponse = JSON.stringify(response.data, null, 2)
    const responseLog =
      `✅ OpenRouter API Response:\n   Status: ${response.status}\n   ` +
      `Response length: ${responseLength} characters\n   ` +
      `Full response:\n${fullResponse}`
    console.log(`\n${responseLog}`)
    writeToLogFile(responseLog)

    if (response.data.error) {
      const errorLog = `   ❌ Error in response: ${response.data.error}`
      console.error(errorLog)
      writeToLogFile(errorLog)
      throw new Error(`OpenRouter API error: ${response.data.error}`)
    }

    const rawResponse = content

    const tasks = parseTasksFromResponse(rawResponse)
    const taskTitles = tasks.length > 0
      ? '\n   Task titles: ' +
        tasks.map(t => t.task_title || 'Untitled').join(', ')
      : ''
    const tasksLog = `   Parsed tasks: ${tasks.length}${taskTitles}`
    console.log(tasksLog)
    writeToLogFile(tasksLog)
    console.log('')
    writeToLogFile('')

    return rawResponse
  } catch (error) {
    let errorLog = '❌ OpenRouter API Error:'
    if (error.response) {
      const errorData = JSON.stringify(error.response.data, null, 2)
      errorLog +=
        `\n   Status: ${error.response.status}\n   Response data:\n${errorData}`
      console.error(`\n${errorLog}`)
      writeToLogFile(errorLog)
      throw new Error(
        `OpenRouter API error: ${error.response.data?.error?.message || error.response.data?.error || error.message}`
      )
    }
    if (error.code === 'ECONNABORTED') {
      errorLog += '\n   Request timed out'
      console.error(`\n${errorLog}`)
      writeToLogFile(errorLog)
      throw new Error('OpenRouter API request timed out')
    }
    errorLog += `\n   Error message: ${error.message}`
    console.error(`\n${errorLog}`)
    writeToLogFile(errorLog)
    console.error('')
    writeToLogFile('')
    throw new Error(`OpenRouter API request failed: ${error.message}`)
  }
}

function extractTasksFromNarrative (text) {
  const tasks = []

  const numberedPattern =
    /(\d+)\.\s*\*\*([^*]+)\*\*[:-]?\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g
  let match
  while ((match = numberedPattern.exec(text)) !== null) {
    const title = match[2].trim()
    const description = match[3].trim()
    if (title && description && title.length > 3) {
      tasks.push({
        task_title: title,
        task_description: description
      })
    }
  }

  const bulletPattern = /\*\s*\*\*([^*]+)\*\*[:-]?\s*([^\n]+(?:\n(?!\*)[^\n]+)*)/g
  while ((match = bulletPattern.exec(text)) !== null) {
    const title = match[1].trim()
    const description = match[2].trim()
    if (
      title &&
      description &&
      title.length > 3 &&
      !tasks.some(t => t.task_title === title)
    ) {
      tasks.push({
        task_title: title,
        task_description: description
      })
    }
  }

  const actionPattern = /(?:^|\n)(?:-|\*)\s*([A-Z][^:]+?):\s*([^\n]+)/gm
  while ((match = actionPattern.exec(text)) !== null) {
    const title = match[1].trim()
    const description = match[2].trim()
    if (
      title &&
      description &&
      title.length > 3 &&
      !tasks.some(t => t.task_title === title) &&
      (title.toLowerCase().includes('api') ||
        title.toLowerCase().includes('filter') ||
        title.toLowerCase().includes('issue') ||
        title.toLowerCase().includes('fix') ||
        title.toLowerCase().includes('export') ||
        title.toLowerCase().includes('feature'))
    ) {
      tasks.push({
        task_title: title,
        task_description: description
      })
    }
  }

  return tasks
}

function parseTasksFromResponse (response) {
  if (!response || typeof response !== 'string') {
    console.error('Invalid response type:', typeof response)
    writeToLogFile(`❌ Parse Error: Invalid response type: ${typeof response}`)
    return []
  }

  writeToLogFile(`Raw response (first 500 chars): ${response.substring(0, 500)}`)

  try {
    const tasks = JSON.parse(response)
    if (Array.isArray(tasks)) {
      writeToLogFile(`✅ Successfully parsed ${tasks.length} tasks from direct JSON`)
      return tasks
    } else {
      console.error('Parsed JSON is not an array:', typeof tasks)
      writeToLogFile(`❌ Parse Error: Parsed JSON is not an array, got: ${typeof tasks}`)
      return []
    }
  } catch (error) {
    console.error('Direct JSON parse failed:', error.message)
    writeToLogFile(`❌ Direct JSON parse failed: ${error.message}`)

    const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
    if (codeBlockMatch) {
      try {
        const tasks = JSON.parse(codeBlockMatch[1])
        if (Array.isArray(tasks)) {
          writeToLogFile(`✅ Successfully parsed ${tasks.length} tasks from code block`)
          return tasks
        }
      } catch (e) {
        console.error('Failed to parse JSON from code block:', e.message)
        writeToLogFile(`❌ Code block parse failed: ${e.message}`)
      }
    }

    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      try {
        const tasks = JSON.parse(jsonMatch[0])
        if (Array.isArray(tasks)) {
          writeToLogFile(`✅ Successfully parsed ${tasks.length} tasks from extracted JSON`)
          return tasks
        }
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e.message)
        writeToLogFile(`❌ Extracted JSON parse failed: ${e.message}`)
        writeToLogFile(
          `Extracted JSON snippet: ${jsonMatch[0].substring(0, 200)}`
        )
      }
    }

    const jsonLikeMatch = response.match(/\{[\s\S]*?\}/)
    if (jsonLikeMatch) {
      console.error('Found JSON object but expected array')
      writeToLogFile(
        `⚠️ Found JSON object but expected array: ${jsonLikeMatch[0].substring(0, 200)}`
      )
    }

    writeToLogFile('⚠️ Attempting to extract tasks from narrative response')
    const extractedTasks = extractTasksFromNarrative(response)
    if (extractedTasks.length > 0) {
      writeToLogFile(`✅ Extracted ${extractedTasks.length} tasks from narrative response`)
      return extractedTasks
    }

    console.error('No valid JSON array found in response')
    console.error('Response snippet:', response.substring(0, 1000))
    writeToLogFile(`❌ No valid JSON array found. Full response (first 1000 chars):\n${response.substring(0, 1000)}`)
    return []
  }
}
