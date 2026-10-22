'use client'

import { useCallback } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import type { FriendlyError } from '@/core/provider-errors'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'

interface ErrorDetailsPopoverProps {
  error: FriendlyError
  className?: string
}

/** Details trigger with the raw provider text and a copy action. */
export function ErrorDetailsPopover(props: ErrorDetailsPopoverProps) {
  const { error, className } = props

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(error.raw)
      toast.success('Details copied')
    } catch {
      toast.error('Copy failed')
    }
  }, [error.raw])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={cn('text-fg-2 hover:bg-hover hover:text-fg', className)}
        >
          Details
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <pre className="max-h-60 overflow-auto rounded-lg bg-black/20 p-2 font-mono text-xs wrap-break-word whitespace-pre-wrap text-fg-2 select-text">
          {error.raw}
        </pre>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-lg px-2 text-xxs"
            onClick={handleCopy}
          >
            <Copy size={12} aria-hidden />
            Copy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
