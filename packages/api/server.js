const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const database = require('./database')
const routes = require('./routes')
const promptService = require('./services/prompt-service')

const PORT = 3000

database.initialize()
promptService.initializePrompts().catch(error => {
  console.error('Failed to initialize prompts:', error)
})

const app = express()

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
}))

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(morgan('combined'))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

module.exports = {
  startServer
}

function setupGracefulShutdown () {
  const shutdown = () => {
    console.log('\n🛑 Received shutdown signal, closing database...')
    database.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function startServer () {
  app.get('/api/tokens', routes.getTokens)
  app.get('/api/stats', routes.getStats)
  app.post('/save-token', routes.saveToken)
  app.post('/api/extract-token', routes.extractApiToken)
  app.post('/api/renew-token', routes.renewToken)
  app.get('/reset', routes.resetToken)
  app.get('/api/channels', routes.getChannels)
  app.post('/api/channels/refresh', routes.refreshChannels)
  app.post('/api/sync-conversations', routes.syncConversations)
  app.get('/api/conversations', routes.getConversations)
  app.get('/api/users', routes.getUsers)

  app.post('/api/tasks/generate', routes.generateTasks)
  app.post('/api/tasks/pipeline/prepare', routes.prepareTaskPipeline)
  app.post('/api/tasks/pipeline/extract-thread', routes.extractThreadTasks)
  app.post('/api/tasks/pipeline/merge', routes.mergeTaskCandidates)
  app.get('/api/ollama/models', routes.getOllamaModels)

  app.get('/api/tasks', routes.getTasks)
  app.post('/api/tasks', routes.saveTask)
  app.put('/api/tasks/:taskId', routes.updateTask)
  app.delete('/api/tasks/:taskId', routes.deleteTask)
  app.put('/api/tasks/:taskId/kanban', routes.updateTaskKanban)

  app.get('/api/prompts', routes.getPrompts)
  app.get('/api/prompts/:id', routes.getPrompt)
  app.post('/api/prompts', routes.createPrompt)
  app.put('/api/prompts/:id', routes.updatePrompt)
  app.delete('/api/prompts/:id', routes.deletePrompt)
  app.put('/api/prompts/:id/default', routes.setDefaultPrompt)

  setupGracefulShutdown()

  app.listen(PORT, () => {
    console.log(`🚚 Convoy server running at http://localhost:${PORT}`)
    console.log('📊 Database: convoy.db')
    console.log('📈 API endpoints:')
    console.log('   GET  /api/stats - Database statistics')
    console.log('   GET  /api/tokens - Token list (no sensitive data)')
    console.log('   POST /save-token - Save API token')
    console.log('   POST /api/extract-token - Extract API token from d cookie')
    console.log('   POST /api/renew-token - Renew existing API token')
    console.log('   GET  /reset - Remove token and return to login')
    console.log('   GET  /api/channels - Fetch Slack channels')
    console.log('   POST /api/channels/refresh - Refresh channels from Slack API')
    console.log('   POST /api/sync-conversations - Sync conversations with date filtering')
    console.log('   GET  /api/conversations - Get synced conversations')
    console.log('   GET  /api/users - Get users')
    console.log('   POST /api/tasks/generate - Generate task list (not saved)')
    console.log('   POST /api/tasks/pipeline/prepare - Prepare threaded payload')
    console.log('   POST /api/tasks/pipeline/extract-thread - Extract tasks per thread')
    console.log('   POST /api/tasks/pipeline/merge - Merge/dedupe candidates')
    console.log('   GET  /api/tasks - List saved tasks')
    console.log('   POST /api/tasks - Save a task')
    console.log('   DELETE /api/tasks/:id - Delete a saved task')
    console.log('   GET  /api/ollama/models - Get available Ollama models')
  })
}

if (require.main === module) {
  startServer()
}
