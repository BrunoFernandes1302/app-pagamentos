'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const LIGHT_VARS: Record<string, string> = {
  '--background':            'oklch(1 0 0)',
  '--foreground':            'oklch(0.145 0 0)',
  '--card':                  'oklch(1 0 0)',
  '--card-foreground':       'oklch(0.145 0 0)',
  '--popover':               'oklch(1 0 0)',
  '--popover-foreground':    'oklch(0.145 0 0)',
  '--primary':               'oklch(0.205 0 0)',
  '--primary-foreground':    'oklch(0.985 0 0)',
  '--secondary':             'oklch(0.97 0 0)',
  '--secondary-foreground':  'oklch(0.205 0 0)',
  '--muted':                 'oklch(0.97 0 0)',
  '--muted-foreground':      'oklch(0.556 0 0)',
  '--accent':                'oklch(0.97 0 0)',
  '--accent-foreground':     'oklch(0.205 0 0)',
  '--destructive':           'oklch(0.577 0.245 27.325)',
  '--border':                'oklch(0.922 0 0)',
  '--input':                 'oklch(0.922 0 0)',
  '--ring':                  'oklch(0.708 0 0)',
}

function applyLight() {
  const el = document.documentElement
  Object.entries(LIGHT_VARS).forEach(([k, v]) => el.style.setProperty(k, v))
}

function applyDark() {
  const el = document.documentElement
  Object.keys(LIGHT_VARS).forEach(k => el.style.removeProperty(k))
}

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') {
      setIsLight(true)
      applyLight()
    }
  }, [])

  function toggle() {
    const next = !isLight
    setIsLight(next)
    if (next) {
      applyLight()
      localStorage.setItem('theme', 'light')
    } else {
      applyDark()
      localStorage.setItem('theme', 'dark')
    }
  }

  return (
    <button
      onClick={toggle}
      title={isLight ? 'Modo escuro' : 'Modo claro'}
      suppressHydrationWarning
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {isLight
        ? <Moon className="h-4 w-4" />
        : <Sun className="h-4 w-4" />}
    </button>
  )
}
