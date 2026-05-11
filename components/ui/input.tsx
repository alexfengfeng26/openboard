import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-input bg-white px-3 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground',
          'shadow-[0_2px_8px_rgba(30,24,18,0.04)] transition-all duration-200',
          'hover:border-ring/35 hover:shadow-[0_4px_12px_rgba(30,24,18,0.06)]',
          'focus:border-ring/45 focus:ring-2 focus:ring-ring/12 focus:shadow-[0_6px_16px_rgba(242,140,56,0.18)] focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
