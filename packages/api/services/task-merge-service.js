module.exports = {
  mergeTaskCandidates
}

const taskScoring = require('./task-scoring')

function mergeTaskCandidates (options) {
  const { candidates, strategy = 'title-normalize' } = options || {}

  if (!Array.isArray(candidates)) {
    throw new Error('candidates must be an array')
  }

  if (strategy === 'threadId-one-task') {
    return mergeOneTaskPerThread(candidates)
  }

  const fuzzy = strategy === 'title-normalize+fuzzy'
  const merged = []
  const byKey = new Map()

  for (const candidate of candidates) {
    const title = (candidate?.task_title || '').toString().trim()
    const description = (candidate?.task_description || '').toString()
    if (!title) continue

    const key = normalizeTitle(title)
    let matchKey = key

    if (fuzzy && !byKey.has(key)) {
      matchKey = findFuzzyKey(byKey, key)
    }

    if (!byKey.has(matchKey)) {
      const task = {
        task_title: title,
        task_description: description,
        sources: []
      }
      addEvidence(task, candidate)
      byKey.set(matchKey, task)
      merged.push(task)
      continue
    }

    const task = byKey.get(matchKey)
    if ((description || '').length > (task.task_description || '').length) {
      task.task_description = description
    }
    addEvidence(task, candidate)
  }

  return merged.map(t => ({
    task_title: t.task_title,
    task_description: t.task_description || '',
    sources: dedupeSources(t.sources)
  }))
}

function mergeOneTaskPerThread (candidates) {
  const groups = new Map()

  for (const candidate of candidates) {
    const title = (candidate?.task_title || '').toString().trim()
    if (!title) continue

    const evidence = candidate?.evidence || null
    const threadId = (evidence?.threadId || '').toString().trim()
    if (!threadId) continue

    if (!groups.has(threadId)) groups.set(threadId, [])
    groups.get(threadId).push(candidate)
  }

  const merged = []
  for (const [, group] of groups.entries()) {
    const best = pickBestCandidate(group)
    if (!best) continue

    const task = {
      task_title: (best?.task_title || '').toString().trim(),
      task_description: (best?.task_description || '').toString(),
      sources: []
    }

    for (const candidate of group) addEvidence(task, candidate)
    merged.push({
      task_title: task.task_title,
      task_description: task.task_description || '',
      sources: dedupeSources(task.sources)
    })
  }

  return dedupeExactTasks(merged)
}

function dedupeExactTasks (tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return []

  const byKey = new Map()
  const order = []

  for (const t of tasks) {
    const title = (t?.task_title || '').toString().trim()
    const desc = (t?.task_description || '').toString()
    if (!title) continue

    const key = `${normalizeTitle(title)}\n${normalizeDescription(desc)}`

    if (!byKey.has(key)) {
      const task = {
        task_title: title,
        task_description: desc,
        sources: Array.isArray(t?.sources) ? t.sources : []
      }
      byKey.set(key, task)
      order.push(key)
      continue
    }

    const existing = byKey.get(key)
    if ((desc || '').length > (existing.task_description || '').length) {
      existing.task_description = desc
    }
    const sources = Array.isArray(t?.sources) ? t.sources : []
    existing.sources = dedupeSources([...(existing.sources || []), ...sources])
  }

  return order.map(key => {
    const t = byKey.get(key)
    return {
      task_title: t.task_title,
      task_description: t.task_description || '',
      sources: dedupeSources(t.sources)
    }
  })
}

function normalizeDescription (text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function pickBestCandidate (candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  let best = null
  let bestScore = -Infinity
  for (const c of candidates) {
    const title = (c?.task_title || '').toString()
    const desc = (c?.task_description || '').toString()
    const score =
      taskScoring.scoreTitleSpecificity(title) +
      taskScoring.scoreDescriptionQuality(desc)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return best
}

function addEvidence (task, candidate) {
  const evidence = candidate?.evidence || null
  if (!evidence) return

  const threadId = (evidence.threadId || '').toString()
  const messageIds = Array.isArray(evidence.messageIds)
    ? evidence.messageIds.map(id => id.toString()).filter(Boolean)
    : []

  if (!threadId && messageIds.length === 0) return

  task.sources.push({
    threadId,
    messageIds
  })
}

function dedupeSources (sources) {
  if (!Array.isArray(sources) || sources.length === 0) return []

  const byThread = new Map()
  for (const src of sources) {
    const threadId = (src?.threadId || '').toString()
    const messageIds = Array.isArray(src?.messageIds)
      ? src.messageIds.map(id => id.toString()).filter(Boolean)
      : []

    const existing = byThread.get(threadId) || new Set()
    for (const id of messageIds) existing.add(id)
    byThread.set(threadId, existing)
  }

  return Array.from(byThread.entries()).map(([threadId, ids]) => ({
    threadId,
    messageIds: Array.from(ids.values())
  }))
}

function normalizeTitle (title) {
  return taskScoring.normalizeTitle(title)
}

function findFuzzyKey (byKey, key) {
  let bestKey = key
  let bestScore = 0
  for (const existingKey of byKey.keys()) {
    const score = tokenJaccard(existingKey, key)
    if (score > bestScore) {
      bestScore = score
      bestKey = existingKey
    }
  }
  return bestScore >= 0.8 ? bestKey : key
}

function tokenJaccard (a, b) {
  const aTokens = new Set((a || '').split(' ').filter(Boolean))
  const bTokens = new Set((b || '').split(' ').filter(Boolean))
  if (aTokens.size === 0 || bTokens.size === 0) return 0

  let intersection = 0
  for (const t of aTokens) {
    if (bTokens.has(t)) intersection++
  }
  const union = aTokens.size + bTokens.size - intersection
  return union === 0 ? 0 : intersection / union
}
