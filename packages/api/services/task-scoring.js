module.exports = {
  normalizeTitle,
  scoreTitleSpecificity,
  scoreDescriptionQuality
}

function normalizeTitle (title) {
  return (title || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreTitleSpecificity (title) {
  const tokens = normalizeTitle(title).split(' ').filter(Boolean)
  const generic = new Set([
    'fix', 'bug', 'issue', 'update', 'validation', 'logic', 'check', 'broken',
    'problem', 'thing'
  ])
  const nonGeneric = tokens.filter(t => !generic.has(t))
  let score = 0
  score += Math.min(tokens.length, 12)
  score += nonGeneric.length * 2
  if (nonGeneric.length === 0) score -= 100
  return score
}

function scoreDescriptionQuality (desc) {
  const text = (desc || '').toString()
  const lower = text.toLowerCase()
  const trimmed = text.trim()
  let score = trimmed.length

  const sentenceCount = countSentences(trimmed)
  if (sentenceCount >= 2) score += 40
  if (sentenceCount >= 3) score += 20
  if (sentenceCount > 6) score -= 50

  if (/\b(so that|so we|in order to|as a result|next step|we should)\b/i.test(text)) {
    score += 25
  }

  if (/\n-\s/.test(text)) score -= 30
  if (/acceptance criteria/i.test(text)) score -= 80
  if (/evidence:\s*\[/.test(text)) score -= 80
  if (/needs to be (fixed|checked|updated)/i.test(lower)) score -= 200

  return score
}

function countSentences (text) {
  const t = (text || '').toString().trim()
  if (!t) return 0
  const matches = t.match(/[.!?](\s|$)/g)
  return matches ? matches.length : 1
}
