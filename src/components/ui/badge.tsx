'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tabular',
  {
    variants: {
      tone: {
        success: 'bg-success-muted text-success border-success/30',
        danger:  'bg-danger-muted  text-danger  border-danger/30',
        warn:    'bg-warn-muted    text-warn    border-warn/30',
        info:    'bg-info-muted    text-info    border-info/30',
        accent:  'bg-accent-muted  text-accent  border-accent/30',
        neutral: 'bg-surface-muted text-text-muted border-border',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
