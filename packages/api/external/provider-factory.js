const ollama = require('./ollama')
const openrouter = require('./openrouter')

module.exports = {
  getProvider
}

function getProvider (providerType) {
  if (providerType === 'ollama') {
    return ollama
  }
  if (providerType === 'openrouter') {
    return openrouter
  }
  throw new Error(`Unknown provider type: ${providerType}`)
}
