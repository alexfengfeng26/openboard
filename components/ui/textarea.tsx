import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3',
          'text-sm text-slate-700 placeholder:text-slate-400',
          'transition-all duration-200',
          'hover:border-slate-300',
          'focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
          'resize-y',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
