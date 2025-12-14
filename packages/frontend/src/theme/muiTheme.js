import { createTheme } from '@mui/material/styles'

const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1e1e2e', // --ctp-base
      paper: 'rgba(49, 50, 68, 0.8)' // --ctp-surface0 with glass effect
    },
    text: {
      primary: '#cdd6f4', // --ctp-text
      secondary: '#a6adc8' // --ctp-overlay1
    },
    primary: {
      main: '#89b4fa', // --ctp-blue
      light: '#74c7ec', // --ctp-sky
      dark: '#cba6f7', // --ctp-mauve
      contrastText: '#1e1e2e' // --ctp-base
    },
    secondary: {
      main: '#45475a' // --ctp-surface1
    },
    success: {
      main: '#a6e3a1', // --ctp-green
      contrastText: '#1e1e2e'
    },
    error: {
      main: '#f38ba8', // --ctp-red
      contrastText: '#1e1e2e'
    },
    warning: {
      main: '#f9e2af', // --ctp-yellow
      contrastText: '#1e1e2e'
    },
    info: {
      main: '#94e2d5', // --ctp-teal
      contrastText: '#1e1e2e'
    },
    divider: '#585b70' // --ctp-overlay0
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#f2cdcd' // --ctp-pink
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#f2cdcd'
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#f2cdcd'
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#f2cdcd'
    },
    body1: {
      fontSize: '1rem',
      color: '#cdd6f4'
    },
    body2: {
      fontSize: '0.875rem',
      color: '#a6adc8'
    },
    caption: {
      fontSize: '0.75rem',
      color: '#6c7086'
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 12 // Custom border radius
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#585b70 #1e1e2e',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#1e1e2e'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#585b70',
            borderRadius: '4px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#6c7086'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(49, 50, 68, 0.7)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(69, 71, 90, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          backgroundImage: 'none' // Remove default MUI gradient
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          padding: '0.75rem 2rem',
          transition: 'all 0.25s ease',
          fontWeight: 600
        },
        contained: {
          background: 'linear-gradient(135deg, #89b4fa 0%, #cba6f7 100%)',
          color: '#1e1e2e',
          boxShadow: '0 4px 14px rgba(137, 180, 250, 0.4)',
          '&:hover': {
            transform: 'translateY(-2px) scale(1.02)',
            boxShadow: '0 8px 25px rgba(137, 180, 250, 0.5)',
            background: 'linear-gradient(135deg, #74c7ec 0%, #f5c2e7 100%)'
          }
        },
        outlined: {
          background: 'transparent',
          color: '#89b4fa',
          border: '2px solid #89b4fa',
          '&:hover': {
            background: '#89b4fa',
            color: '#1e1e2e',
            transform: 'translateY(-1px)'
          }
        },
        text: {
          color: '#89b4fa',
          '&:hover': {
            background: 'rgba(137, 180, 250, 0.1)'
          }
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: 'rgba(49, 50, 68, 0.6)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '0.5rem',
            transition: 'all 0.25s ease',
            '& fieldset': {
              borderColor: '#585b70',
              border: '1px solid #585b70',
              background: 'transparent'
            },
            '&:hover fieldset': {
              borderColor: '#6c7086'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#89b4fa',
              boxShadow: '0 0 0 3px rgba(137, 180, 250, 0.2)'
            }
          },
          '& .MuiInputBase-input': {
            color: '#cdd6f4'
          },
          '& .MuiInputLabel-root': {
            color: '#a6adc8',
            '&.Mui-focused': {
              color: '#89b4fa'
            }
          },
          '& .MuiFormHelperText-root': {
            color: '#6c7086'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(49, 50, 68, 0.7)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid #45475a',
          borderRadius: '0.75rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.25s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
            borderColor: '#89b4fa'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          background: '#585b70',
          color: '#cdd6f4',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderRadius: '0.5rem'
        },
        colorPrimary: {
          background: 'rgba(137, 180, 250, 0.2)',
          color: '#89b4fa'
        },
        colorSecondary: {
          background: 'rgba(245, 194, 231, 0.2)',
          color: '#f5c2e7'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '0.75rem',
          border: '1px solid'
        },
        standardSuccess: {
          background: 'rgba(166, 227, 161, 0.1)',
          borderColor: '#a6e3a1',
          color: '#a6e3a1'
        },
        standardError: {
          background: 'rgba(243, 139, 168, 0.1)',
          borderColor: '#f38ba8',
          color: '#f38ba8'
        },
        standardWarning: {
          background: 'rgba(249, 226, 175, 0.1)',
          borderColor: '#f9e2af',
          color: '#f9e2af'
        },
        standardInfo: {
          background: 'rgba(148, 226, 213, 0.1)',
          borderColor: '#94e2d5',
          color: '#94e2d5'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(30, 30, 46, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #45475a',
          borderRadius: '1rem'
        }
      }
    },
    MuiModal: {
      styleOverrides: {
        backdrop: {
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)'
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          color: '#cdd6f4',
          background: 'rgba(49, 50, 68, 0.55)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(69, 71, 90, 0.5)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          '--DataGrid-rowBorderColor': 'rgba(69, 71, 90, 0.35)',
          '--DataGrid-containerBackground': 'rgba(49, 50, 68, 0.65)',
          '--DataGrid-pinnedBackground': 'rgba(49, 50, 68, 0.65)',
          '--DataGrid-overlayBackground': 'rgba(30, 30, 46, 0.9)',
          '& .MuiDataGrid-columnHeaders': {
            background: 'rgba(49, 50, 68, 0.75)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            borderBottom: '1px solid rgba(69, 71, 90, 0.6)'
          },
          '& .MuiDataGrid-toolbarContainer': {
            background: 'rgba(49, 50, 68, 0.65)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            borderBottom: '1px solid rgba(69, 71, 90, 0.5)',
            padding: '0.5rem',
            gap: '0.5rem'
          },
          '& .MuiDataGrid-footerContainer': {
            background: 'rgba(49, 50, 68, 0.65)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            borderTop: '1px solid rgba(69, 71, 90, 0.5)'
          },
          '& .MuiDataGrid-virtualScroller': {
            background: 'transparent'
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid rgba(69, 71, 90, 0.3)'
          },
          '& .MuiDataGrid-row': {
            '&:hover': {
              background: 'rgba(137, 180, 250, 0.05)'
            }
          },
          '& .MuiDataGrid-row.Mui-selected': {
            background: 'rgba(137, 180, 250, 0.1)'
          },
          '& .MuiDataGrid-row.Mui-selected:hover': {
            background: 'rgba(137, 180, 250, 0.14)'
          },
          '& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-cellContent': {
            color: '#cdd6f4'
          },
          '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root': {
            color: '#a6adc8'
          },
          '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root:hover': {
            background: 'rgba(137, 180, 250, 0.08)'
          },
          '& .MuiDataGrid-menuIconButton': {
            color: '#a6adc8'
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none'
          },
          '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
            outline: 'none'
          },
          '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
            color: '#a6adc8'
          },
          '& .MuiTablePagination-actions .MuiIconButton-root': {
            color: '#a6adc8'
          },
          '& .MuiTablePagination-actions .MuiIconButton-root:hover': {
            background: 'rgba(137, 180, 250, 0.08)'
          }
        }
      }
    }
  },
  shadows: [
    'none',
    ...Array(24).fill(0).map((_, i) => {
      if (i === 1) return '0 1px 3px rgba(0, 0, 0, 0.2)'
      if (i === 2) return '0 2px 8px rgba(0, 0, 0, 0.25)'
      if (i === 4) return '0 4px 14px rgba(137, 180, 250, 0.4)'
      if (i === 8) return '0 8px 25px rgba(137, 180, 250, 0.5)'
      if (i === 12) return '0 12px 40px rgba(0, 0, 0, 0.4)'
      if (i === 16) return '0 16px 48px rgba(0, 0, 0, 0.45)'
      if (i === 24) return '0 24px 64px rgba(0, 0, 0, 0.5)'
      return `0 ${i}px ${i * 3}px rgba(0, 0, 0, 0.3)`
    })
  ]
})

export default muiTheme
