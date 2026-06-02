'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAuditLogs({
  page = 1,
  limit = 30,
  action,
  module,
  user_name,
  dateFrom,
  dateTo,
}: {
  page?: number
  limit?: number
  action?: string
  module?: string
  user_name?: string
  dateFrom?: string
  dateTo?: string
}) {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  let q = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action)    q = q.eq('action', action)
  if (module)    q = q.ilike('module', `%${module}%`)
  if (user_name) q = q.ilike('user_name', `%${user_name}%`)
  if (dateFrom)  q = q.gte('timestamp', dateFrom)
  if (dateTo)    q = q.lte('timestamp', dateTo + 'T23:59:59')

  const { data, count, error } = await q
  if (error) return { logs: [], total: 0 }
  return { logs: data ?? [], total: count ?? 0 }
}

export async function getAuditStats() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('action')
  
  const stats: Record<string, number> = {}
  ;(data ?? []).forEach((r: any) => {
    stats[r.action] = (stats[r.action] || 0) + 1
  })
  return stats
}
