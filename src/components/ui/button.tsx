'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Loader2 } from 'lucide-react'

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-md transition-all focus-ring disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:   'bg-accent text-white hover:bg-accent-hover shadow-[0_0_0_1px_rgba(124,110,245,.3),0_8px_24px_-8px_rgba(124,110,245,.6)] hover:shadow-glow',
        secondary: 'bg-surface-muted text-text border border-border hover:bg-surface-strong hover:border-border-strong',
        ghost:     'text-text-muted hover:text-text hover:bg-surface-muted',
        outline:   'bg-transparent text-text border border-border hover:bg-surface-muted hover:border-border-strong',
        success:   'bg-success text-white hover:bg-success-hover shadow-[0_0_0_1px_rgba(16,185,129,.3),0_8px_24px_-8px_rgba(16,185,129,.6)]',
        danger:    'bg-danger text-white hover:bg-danger-hover',
        buy:       'bg-success text-white hover:bg-success-hover',
        sell:      'bg-danger text-white hover:bg-danger-hover',
        link:      'text-accent hover:text-accent-hover underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-8  px-3   text-xs',
        md: 'h-10 px-4   text-sm',
        lg: 'h-12 px-6   text-base',
        xl: 'h-14 px-8   text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    // Slot requires a single React element child, so we can't inject the
    // loader spinner when asChild=true. Loading state still disables.
    return (
      <Comp
        ref={ref}
        className={cn(button({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
