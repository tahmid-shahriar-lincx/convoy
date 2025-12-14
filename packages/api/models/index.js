const tokenModel = require('./token')
const conversationModel = require('./conversation')
const userModel = require('./user')
const channelModel = require('./channel')
const taskModel = require('./task')
const promptModel = require('./prompt')
const utils = require('./utils')

module.exports = {
  validateToken: tokenModel.validateToken,
  determineTokenType: tokenModel.determineTokenType,
  createTokenData: tokenModel.createTokenData,
  saveToken: tokenModel.saveToken,
  getAllTokens: tokenModel.getAllTokens,
  getTokenById: tokenModel.getTokenById,
  getTokenCount: tokenModel.getTokenCount,
  deleteAllTokens: tokenModel.deleteAllTokens,

  createConversationData: conversationModel.createConversationData,
  getConversations: conversationModel.getConversations,
  getConversationsByThread: conversationModel.getConversationsByThread,
  getThreadReplies: conversationModel.getThreadReplies,
  saveConversationsBulk: conversationModel.saveConversationsBulk,
  saveConversation: conversationModel.saveConversation,
  getConversationCount: conversationModel.getConversationCount,
  getMessageCount: conversationModel.getMessageCount,
  getLastSyncDate: conversationModel.getLastSyncDate,

  saveUser: userModel.saveUser,
  saveUsersBulk: userModel.saveUsersBulk,
  getUserById: userModel.getUserById,
  getAllUsers: userModel.getAllUsers,
  getUserMap: userModel.getUserMap,

  saveChannel: channelModel.saveChannel,
  saveChannelsBulk: channelModel.saveChannelsBulk,
  getAllChannels: channelModel.getAllChannels,
  getChannelById: channelModel.getChannelById,
  deleteChannelsByWorkspace: channelModel.deleteChannelsByWorkspace,

  getTaskCount: taskModel.getTaskCount,
  getLastTaskSavedDate: taskModel.getLastTaskSavedDate,

  createPrompt: promptModel.createPrompt,
  getPromptById: promptModel.getPromptById,
  getAllPrompts: promptModel.getAllPrompts,
  getDefaultPrompt: promptModel.getDefaultPrompt,
  getSystemPrompts: promptModel.getSystemPrompts,
  getUserPrompts: promptModel.getUserPrompts,
  updatePrompt: promptModel.updatePrompt,
  deletePrompt: promptModel.deletePrompt,
  setDefaultPrompt: promptModel.setDefaultPrompt,
  initializeDefaultPrompts: promptModel.initializeDefaultPrompts,

  normalizeWorkspaceUrl: utils.normalizeWorkspaceUrl,
  formatDatabaseSize: utils.formatDatabaseSize
}
