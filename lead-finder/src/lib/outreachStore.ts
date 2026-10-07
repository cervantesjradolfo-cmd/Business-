import { useCallback, useEffect, useState } from 'react'
import { loadMailbox, loadOutreach } from './outreach'
import { mailboxKey, outreachKey, writeJson } from './storage'
import type { Mailbox, OutreachState } from './types'

// The key helpers live in storage.ts (deleteProfile needs them); re-exported here.
export { mailboxKey, outreachKey }

// The key is fixed for the hook's lifetime: the app remounts its workspace when the profile changes.
export function useOutreach(key: string) {
  const [state, setState] = useState<OutreachState>(() => loadOutreach(key))

  const update = useCallback((fn: (prev: OutreachState) => OutreachState) => {
    setState((prev) => {
      const next = fn(prev)
      if (next !== prev) writeJson(key, next)
      return next
    })
  }, [key])

  useEffect(() => {
    // keep in sync if another tab edits it
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setState(loadOutreach(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return { state, update }
}

export function useMailbox(key: string): [Mailbox, (m: Mailbox) => void] {
  const [mailbox, setMailbox] = useState<Mailbox>(() => loadMailbox(key))
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setMailbox(loadMailbox(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])
  const set = useCallback((m: Mailbox) => {
    setMailbox(m)
    writeJson(key, m)
  }, [key])
  return [mailbox, set]
}
