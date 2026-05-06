'use client'

import React, { type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './button'

interface ErrorBoundaryProps {
  fallback?: ReactNode
  children: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，防止整个应用崩溃
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col items-center p-8 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                出错了
              </h3>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                {this.state.error?.message || '组件渲染时发生未知错误'}
              </p>
              {this.props.onReset && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  重试
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
