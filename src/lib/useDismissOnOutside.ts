'use client'

import { useEffect, useRef } from 'react'

/**
 * Dismiss behavior for popover menus (Phase 6 bug pass): users expect
 * clicking anywhere outside — or pressing Escape — to close a transient
 * popover. Returns a ref to attach to the popover's outermost wrapper
 * (trigger + panel); listeners live on `document` so clicks on elements
 * mounted outside the wrapper still close it.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return ref
}
