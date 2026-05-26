'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title} ({count})
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  )
}
