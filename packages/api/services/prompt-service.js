const models = require('../models')

module.exports = {
  initializePrompts,
  getPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  setDefaultPrompt,
  validatePrompt
}

async function initializePrompts () {
  try {
    models.initializeDefaultPrompts()
    console.log('Prompt service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize prompt service:', error)
    throw error
  }
}

async function getPrompts (filters = {}) {
  try {
    const { type, createdBy } = filters

    if (type === 'system') {
      return models.getSystemPrompts()
    } else if (type === 'user' && createdBy) {
      return models.getUserPrompts(createdBy)
    } else {
      return models.getAllPrompts()
    }
  } catch (error) {
    console.error('Failed to get prompts:', error)
    throw error
  }
}

async function getPrompt (id) {
  try {
    return models.getPromptById(parseInt(id))
  } catch (error) {
    console.error('Failed to get prompt:', error)
    throw error
  }
}

async function createPrompt (promptData) {
  try {
    const validation = validatePrompt(promptData)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }

    const id = models.createPrompt(promptData)
    return models.getPromptById(id)
  } catch (error) {
    console.error('Failed to create prompt:', error)
    throw error
  }
}

async function updatePrompt (id, updateData) {
  try {
    const validation = validatePrompt(updateData)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }

    const existingPrompt = models.getPromptById(parseInt(id))
    if (!existingPrompt) {
      throw new Error('Prompt not found')
    }
    if (existingPrompt.is_system) {
      throw new Error('Cannot update system prompts')
    }

    models.updatePrompt(parseInt(id), updateData)
    return models.getPromptById(parseInt(id))
  } catch (error) {
    console.error('Failed to update prompt:', error)
    throw error
  }
}

async function deletePrompt (id) {
  try {
    const existingPrompt = models.getPromptById(parseInt(id))
    if (!existingPrompt) {
      throw new Error('Prompt not found')
    }
    if (existingPrompt.is_system) {
      throw new Error('Cannot delete system prompts')
    }

    const result = models.deletePrompt(parseInt(id))
    return result.changes > 0
  } catch (error) {
    console.error('Failed to delete prompt:', error)
    throw error
  }
}

async function setDefaultPrompt (id) {
  try {
    const existingPrompt = models.getPromptById(parseInt(id))
    if (!existingPrompt) {
      throw new Error('Prompt not found')
    }
    if (existingPrompt.is_system) {
      throw new Error('Cannot set system prompts as default')
    }

    models.setDefaultPrompt(parseInt(id))
    return models.getPromptById(parseInt(id))
  } catch (error) {
    console.error('Failed to set default prompt:', error)
    throw error
  }
}

function validatePrompt (promptData) {
  const { name, promptTemplate } = promptData

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Prompt name is required and must be a non-empty string'
    }
  }

  if (!promptTemplate || typeof promptTemplate !== 'string' || promptTemplate.trim().length === 0) {
    return {
      isValid: false,
      error: 'Prompt template is required and must be a non-empty string'
    }
  }

  const conversationTextVar = '${' + 'conversationText' + '}'
  const schemaDescriptionVar = '${' + 'schemaDescription' + '}'

  if (!promptTemplate.includes(conversationTextVar)) {
    return {
      isValid: false,
      error: 'Prompt template must include the ' + conversationTextVar + ' variable'
    }
  }

  if (!promptTemplate.includes(schemaDescriptionVar)) {
    console.warn(
      'Warning: Prompt template should include ' +
      schemaDescriptionVar +
      ' variable for structured output'
    )
  }

  return {
    isValid: true,
    error: null
  }
}
