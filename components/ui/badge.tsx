import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 
          'border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
        secondary: 
          'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200',
        destructive: 
          'border-transparent bg-rose-100 text-rose-700 hover:bg-rose-200',
        outline: 
          'text-slate-600 border-slate-200 hover:bg-slate-50',
        success:
          'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
        warning:
          'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200',
        ghost:
          'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
