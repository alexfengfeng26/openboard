import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[100px] w-full rounded-md border border-input bg-white px-3 py-2.5',
          'text-sm text-foreground placeholder:text-muted-foreground',
          'transition-colors duration-200',
          'hover:border-ring/30',
          'focus:border-ring/40 focus:ring-2 focus:ring-ring/10 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
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
