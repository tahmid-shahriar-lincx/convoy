module.exports = {
  tokenizeForOverlap,
  overlapRatio,
  overlapCount,
  isTaskGroundedToText,
  inferEvidenceMessageIds
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'done', 'for', 'from', 'had', 'has', 'have', 'he',
  'her', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'just', 'let', 'like', 'me', 'my', 'no', 'not', 'of', 'on', 'or',
  'our', 'ours', 'out', 'please', 'should', 'so', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to', 'too',
  'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'who', 'why',
  'will', 'with', 'you', 'your', 'yours'
])

function tokenizeForOverlap (text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

function overlapRatio (aTokens, bTokens) {
  if (!Array.isArray(aTokens) || !Array.isArray(bTokens)) return 0
  if (aTokens.length === 0 || bTokens.length === 0) return 0
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  let intersection = 0
  for (const t of a) {
    if (b.has(t)) intersection++
  }
  return intersection / a.size
}

function overlapCount (aTokens, bTokens) {
  if (!Array.isArray(aTokens) || !Array.isArray(bTokens)) return 0
  if (aTokens.length === 0 || bTokens.length === 0) return 0
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  let intersection = 0
  for (const t of a) {
    if (b.has(t)) intersection++
  }
  return intersection
}

function isTaskGroundedToText (task, sourceText, options) {
  const opts = options || {}
  const minOverlapRatio = Number.isFinite(opts.minOverlapRatio)
    ? opts.minOverlapRatio
    : 0.06
  const minOverlapTokens = Number.isFinite(opts.minOverlapTokens)
    ? opts.minOverlapTokens
    : 2

  const title = (task?.task_title || '').toString()
  const desc = (task?.task_description || '').toString()
  const taskTokens = tokenizeForOverlap(`${title} ${desc}`)
  const sourceTokens = tokenizeForOverlap(sourceText)
  if (taskTokens.length === 0 || sourceTokens.length === 0) return false

  const count = overlapCount(taskTokens, sourceTokens)
  const ratio = overlapRatio(taskTokens, sourceTokens)
  return count >= minOverlapTokens || ratio >= minOverlapRatio
}

function inferEvidenceMessageIds (task, thread, options) {
  const opts = options || {}
  const maxIds = Number.isFinite(opts.maxIds) ? opts.maxIds : 3
  const minOverlapTokens = Number.isFinite(opts.minOverlapTokens)
    ? opts.minOverlapTokens
    : 1

  const title = (task?.task_title || '').toString()
  const desc = (task?.task_description || '').toString()
  const taskTokens = tokenizeForOverlap(`${title} ${desc}`)
  if (taskTokens.length === 0) return []

  const messages = Array.isArray(thread?.messages) ? thread.messages : []
  const scored = []

  for (const m of messages) {
    const messageId = (m?.messageId || '').toString()
    if (!messageId) continue

    const text = (m?.text || '').toString()
    const msgTokens = tokenizeForOverlap(text)
    const count = overlapCount(taskTokens, msgTokens)
    if (count >= minOverlapTokens) {
      scored.push({ messageId, count })
    }
  }

  scored.sort((a, b) => b.count - a.count)
  const unique = []
  const seen = new Set()
  for (const s of scored) {
    if (seen.has(s.messageId)) continue
    unique.push(s.messageId)
    seen.add(s.messageId)
    if (unique.length >= maxIds) break
  }

  return unique
}
