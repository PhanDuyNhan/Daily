'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

export function useAccount() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const client = getSupabase()
    let active = true
    const publish = (next: User | null) => {
      queueMicrotask(() => {
        if (active) setUser(next)
      })
    }
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      publish(session?.user ?? null)
    }).data.subscription
    if (!client) publish(null)
    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  return user
}
