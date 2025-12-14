const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'convoy.db')
const CREATE_TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tokenValue TEXT NOT NULL,
    tokenType TEXT DEFAULT 'unknown',
    workspaceName TEXT DEFAULT 'unknown',
    workspaceUrl TEXT,
    dCookie TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_CONVERSATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    channel_name TEXT,
    user_id TEXT,
    username TEXT,
    message_text TEXT,
    timestamp DATETIME,
    message_type TEXT DEFAULT 'message',
    thread_id TEXT,
    message_id TEXT UNIQUE,
    workspace_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    real_name TEXT,
    display_name TEXT,
    workspace_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_CHANNELS_TABLE = `
  CREATE TABLE IF NOT EXISTS channels (
    channel_id TEXT PRIMARY KEY,
    name TEXT,
    display_name TEXT,
    type TEXT,
    is_private INTEGER DEFAULT 0,
    is_im INTEGER DEFAULT 0,
    is_mpim INTEGER DEFAULT 0,
    num_members INTEGER DEFAULT 0,
    created TEXT,
    last_read TEXT,
    workspace_id TEXT,
    latest TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_SAVED_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS saved_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    channel_name TEXT,
    model TEXT,
    task_title TEXT NOT NULL,
    task_description TEXT,
    parent_thread_id TEXT,
    parent_thread_slack_link TEXT,
    kanban_column TEXT,
    kanban_position INTEGER,
    workspace_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`

const CREATE_PROMPTS_TABLE = `
  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
  )
`

const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_tokens_timestamp ON tokens(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(tokenType)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_message_id ON conversations(message_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_thread_timestamp ON conversations(thread_id, timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_channel_thread_date ON conversations(channel_id, thread_id, date(timestamp))',
  'CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id)',
  'CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels(workspace_id)',
  'CREATE INDEX IF NOT EXISTS idx_saved_tasks_channel ON saved_tasks(channel_id)',
  'CREATE INDEX IF NOT EXISTS idx_saved_tasks_workspace ON saved_tasks(workspace_id)',
  'CREATE INDEX IF NOT EXISTS idx_saved_tasks_created ON saved_tasks(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_saved_tasks_kanban ON saved_tasks(kanban_column, kanban_position)',
  'CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name)',
  'CREATE INDEX IF NOT EXISTS idx_prompts_default ON prompts(is_default)',
  'CREATE INDEX IF NOT EXISTS idx_prompts_system ON prompts(is_system)',
  'CREATE INDEX IF NOT EXISTS idx_prompts_created_by ON prompts(created_by)'
]

let db = null

module.exports = {
  initialize,
  close
}

function initialize () {
  if (db) return db

  try {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = DELETE')
    createTables()
    console.log('🚚 Convoy Database initialized successfully')
    return db
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message)
    process.exit(1)
  }
}

function createTables () {
  const database = db || initialize()
  try {
    database.exec(CREATE_TOKENS_TABLE)
    database.exec(CREATE_CONVERSATIONS_TABLE)
    database.exec(CREATE_USERS_TABLE)
    database.exec(CREATE_CHANNELS_TABLE)
    database.exec(CREATE_SAVED_TASKS_TABLE)
    database.exec(CREATE_PROMPTS_TABLE)

    migrateSchema(database)

    CREATE_INDEXES.forEach(indexSql => database.exec(indexSql))

    console.log('📦 Database tables and indexes created')
  } catch (error) {
    console.error('❌ Error creating tables:', error.message)
    throw error
  }
}

function migrateSchema (database) {
  migrateSavedTasks(database)
}

function migrateSavedTasks (database) {
  try {
    const cols = database
      .prepare("PRAGMA table_info('saved_tasks')")
      .all()
      .map(c => c.name)
    const colSet = new Set(cols)

    if (!colSet.has('parent_thread_id')) {
      database.exec('ALTER TABLE saved_tasks ADD COLUMN parent_thread_id TEXT')
    }

    if (!colSet.has('parent_thread_slack_link')) {
      database.exec(
        'ALTER TABLE saved_tasks ADD COLUMN parent_thread_slack_link TEXT'
      )
    }

    if (!colSet.has('kanban_column')) {
      database.exec('ALTER TABLE saved_tasks ADD COLUMN kanban_column TEXT')
    }

    if (!colSet.has('kanban_position')) {
      database.exec('ALTER TABLE saved_tasks ADD COLUMN kanban_position INTEGER')
    }

    database.exec(
      "UPDATE saved_tasks SET kanban_column = 'todo' WHERE kanban_column IS NULL OR trim(kanban_column) = ''"
    )

    try {
      database.exec(`
        WITH ordered AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY workspace_id, kanban_column
              ORDER BY datetime(created_at) ASC, id ASC
            ) - 1 AS pos
          FROM saved_tasks
        )
        UPDATE saved_tasks
        SET kanban_position = (
          SELECT pos FROM ordered WHERE ordered.id = saved_tasks.id
        )
        WHERE kanban_position IS NULL
      `)
    } catch (error) {
      const rows = database.prepare(`
        SELECT id, workspace_id, kanban_column
        FROM saved_tasks
        WHERE kanban_position IS NULL
        ORDER BY workspace_id ASC, kanban_column ASC, datetime(created_at) ASC, id ASC
      `).all()

      const update = database.prepare(
        'UPDATE saved_tasks SET kanban_position = ? WHERE id = ?'
      )
      const nextPos = new Map()

      database.exec('BEGIN')
      try {
        for (const row of rows) {
          const key = `${row.workspace_id || ''}::${row.kanban_column || 'todo'}`
          const current = nextPos.get(key) || 0
          update.run(current, row.id)
          nextPos.set(key, current + 1)
        }
        database.exec('COMMIT')
      } catch (e) {
        database.exec('ROLLBACK')
        throw e
      }
    }

    if (colSet.has('date_range_start') || colSet.has('date_range_end')) {
      database.exec('BEGIN')
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS saved_tasks_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            channel_name TEXT,
            model TEXT,
            task_title TEXT NOT NULL,
            task_description TEXT,
            parent_thread_id TEXT,
            parent_thread_slack_link TEXT,
            kanban_column TEXT,
            kanban_position INTEGER,
            workspace_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)

        database.exec(`
          INSERT INTO saved_tasks_new (
            id,
            channel_id,
            channel_name,
            model,
            task_title,
            task_description,
            parent_thread_id,
            parent_thread_slack_link,
            kanban_column,
            kanban_position,
            workspace_id,
            created_at
          )
          SELECT
            id,
            channel_id,
            channel_name,
            model,
            task_title,
            task_description,
            parent_thread_id,
            parent_thread_slack_link,
            kanban_column,
            kanban_position,
            workspace_id,
            created_at
          FROM saved_tasks
        `)

        database.exec('DROP TABLE saved_tasks')
        database.exec('ALTER TABLE saved_tasks_new RENAME TO saved_tasks')
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    }
  } catch (error) {
    console.error('❌ Error migrating saved_tasks schema:', error.message)
    throw error
  }
}

function close () {
  if (db) {
    db.close()
    db = null
    console.log('🔒 Database connection closed')
  }
}
