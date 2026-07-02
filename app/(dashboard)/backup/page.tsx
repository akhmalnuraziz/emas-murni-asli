import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BackupClient from '@/components/modules/backup/backup-client'

export default async function BackupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single()

  // ROLE_CHECK_DISABLED: if (!['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')) {
  //   redirect('/dashboard')
  // }

  return <BackupClient userRole={profile?.role ?? ''} />
}
