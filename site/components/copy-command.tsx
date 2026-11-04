'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type Props = {
  command: string
  id: string
  compact?: boolean
}

export function CopyCommand({ command, id, compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const selectCommand = () => {
    const node = codeRef.current
    const sel = window.getSelection()
    if (!node || !sel) return
    const range = document.createRange()
    range.selectNodeContents(node)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(command)
      ok = true
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
        ok = document.execCommand('copy')
      } catch {
        ok = false
      } finally {
        document.body.removeChild(area)
      }
    }
    if (!ok) selectCommand()
    setState(ok ? 'copied' : 'failed')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), ok ? 2000 : 5000)
  }

  const label =
    state === 'copied' ? 'Copied' : state === 'failed' ? 'Press Ctrl+C' : compact ? '' : 'Copy'

  return (
    <div
      id={`cmd-${id}`}
      className={`flex items-center gap-3 border border-gray-800 bg-gray-950 max-w-full min-w-0 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm md:text-base'
      }`}
    >
      <span className="text-gray-500 select-none shrink-0">$</span>
      <code
        ref={codeRef}
        className={`font-mono text-white min-w-0 flex-1 ${
          compact ? 'whitespace-nowrap overflow-x-auto' : 'break-all'
        }`}
      >
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command to clipboard"
        className="shrink-0 flex items-center gap-1.5 text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors"
      >
        {state === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span className="text-xs font-mono" aria-hidden="true">{label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed. Command selected, press Ctrl+C.' : ''}
      </span>
    </div>
  )
}
