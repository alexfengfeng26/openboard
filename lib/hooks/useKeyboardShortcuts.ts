'use client'

import { useEffect, useCallback, useState } from 'react'

export interface KeyboardShortcutConfig {
  onFocusSearch?: () => void
  onFocusQuickAdd?: () => void
  onExitSelectionMode?: () => void
  onCloseDialog?: () => boolean
  onToggleHelp?: () => void
}

export function useKeyboardShortcuts(config: KeyboardShortcutConfig) {
  const [showHelp, setShowHelp] = useState(false)

  const onToggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev)
    config.onToggleHelp?.()
  }, [config])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        config.onFocusSearch?.()
        return
      }

      // Cmd/Ctrl + N: focus first lane quick add
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        config.onFocusQuickAdd?.()
        return
      }

      // ?: show help (only when not typing in input/textarea)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        const tagName = target.tagName.toLowerCase()
        const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          onToggleHelp()
          return
        }
      }

      // Escape: exit selection mode or close dialog
      if (e.key === 'Escape') {
        const dialogClosed = config.onCloseDialog?.() ?? false
        if (!dialogClosed) {
          config.onExitSelectionMode?.()
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config, onToggleHelp])

  return { showHelp, setShowHelp }
}
