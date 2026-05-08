import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring/20',
  {
    variants: {
      variant: {
        default: 
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        secondary: 
          'border-transparent bg-muted text-muted-foreground hover:bg-accent',
        destructive: 
          'border-transparent bg-red-50 text-red-700 hover:bg-red-100',
        outline: 
          'text-muted-foreground border-border hover:bg-muted',
        success:
          'border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        warning:
          'border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100',
        ghost:
          'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
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
