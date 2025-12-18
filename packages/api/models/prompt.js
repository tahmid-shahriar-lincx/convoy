const database = require('../database')

module.exports = {
  createPrompt,
  getPromptById,
  getAllPrompts,
  getDefaultPrompt,
  updatePrompt,
  deletePrompt,
  getSystemPrompts,
  getUserPrompts,
  setDefaultPrompt,
  initializeDefaultPrompts
}

function createPrompt (promptData) {
  const db = database.initialize()
  const { name, description, promptTemplate, isDefault = false, isSystem = false, createdBy } = promptData

  const stmt = db.prepare(`
    INSERT INTO prompts (name, description, prompt_template, is_default, is_system, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(name, description, promptTemplate, isDefault ? 1 : 0, isSystem ? 1 : 0, createdBy)

  if (isDefault) {
    const unsetDefault = db.prepare(`
      UPDATE prompts SET is_default = 0
      WHERE id != ? AND is_system = 0
    `)
    unsetDefault.run(result.lastInsertRowid)
  }

  return result.lastInsertRowid
}

function getPromptById (id) {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM prompts WHERE id = ?')
  return stmt.get(id)
}

function getAllPrompts () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM prompts ORDER BY is_default DESC, created_at DESC')
  return stmt.all()
}

function getDefaultPrompt () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM prompts WHERE is_default = TRUE LIMIT 1')
  return stmt.get()
}

function getSystemPrompts () {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM prompts WHERE is_system = TRUE ORDER BY name')
  return stmt.all()
}

function getUserPrompts (createdBy = null) {
  const db = database.initialize()
  let stmt
  if (createdBy) {
    stmt = db.prepare('SELECT * FROM prompts WHERE is_system = FALSE AND created_by = ? ORDER BY created_at DESC')
    return stmt.all(createdBy)
  } else {
    stmt = db.prepare('SELECT * FROM prompts WHERE is_system = FALSE ORDER BY created_at DESC')
    return stmt.all()
  }
}

function updatePrompt (id, updateData) {
  const db = database.initialize()
  const { name, description, promptTemplate, isDefault } = updateData

  if (isDefault) {
    const unsetDefault = db.prepare(`
      UPDATE prompts SET is_default = 0
      WHERE id != ? AND is_system = 0
    `)
    unsetDefault.run(id)
  }

  const stmt = db.prepare(`
    UPDATE prompts
    SET name = ?, description = ?, prompt_template = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  return stmt.run(name, description, promptTemplate, isDefault ? 1 : 0, id)
}

function deletePrompt (id) {
  const db = database.initialize()
  const stmt = db.prepare('DELETE FROM prompts WHERE id = ? AND is_system = 0')
  return stmt.run(id)
}

function setDefaultPrompt (id) {
  const db = database.initialize()

  const unsetDefault = db.prepare('UPDATE prompts SET is_default = 0 WHERE is_system = 0')
  unsetDefault.run()

  const setDefault = db.prepare('UPDATE prompts SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  return setDefault.run(id)
}

function initializeDefaultPrompts (promptTemplate = null) {
  const db = database.initialize()

  const existingDefault = getDefaultPrompt()
  if (existingDefault) {
    console.log('Default prompt already exists')
    return
  }

  const defaultPromptTemplate = promptTemplate || `Extract ALL actionable tasks from this conversation. Return a JSON array matching this schema:

\${schemaDescription}

Conversation:
\${conversationText}`

  const stmt = db.prepare(`
    INSERT INTO prompts (name, description, prompt_template, is_default, is_system)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmt.run(
    'Default Task Extraction',
    'Default prompt for extracting actionable tasks from Slack conversations',
    defaultPromptTemplate,
    1, // is_default (boolean as integer)
    1 // is_system (boolean as integer)
  )

  console.log('Default prompt initialized')
}
