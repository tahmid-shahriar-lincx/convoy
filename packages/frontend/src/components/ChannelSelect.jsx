import React, { useState, useRef, useEffect, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { motion, AnimatePresence } from 'framer-motion'

const Container = styled.div`
  position: relative;
  width: 100%;
  font-family: var(--font-sans);
  z-index: 1000;
`

const InputWrapper = styled(motion.div)`
  position: relative;
  background: rgba(49, 50, 68, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid var(--ctp-surface2);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: text;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: var(--space-2);

  &:hover {
    border-color: var(--ctp-surface1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  ${props =>
    props.$isOpen &&
    css`
      border-color: var(--ctp-blue);
      box-shadow: 0 8px 32px rgba(137, 180, 250, 0.15);
      background: rgba(49, 50, 68, 0.8);
    `
  }

  ${props =>
    props.$disabled &&
    css`
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    `
  }
`

const SelectedItem = styled(motion.div)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
  color: var(--ctp-base);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: default;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  &:hover::before {
    transform: translateX(0);
  }
`

const RemoveButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
  font-size: 12px;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`

const Input = styled.input`
  background: transparent;
  border: none;
  outline: none;
  color: var(--ctp-text);
  font-size: 0.9375rem;
  padding: 0;
  flex: 1;
  min-width: 80px;
  width: 100%;

  &::placeholder {
    color: var(--ctp-subtext0);
  }

  &:disabled {
    cursor: not-allowed;
  }
`

const Dropdown = styled(motion.div)`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(30, 30, 46, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid var(--ctp-surface2);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  z-index: 1001;
`

const SearchHeader = styled.div`
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--ctp-surface1);
  background: rgba(49, 50, 68, 0.3);
`

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  background: rgba(49, 50, 68, 0.6);
  border: 1px solid var(--ctp-surface2);
  border-radius: var(--radius-md);
  color: var(--ctp-text);
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: var(--ctp-blue);
    box-shadow: 0 0 0 2px rgba(137, 180, 250, 0.2);
  }

  &::placeholder {
    color: var(--ctp-subtext0);
  }
`

const GroupHeader = styled.div`
  padding: 8px 16px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ctp-subtext1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(88, 91, 112, 0.2);
  border-bottom: 1px solid var(--ctp-surface1);
  display: flex;
  align-items: center;
  gap: 8px;

  span {
    opacity: 0.8;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
  }
`

const OptionList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(49, 50, 68, 0.2);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--ctp-surface2);
    border-radius: 4px;

    &:hover {
      background: var(--ctp-surface1);
    }
  }
`

const Option = styled(motion.div)`
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ctp-text);
  position: relative;
  overflow: hidden;
  transition: background-color 0.2s;

  &:hover {
    background: rgba(88, 91, 112, 0.3);
  }

  &:active {
    background: rgba(88, 91, 112, 0.4);
  }

  ${props =>
    props.$selected &&
    css`
      background: rgba(137, 180, 250, 0.15);
      color: var(--ctp-blue);

      &::after {
        content: '✓';
        margin-left: auto;
        font-weight: 600;
      }
    `
  }

  ${props =>
    props.$highlighted &&
    css`
      background: rgba(137, 180, 250, 0.1);
      outline: 1px solid var(--ctp-blue);
      outline-offset: -1px;
    `
  }
`

const ChannelIcon = styled.span`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  background: ${props => {
    if (props.$isPrivate) return 'var(--ctp-maroon)'
    if (props.$isDM) return 'var(--ctp-green)'
    if (props.$isGroupDM) return 'var(--ctp-peach)'
    return 'var(--ctp-blue)'
  }};
  color: var(--ctp-base);
  border-radius: 6px;
  font-weight: 600;
`

const ChannelInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const ChannelName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ChannelMeta = styled.div`
  font-size: 0.75rem;
  color: var(--ctp-subtext0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;
`

const NoResults = styled.div`
  padding: var(--space-6);
  text-align: center;
  color: var(--ctp-subtext0);
  font-size: 0.875rem;
  font-style: italic;
`

const Loading = styled.div`
  padding: var(--space-6);
  text-align: center;
  color: var(--ctp-subtext0);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &::after {
    content: '';
    width: 16px;
    height: 16px;
    border: 2px solid var(--ctp-surface2);
    border-top-color: var(--ctp-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

const ChannelSelect = ({
  options = [],
  value = null,
  onChange,
  placeholder = 'Search and select a channel...',
  disabled = false,
  loading = false,
  searchable = true,
  showGroupHeaders = true,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const groupedOptions = React.useMemo(() => {
    const groups = {
      channels: [],
      dms: [],
      private: []
    }

    options.forEach(option => {
      if (option.is_im) {
        groups.dms.push(option)
      } else if (option.is_private) {
        groups.private.push(option)
      } else {
        groups.channels.push(option)
      }
    })

    return groups
  }, [options])

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return groupedOptions

    const term = searchTerm.toLowerCase()
    const filter = (items) =>
      items.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.display_name?.toLowerCase().includes(term) ||
        (item.is_private && 'private'.includes(term)) ||
        (item.is_im && 'direct message'.includes(term))
      )

    return {
      channels: filter(groupedOptions.channels),
      private: filter(groupedOptions.private),
      dms: filter(groupedOptions.dms)
    }
  }, [groupedOptions, searchTerm])

  const flatFilteredOptions = React.useMemo(() => {
    const all = []
    if (filteredOptions.channels.length > 0) all.push(...filteredOptions.channels)
    if (filteredOptions.private.length > 0) all.push(...filteredOptions.private)
    if (filteredOptions.dms.length > 0) all.push(...filteredOptions.dms)
    return all
  }, [filteredOptions])

  const selectedOption = React.useMemo(() => {
    return value ? options.find(opt => opt.id === value) : null
  }, [value, options])

  const handleSelect = useCallback((option) => {
    if (disabled) return

    const newValue = value === option.id ? null : option.id
    onChange(newValue)

    setSearchTerm('')
    setIsOpen(false)
    setHighlightedIndex(-1)
  }, [value, onChange, disabled])

  const handleRemove = useCallback((e) => {
    e.stopPropagation()
    onChange(null)
  }, [onChange])

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < flatFilteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : flatFilteredOptions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && flatFilteredOptions[highlightedIndex]) {
          handleSelect(flatFilteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }, [isOpen, highlightedIndex, flatFilteredOptions, handleSelect])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleTab = (e) => {
      if (e.key === 'Tab' && isOpen) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  const getChannelIcon = (option) => {
    if (option.is_im) return '👤'
    if (option.is_private) return '🔒'
    if (option.is_mpim) return '👥'
    return '#'
  }

  const getGroupInfo = (type) => {
    switch (type) {
      case 'channels':
        return { icon: '#', label: 'Channels' }
      case 'private':
        return { icon: '🔒', label: 'Private Channels' }
      case 'dms':
        return { icon: '👤', label: 'Direct Messages' }
      default:
        return { icon: '', label: 'Other' }
    }
  }

  return (
    <Container ref={containerRef} {...props}>
      <InputWrapper
        $isOpen={isOpen}
        $disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        whileTap={{ scale: disabled ? 1 : 0.995 }}
      >
        {selectedOption
          ? (
            <SelectedItem
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <ChannelIcon
                $isPrivate={selectedOption.is_private}
                $isDM={selectedOption.is_im}
                $isGroupDM={selectedOption.is_mpim}
              >
                {getChannelIcon(selectedOption)}
              </ChannelIcon>
              {selectedOption.name}
              <RemoveButton
                onClick={handleRemove}
                aria-label={`Remove ${selectedOption.name}`}
              >
                ×
              </RemoveButton>
            </SelectedItem>
            )
          : (
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              disabled={disabled}
            />
            )}
      </InputWrapper>

      <AnimatePresence>
        {isOpen && (
          <Dropdown
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.2 }}
          >
            {searchable && (
              <SearchHeader>
                <SearchInput
                  placeholder='Search channels...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </SearchHeader>
            )}

            {loading
              ? (
                <Loading>Loading channels...</Loading>
                )
              : flatFilteredOptions.length === 0
                ? (
                  <NoResults>
                    {searchTerm ? 'No channels match your search' : 'No channels available'}
                  </NoResults>
                  )
                : (
                  <OptionList>
                    {showGroupHeaders && (
                      <>
                        {filteredOptions.channels.length > 0 && (
                          <GroupHeader>
                            {getGroupInfo('channels').icon}
                            {getGroupInfo('channels').label}
                            <span>({filteredOptions.channels.length})</span>
                          </GroupHeader>
                        )}
                        {filteredOptions.private.length > 0 && (
                          <GroupHeader>
                            {getGroupInfo('private').icon}
                            {getGroupInfo('private').label}
                            <span>({filteredOptions.private.length})</span>
                          </GroupHeader>
                        )}
                        {filteredOptions.dms.length > 0 && (
                          <GroupHeader>
                            {getGroupInfo('dms').icon}
                            {getGroupInfo('dms').label}
                            <span>({filteredOptions.dms.length})</span>
                          </GroupHeader>
                        )}
                      </>
                    )}

                    {filteredOptions.channels.map((option, idx) => (
                      <Option
                        key={option.id}
                        onClick={() => handleSelect(option)}
                        $selected={value === option.id}
                        $highlighted={highlightedIndex === idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <ChannelIcon $isPrivate={option.is_private} $isDM={option.is_im}>
                          {getChannelIcon(option)}
                        </ChannelIcon>
                        <ChannelInfo>
                          <ChannelName>{option.name}</ChannelName>
                          <ChannelMeta>
                            {option.num_members && `${option.num_members} members`}
                            {option.is_private && ' • Private'}
                          </ChannelMeta>
                        </ChannelInfo>
                      </Option>
                    ))}
                    {filteredOptions.private.map((option, idx) => (
                      <Option
                        key={option.id}
                        onClick={() => handleSelect(option)}
                        $selected={value === option.id}
                        $highlighted={highlightedIndex === filteredOptions.channels.length + idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (filteredOptions.channels.length + idx) * 0.02 }}
                      >
                        <ChannelIcon $isPrivate={option.is_private}>
                          {getChannelIcon(option)}
                        </ChannelIcon>
                        <ChannelInfo>
                          <ChannelName>{option.name}</ChannelName>
                          <ChannelMeta>
                            {option.num_members && `${option.num_members} members`}
                            Private channel
                          </ChannelMeta>
                        </ChannelInfo>
                      </Option>
                    ))}
                    {filteredOptions.dms.map((option, idx) => (
                      <Option
                        key={option.id}
                        onClick={() => handleSelect(option)}
                        $selected={value === option.id}
                        $highlighted={
                      highlightedIndex ===
                      filteredOptions.channels.length +
                      filteredOptions.private.length + idx
                    }
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: (
                            filteredOptions.channels.length +
                        filteredOptions.private.length +
                        idx
                          ) * 0.02
                        }}
                      >
                        <ChannelIcon $isDM={option.is_im}>
                          {getChannelIcon(option)}
                        </ChannelIcon>
                        <ChannelInfo>
                          <ChannelName>{option.name}</ChannelName>
                          <ChannelMeta>
                            Direct message
                          </ChannelMeta>
                        </ChannelInfo>
                      </Option>
                    ))}
                  </OptionList>
                  )}
          </Dropdown>
        )}
      </AnimatePresence>
    </Container>
  )
}

export default ChannelSelect
