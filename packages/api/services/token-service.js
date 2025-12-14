const axios = require('axios')

const slackApi = require('../external/slack-api')
const model = require('../models')

module.exports = {
  extractAndSaveToken,
  saveTokenWithValidation,
  renewTokenFromWorkspace
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/91.0.4472.124 Safari/537.36'

function extractTokenFromHtml (html, errorContext) {
  const apiTokenMatch = html.match(/"api_token":"(xox[pabc][\w-]+)"/)
  if (!apiTokenMatch) {
    throw new Error(
      `API token not found in response. ${errorContext}`
    )
  }
  return apiTokenMatch[1]
}

async function fetchWorkspaceHtml (workspaceUrl, dCookie) {
  const targetUrl = model.normalizeWorkspaceUrl(workspaceUrl)
  const response = await axios.get(targetUrl, {
    headers: {
      Cookie: `d=${dCookie}`,
      'User-Agent': USER_AGENT
    }
  })
  return { html: response.data, targetUrl }
}

async function validateAndSaveToken (
  apiToken,
  dCookie,
  testResponse,
  targetUrl,
  request
) {
  if (!testResponse.data.ok) {
    throw new Error(
      `Token validation failed: ${testResponse.data.error}`
    )
  }

  const finalWorkspaceUrl = testResponse.data.url || targetUrl
  const tokenData = model.createTokenData({
    token: apiToken,
    dCookie,
    authTestResponse: testResponse,
    request
  })

  tokenData.workspaceUrl = finalWorkspaceUrl
  const tokenId = model.saveToken(tokenData)

  return { tokenId, finalWorkspaceUrl }
}

async function extractAndSaveToken (options) {
  const {
    workspaceUrl,
    dCookie,
    request,
    logPrefix = '🚚 Extracting',
    errorContext = 'Make sure you are logged in to Slack.'
  } = options

  const targetUrl = model.normalizeWorkspaceUrl(workspaceUrl)
  console.log(`${logPrefix} API token from workspace: ${targetUrl}`)

  const { html, targetUrl: normalizedUrl } =
    await fetchWorkspaceHtml(workspaceUrl, dCookie)

  const apiToken = extractTokenFromHtml(html, errorContext)
  console.log('✅ Successfully extracted API token')
  console.log('🚚 API token:', apiToken)

  const testResponse = await slackApi.validateToken(apiToken, dCookie)

  const { tokenId, finalWorkspaceUrl } = await validateAndSaveToken(
    apiToken,
    dCookie,
    testResponse,
    normalizedUrl,
    request
  )

  console.log(`📦 Workspace: ${testResponse.data.team?.name || 'Unknown'}`)
  console.log(`🚚 API token deployed to convoy with ID: ${tokenId}`)

  return {
    token: apiToken,
    tokenId,
    testResponse,
    finalWorkspaceUrl
  }
}

function getDCookieFromExisting (token) {
  const existingTokens = model.getAllTokens()
  const existingToken = existingTokens.find(
    t => t.tokenValue === token
  )
  return existingToken?.dCookie || null
}

function resolveDCookie (token, dCookie) {
  if (dCookie) return dCookie

  const existingDCookie = getDCookieFromExisting(token)
  if (existingDCookie) {
    console.log('📦 Using existing dCookie from database')
    return existingDCookie
  }

  return null
}

async function saveTokenWithValidation (options) {
  const { token, dCookie, request } = options

  const validation = model.validateToken(token)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const finalDCookie = resolveDCookie(token, dCookie)
  const testResponse = await slackApi.validateToken(token, finalDCookie)

  if (!testResponse.data.ok) {
    return {
      success: false,
      error: `Invalid token: ${testResponse.data.error}`
    }
  }

  const tokenData = model.createTokenData({
    token,
    dCookie: finalDCookie,
    authTestResponse: testResponse,
    request
  })

  const tokenId = model.saveToken(tokenData)
  console.log(`🚚 Token deployed to convoy with ID: ${tokenId}`)
  console.log(`📦 Workspace: ${tokenData.workspaceName}`)

  return { success: true, tokenId }
}

async function renewTokenFromWorkspace (options) {
  const { currentToken, request } = options

  if (!currentToken.workspaceUrl || !currentToken.dCookie) {
    return {
      success: false,
      error:
        'Cannot renew token: workspace URL or d cookie is missing. ' +
        'Please add a new token manually.'
    }
  }

  const result = await extractAndSaveToken({
    workspaceUrl: currentToken.workspaceUrl,
    dCookie: currentToken.dCookie,
    request,
    logPrefix: '🔄 Renewing',
    errorContext:
      'The d cookie may have expired. Please add a new token manually.'
  })

  console.log(
    `🔄 API token renewed and deployed to convoy with ID: ${result.tokenId}`
  )

  return {
    success: true,
    token: result.token,
    user: result.testResponse.data.user,
    team: result.testResponse.data.team,
    url: result.testResponse.data.url,
    tokenId: result.tokenId
  }
}
