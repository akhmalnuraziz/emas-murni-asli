'use client'

import { useEffect, useState } from 'react'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useSupabase() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)

  useEffect(() => {
    setSupabase(createClient())
  }, [])

  return supabase
}

// Example hook for fetching data
export function useSupabaseQuery<T>(
  table: string,
  onMount?: boolean
) {
  const supabase = useSupabase()
  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!onMount || !supabase) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from(table).select('*')
        
        if (error) throw error
        setData(data as T[])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, table, onMount])

  return { data, loading, error }
}
