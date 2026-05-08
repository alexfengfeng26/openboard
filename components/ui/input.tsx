import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-white px-3 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground',
          'transition-colors duration-200',
          'hover:border-ring/30',
          'focus:border-ring/40 focus:ring-2 focus:ring-ring/10 focus:outline-none',
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
