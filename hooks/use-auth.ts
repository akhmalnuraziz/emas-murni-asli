'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/lib/types/database'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        setProfile(data)
      }
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase
            .from('users_profile')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
          setProfile(data)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const hasAccess = (module: string): boolean => {
    if (!profile) return false
    if (profile.role === 'owner') return true
    const { ROLE_ACCESS } = require('@/lib/types/database')
    return ROLE_ACCESS[profile.role]?.includes(module) ?? false
  }

  return { user, profile, loading, signOut, hasAccess }
}

