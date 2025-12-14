const database = require('../database')

module.exports = {
  saveUser,
  saveUsersBulk,
  getUserById,
  getAllUsers,
  getUserMap
}

function saveUser (userData) {
  const db = database.initialize()
  const {
    userId,
    username,
    realName,
    displayName,
    workspaceId
  } = userData

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (
      user_id, username, real_name, display_name,
      workspace_id, updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  try {
    stmt.run(userId, username, realName, displayName, workspaceId)
    return true
  } catch (error) {
    console.error('❌ Error saving user:', error.message)
    throw error
  }
}

function saveUsersBulk (users, workspaceId) {
  const db = database.initialize()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (
      user_id, username, real_name, display_name,
      workspace_id, updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  const transaction = db.transaction((userList) => {
    let savedCount = 0
    for (const user of userList) {
      try {
        stmt.run(
          user.user_id,
          user.username,
          user.real_name,
          user.display_name,
          workspaceId
        )
        savedCount++
      } catch (error) {
        console.error('❌ Error saving user:', error.message)
      }
    }
    return { savedCount }
  })

  return transaction(users)
}

function getUserById (userId) {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?')
  return stmt.get(userId)
}

function getAllUsers (workspaceId = null) {
  const db = database.initialize()
  let query = 'SELECT * FROM users'
  const params = []

  if (workspaceId) {
    query += ' WHERE workspace_id = ?'
    params.push(workspaceId)
  }

  query += ' ORDER BY username ASC'
  const stmt = db.prepare(query)
  return stmt.all(...params)
}

function getUserMap (workspaceId = null) {
  const users = getAllUsers(workspaceId)
  const userMap = new Map()

  users.forEach(user => {
    const displayName = user.display_name ||
      user.real_name ||
      user.username ||
      user.user_id
    userMap.set(user.user_id, displayName)
  })

  return userMap
}
