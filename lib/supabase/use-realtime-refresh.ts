'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './client'

/**
 * Subscribe ke satu atau beberapa tabel Supabase.
 * Setiap ada INSERT/UPDATE/DELETE → router.refresh() untuk re-fetch server component.
 */
export function useRealtimeRefresh(tables: string[]) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channels = tables.map(table =>
      supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          router.refresh()
        })
        .subscribe()
    )
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, []) // ponytail: stable ref, tables tidak berubah setelah mount
}
