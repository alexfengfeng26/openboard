import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-slate-200 bg-white px-4 py-2',
          'text-sm text-slate-700 placeholder:text-slate-400',
          'transition-all duration-200',
          'hover:border-slate-300',
          'focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
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
