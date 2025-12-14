const fs = require('fs')
const path = require('path')

const model = require('../models')

module.exports = {
  getDatabaseStats
}

const DB_PATH = path.join(__dirname, '..', 'convoy.db')

function getDatabaseSize () {
  try {
    const stats = fs.statSync(DB_PATH)
    return model.formatDatabaseSize(stats.size)
  } catch (error) {
    return 'Unknown'
  }
}

function getDatabaseStats () {
  return {
    totalTokens: model.getTokenCount(),
    totalConversations: model.getConversationCount(),
    totalMessages: model.getMessageCount(),
    totalTasks: model.getTaskCount(),
    lastSync: model.getLastSyncDate(),
    lastTaskSaved: model.getLastTaskSavedDate(),
    databaseSize: getDatabaseSize()
  }
}
