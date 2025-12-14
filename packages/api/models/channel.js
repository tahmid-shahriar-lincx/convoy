const database = require('../database')

module.exports = {
  saveChannel,
  saveChannelsBulk,
  getAllChannels,
  getChannelById,
  deleteChannelsByWorkspace
}

function saveChannel (channelData) {
  const db = database.initialize()
  const {
    channelId,
    name,
    displayName,
    type,
    isPrivate = false,
    isIm = false,
    isMpim = false,
    numMembers = 0,
    created,
    lastRead,
    workspaceId,
    latest = null
  } = channelData

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO channels (
      channel_id, name, display_name, type, is_private, is_im, is_mpim,
      num_members, created, last_read, workspace_id, latest, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  try {
    const latestJson = latest ? JSON.stringify(latest) : null
    stmt.run(
      channelId,
      name,
      displayName,
      type,
      isPrivate ? 1 : 0,
      isIm ? 1 : 0,
      isMpim ? 1 : 0,
      numMembers,
      created,
      lastRead,
      workspaceId,
      latestJson
    )
    return true
  } catch (error) {
    console.error('❌ Error saving channel:', error.message)
    throw error
  }
}

function saveChannelsBulk (channels, workspaceId) {
  const db = database.initialize()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO channels (
      channel_id, name, display_name, type, is_private, is_im, is_mpim,
      num_members, created, last_read, workspace_id, latest, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)

  const transaction = db.transaction((channelList) => {
    let savedCount = 0
    for (const channel of channelList) {
      try {
        const latestJson = channel.latest ? JSON.stringify(channel.latest) : null
        stmt.run(
          channel.id,
          channel.name,
          channel.display_name,
          channel.type,
          channel.is_private ? 1 : 0,
          channel.is_im ? 1 : 0,
          channel.is_mpim ? 1 : 0,
          channel.num_members || 0,
          channel.created,
          channel.last_read,
          workspaceId,
          latestJson
        )
        savedCount++
      } catch (error) {
        console.error('❌ Error saving channel:', error.message)
      }
    }
    return { savedCount }
  })

  return transaction(channels)
}

function getAllChannels (workspaceId = null) {
  const db = database.initialize()
  let query = 'SELECT * FROM channels'
  const params = []

  if (workspaceId) {
    query += ' WHERE workspace_id = ?'
    params.push(workspaceId)
  }

  query += ' ORDER BY type ASC, display_name ASC'
  const stmt = db.prepare(query)
  const channels = stmt.all(...params)

  return channels.map(channel => ({
    id: channel.channel_id,
    name: channel.name,
    display_name: channel.display_name,
    type: channel.type,
    is_private: channel.is_private === 1,
    is_im: channel.is_im === 1,
    is_mpim: channel.is_mpim === 1,
    num_members: channel.num_members,
    created: channel.created,
    last_read: channel.last_read,
    latest: channel.latest ? JSON.parse(channel.latest) : null
  }))
}

function getChannelById (channelId) {
  const db = database.initialize()
  const stmt = db.prepare('SELECT * FROM channels WHERE channel_id = ?')
  const channel = stmt.get(channelId)

  if (!channel) {
    return null
  }

  return {
    id: channel.channel_id,
    name: channel.name,
    display_name: channel.display_name,
    type: channel.type,
    is_private: channel.is_private === 1,
    is_im: channel.is_im === 1,
    is_mpim: channel.is_mpim === 1,
    num_members: channel.num_members,
    created: channel.created,
    last_read: channel.last_read,
    latest: channel.latest ? JSON.parse(channel.latest) : null
  }
}

function deleteChannelsByWorkspace (workspaceId) {
  const db = database.initialize()
  const stmt = db.prepare('DELETE FROM channels WHERE workspace_id = ?')

  try {
    const result = stmt.run(workspaceId)
    return result.changes
  } catch (error) {
    console.error('❌ Error deleting channels:', error.message)
    throw error
  }
}
