module.exports = {
  normalizeWorkspaceUrl,
  formatDatabaseSize
}

function normalizeWorkspaceUrl (workspaceUrl) {
  if (!workspaceUrl) return null

  const hasTrailingSlash = workspaceUrl.endsWith('/')
  const normalizedUrl = hasTrailingSlash
    ? workspaceUrl.slice(0, -1)
    : workspaceUrl
  return normalizedUrl.includes('://')
    ? normalizedUrl
    : `https://${normalizedUrl}`
}

function formatDatabaseSize (sizeInBytes) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} bytes`
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`
  }
  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
}
