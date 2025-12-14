import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tokenApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  TextField,
  Button,
  Box,
  Alert,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  LinearProgress
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'

const TokenPage = () => {
  const [dCookie, setDCookie] = useState('')
  const [workspaceUrl, setWorkspaceUrl] = useState('')
  const queryClient = useQueryClient()

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: tokenApi.getTokens
  })

  const extractTokenMutation = useMutation({
    mutationFn: tokenApi.extractToken,
    onSuccess: (data) => {
      toast.success('Token extracted successfully!')
      setDCookie('')
      setWorkspaceUrl('')
      queryClient.invalidateQueries(['tokens'])
      queryClient.invalidateQueries(['channels'])
    },
    onError: (error) => {
      toast.error(`Failed to extract token: ${error.message}`)
    }
  })

  const renewTokenMutation = useMutation({
    mutationFn: tokenApi.renewToken,
    onSuccess: (data) => {
      toast.success('Token renewed successfully!')
      queryClient.invalidateQueries(['tokens'])
      queryClient.invalidateQueries(['channels'])
    },
    onError: (error) => {
      toast.error(`Failed to renew token: ${error.message}`)
    }
  })

  const resetTokenMutation = useMutation({
    mutationFn: tokenApi.resetToken,
    onSuccess: () => {
      toast.success('Token reset successfully!')
      queryClient.invalidateQueries(['tokens'])
    },
    onError: (error) => {
      toast.error(`Failed to reset token: ${error.message}`)
    }
  })

  const handleExtractToken = (e) => {
    e.preventDefault()
    if (!dCookie || !workspaceUrl) {
      toast.error('Please provide both cookie and workspace URL')
      return
    }

    if (tokens && tokens.length > 0) {
      const confirmOverwrite = window.confirm(
        'You already have an active token. Extracting a new token will replace the existing one. Continue?'
      )
      if (!confirmOverwrite) {
        return
      }
    }

    extractTokenMutation.mutate({ dCookie, workspaceUrl })
  }

  const handleRenewToken = (token) => {
    renewTokenMutation.mutate({ token })
  }

  const handleResetToken = () => {
    if (window.confirm('Are you sure you want to reset all tokens?')) {
      resetTokenMutation.mutate()
    }
  }

  return (
    <div className='container'>
      <Typography variant='h1' gutterBottom>
        Token Management
      </Typography>
      <Typography variant='body1' sx={{ mb: 3 }}>
        Manage your Slack workspace token for conversation access
      </Typography>
      <Alert severity='info' sx={{ mb: 3 }}>
        <strong>💡 Single Token Mode:</strong> Only one workspace token can be active at a time. Extracting a new token will replace your existing one.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h2' gutterBottom>
            Extract New Token
          </Typography>
          <Box component='form' onSubmit={handleExtractToken} noValidate>
            <TextField
              fullWidth
              id='dCookie'
              label='d Cookie'
              value={dCookie}
              onChange={(e) => setDCookie(e.target.value)}
              multiline
              rows={4}
              placeholder="Paste your 'd' cookie value here..."
              required
              sx={{ mb: 2 }}
              helperText="This cookie is typically found in your browser's developer tools"
            />
            <TextField
              fullWidth
              id='workspaceUrl'
              label='Workspace URL'
              value={workspaceUrl}
              onChange={(e) => setWorkspaceUrl(e.target.value)}
              placeholder='e.g., https://yourworkspace.slack.com or yourworkspace.slack.com'
              required
              sx={{ mb: 3 }}
              helperText='The full URL to your Slack workspace'
            />
            <Button
              type='submit'
              variant='contained'
              disabled={extractTokenMutation.isLoading}
              startIcon={extractTokenMutation.isLoading ? <CircularProgress size={20} /> : null}
              size='large'
            >
              {extractTokenMutation.isLoading ? 'Extracting...' : 'Extract Token'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {isLoading
        ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant='h2'>Loading tokens...</Typography>
              <LinearProgress sx={{ mt: 2 }} />
            </CardContent>
          </Card>
          )
        : (
          <Card>
            <CardContent>
              <Typography variant='h2' gutterBottom>
                Current Active Token
              </Typography>
              {tokens && tokens.length > 0
                ? (
                  <>
                    {tokens.map((token, index) => (
                      <Card key={index} sx={{ mb: 2, border: '1px solid #89b4fa' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant='h3' component='h3'>
                              {token.workspaceName || 'Unknown Workspace'}
                            </Typography>
                            <Chip
                              label='✓ Active'
                              color='success'
                              size='small'
                            />
                          </Box>

                          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                            <Typography variant='body2' color='text.secondary'>
                              Token Type:
                            </Typography>
                            <Chip
                              label={token.tokenType || 'Unknown'}
                              size='small'
                              color='primary'
                              sx={{ ml: 1 }}
                            />
                          </Box>

                          <Typography variant='body2' sx={{ mb: 1 }}>
                            <strong>Workspace URL:</strong> {token.workspaceUrl || 'N/A'}
                          </Typography>

                          <Typography variant='body2' sx={{ mb: 1 }}>
                            <strong>Created:</strong> {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'Unknown'}
                          </Typography>

                          <Typography variant='body2' sx={{ mb: 2 }}>
                            <strong>IP Address:</strong> {token.ipAddress || 'Unknown'}
                          </Typography>

                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant='outlined'
                              size='small'
                              startIcon={<RefreshIcon />}
                              onClick={() => handleRenewToken(token.tokenValue)}
                              disabled={renewTokenMutation.isLoading}
                            >
                              Renew Token
                            </Button>
                            <Tooltip title='Copy token to clipboard'>
                              <IconButton
                                size='small'
                                onClick={() => navigator.clipboard.writeText(token.tokenValue)}
                              >
                                <ContentCopyIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}

                    <Alert
                      severity='warning'
                      sx={{ mt: 2 }}
                      action={
                        <Button
                          color='inherit'
                          size='small'
                          startIcon={<DeleteIcon />}
                          onClick={handleResetToken}
                          disabled={resetTokenMutation.isLoading}
                        >
                          {resetTokenMutation.isLoading ? 'Resetting...' : 'Remove Token'}
                        </Button>
                  }
                    >
                      This will remove your active token and you'll need to re-authenticate with your workspace
                    </Alert>
                  </>
                  )
                : (
                  <Alert severity='info'>
                    No tokens found. Extract a token to get started.
                  </Alert>
                  )}
            </CardContent>
          </Card>
          )}
    </div>
  )
}

export default TokenPage
