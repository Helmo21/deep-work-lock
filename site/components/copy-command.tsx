'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type Props = {
  command: string
  id: string
  compact?: boolean
}

export function CopyCommand({ command, id, compact = false }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      // Clipboard API unavailable (insecure context): fall back to a hidden textarea.
      const area = document.createElement('textarea')
      area.value = command
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(area)
      }
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      id={`cmd-${id}`}
      className={`flex items-center gap-3 border border-gray-800 bg-gray-950 max-w-full min-w-0 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm md:text-base'
      }`}
    >
      <span className="text-gray-500 select-none shrink-0">$</span>
      <code
        className={`font-mono text-white min-w-0 flex-1 ${
          compact ? 'whitespace-nowrap overflow-x-auto' : 'break-all'
        }`}
      >
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy command to clipboard'}
        className="shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span className="text-xs font-mono" aria-live="polite">
          {copied ? 'Copied' : compact ? '' : 'Copy'}
        </span>
      </button>
    </div>
  )
}
