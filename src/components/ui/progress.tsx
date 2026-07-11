'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/cn'

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value: number
  tone?: 'success' | 'danger' | 'warn' | 'accent' | 'info'
}

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, tone = 'accent', ...props }, ref) => {
  const bar = {
    success: 'bg-success', danger: 'bg-danger', warn: 'bg-warn', accent: 'bg-accent', info: 'bg-info',
  }[tone]
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 transition-transform duration-500 ease-out', bar)}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = 'Progress'
