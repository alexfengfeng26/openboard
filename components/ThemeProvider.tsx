'use client'

import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string>('claude')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 从 localStorage 读取主题（避免 hydration 不匹配）
    const saved = localStorage.getItem('kanban-theme')
    if (saved === 'notion' || saved === 'claude') {
      setTheme(saved)
      document.documentElement.classList.toggle('notion-theme', saved === 'notion')
    } else {
      // 尝试从服务器设置读取
      fetch('/api/settings/appearance')
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data?.theme) {
            const t = result.data.theme
            setTheme(t)
            localStorage.setItem('kanban-theme', t)
            document.documentElement.classList.toggle('notion-theme', t === 'notion')
          }
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('notion-theme', theme === 'notion')
    localStorage.setItem('kanban-theme', theme)
  }, [theme, mounted])

  // 监听其他标签页/组件通过 storage 事件切换主题
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'kanban-theme') {
        const t = e.newValue
        if (t === 'notion' || t === 'claude') {
          setTheme(t)
          document.documentElement.classList.toggle('notion-theme', t === 'notion')
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // 暴露全局切换函数供设置页面使用
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__setKanbanTheme = (t: string) => {
      if (t === 'notion' || t === 'claude') {
        setTheme(t)
      }
    }
  }, [])

  return <>{children}</>
}
