'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/lib/types/database'
import { ROLE_ACCESS } from '@/lib/types/database'

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Singleton client — dibuat sekali, tidak direcreate tiap render
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Sign out melalui server-side route handler.
   * Ini memastikan cookies Supabase dihapus di level server
   * sehingga middleware tidak salah redirect balik ke dashboard.
   */
  const signOut = () => {
    window.location.href = '/api/auth/signout'
  }

  const hasAccess = (module: string): boolean => {
    if (!profile) return false
    if (profile.role === 'owner') return true
    return ROLE_ACCESS[profile.role]?.includes(module) ?? false
  }

  return { user, profile, loading, signOut, hasAccess }
}
