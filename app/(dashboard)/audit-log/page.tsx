import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditLogClient from '@/components/modules/audit-log/audit-log-client'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: logs },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500),
  ])

  return (
    <AuditLogClient
      logs={logs ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
    />
  )
}
