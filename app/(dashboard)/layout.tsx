import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/dashboard-shell'
import SessionGuard from '@/components/auth/session-guard'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('users_profile')
      .select('id, name, role')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  return (
    <DashboardShell serverProfile={profile}>
      <SessionGuard />
      {children}
    </DashboardShell>
  )
}
