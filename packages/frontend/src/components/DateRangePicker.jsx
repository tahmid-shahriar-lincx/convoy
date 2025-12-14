import React, { useEffect, useState } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  Box,
  FormControl,
  Grid,
  MenuItem,
  Select,
  IconButton
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import { format, subDays, subMonths } from 'date-fns'
import dayjs from 'dayjs'

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
  const [errors, setErrors] = useState({})
  const [selection, setSelection] = useState('7days')

  const presets = [
    {
      label: 'Today',
      value: 'today',
      getRange: () => ({
        start: new Date(),
        end: new Date()
      })
    },
    {
      label: 'Yesterday',
      value: 'yesterday',
      getRange: () => {
        const d = subDays(new Date(), 1)
        return { start: d, end: d }
      }
    },
    {
      label: 'Last 3 Days',
      value: '3days',
      getRange: () => ({
        start: subDays(new Date(), 2),
        end: new Date()
      })
    },
    {
      label: 'Last 7 Days',
      value: '7days',
      getRange: () => ({
        start: subDays(new Date(), 7),
        end: new Date()
      })
    },
    {
      label: 'Last 15 Days',
      value: '15days',
      getRange: () => ({
        start: subDays(new Date(), 15),
        end: new Date()
      })
    },
    {
      label: 'Last 30 Days',
      value: '30days',
      getRange: () => ({
        start: subDays(new Date(), 30),
        end: new Date()
      })
    },
    {
      label: 'Last 3 Months',
      value: '3months',
      getRange: () => ({
        start: subMonths(new Date(), 3),
        end: new Date()
      })
    },
    {
      label: 'Last 6 Months',
      value: '6months',
      getRange: () => ({
        start: subMonths(new Date(), 6),
        end: new Date()
      })
    },
    {
      label: 'Last Year',
      value: '1year',
      getRange: () => ({
        start: subMonths(new Date(), 12),
        end: new Date()
      })
    }
  ]

  const handlePresetSelect = (preset) => {
    const range = preset.getRange()
    onStartDateChange(format(range.start, 'yyyy-MM-dd'))
    onEndDateChange(format(range.end, 'yyyy-MM-dd'))
    setErrors({})
  }

  const handleStartDateChange = (newDate) => {
    if (selection !== 'custom') setSelection('custom')
    if (newDate && newDate.isValid()) {
      const formattedDate = newDate.format('YYYY-MM-DD')
      onStartDateChange(formattedDate)

      if (errors.startDate) {
        setErrors(prev => ({ ...prev, startDate: '' }))
      }

      if (endDate && newDate.isAfter(endDate, 'day')) {
        setErrors(prev => ({
          ...prev,
          startDate: 'Start date cannot be after end date'
        }))
      }
    }
  }

  const handleEndDateChange = (newDate) => {
    if (selection !== 'custom') setSelection('custom')
    if (newDate && newDate.isValid()) {
      const formattedDate = newDate.format('YYYY-MM-DD')
      onEndDateChange(formattedDate)

      if (errors.endDate) {
        setErrors(prev => ({ ...prev, endDate: '' }))
      }

      if (startDate && newDate.isBefore(startDate, 'day')) {
        setErrors(prev => ({
          ...prev,
          endDate: 'End date cannot be before start date'
        }))
      }
    }
  }

  const handleClear = () => {
    const defaultPreset = presets.find(p => p.value === '7days')
    if (defaultPreset) {
      setSelection(defaultPreset.value)
      handlePresetSelect(defaultPreset)
      return
    }

    setSelection('7days')
    onStartDateChange('')
    onEndDateChange('')
    setErrors({})
  }

  const handleSelectionChange = (event) => {
    const value = event.target.value
    setSelection(value)

    if (value === 'custom') {
      setErrors({})
      return
    }

    const preset = presets.find(p => p.value === value)
    if (!preset) return

    handlePresetSelect(preset)
  }

  useEffect(() => {
    if (startDate || endDate) return
    handleClear()
  }, [startDate, endDate])

  useEffect(() => {
    if (selection === 'custom') return
    if (!startDate || !endDate) return

    const match = presets.find((preset) => {
      const range = preset.getRange()
      const presetStart = format(range.start, 'yyyy-MM-dd')
      const presetEnd = format(range.end, 'yyyy-MM-dd')
      return presetStart === startDate && presetEnd === endDate
    })

    if (match && selection !== match.value) {
      setSelection(match.value)
      return
    }

    if (!match && selection !== 'custom') setSelection('custom')
  }, [startDate, endDate])

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%' }}>
        <Grid container spacing={1} alignItems='center' wrap='nowrap'>
          <Grid item xs>
            <DatePicker
              value={startDate ? dayjs(startDate) : null}
              onChange={handleStartDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  error: !!errors.startDate,
                  placeholder: 'Start'
                }
              }}
            />
          </Grid>

          <Grid item xs>
            <DatePicker
              value={endDate ? dayjs(endDate) : null}
              onChange={handleEndDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  error: !!errors.endDate,
                  placeholder: 'End'
                }
              }}
            />
          </Grid>

          <Grid item sx={{ minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FormControl fullWidth size='small'>
                <Select value={selection} onChange={handleSelectionChange}>
                  <MenuItem value='custom'>Custom</MenuItem>
                  {presets.map((preset) => (
                    <MenuItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selection !== '7days' && (
                <IconButton
                  size='small'
                  onClick={handleClear}
                  aria-label='Reset to last 7 days'
                >
                  <ClearIcon fontSize='small' />
                </IconButton>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  )
}

export default DateRangePicker
