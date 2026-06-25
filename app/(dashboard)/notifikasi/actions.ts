'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markNotifRead(notifId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  // Merge { userId: true } into is_read_by JSONB
  await supabase.rpc('mark_notif_read', { notif_id: notifId, user_id: user.id })
  return { success: true }
}

export async function createNotif({
  judul, pesan, tipe = 'info', icon, link, untuk_role,
}: {
  judul: string
  pesan: string
  tipe?: string
  icon?: string
  link?: string
  untuk_role: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('notifikasi').insert({
    judul, pesan, tipe, icon: icon ?? null, link: link ?? null,
    untuk_role, is_read_by: {}, created_by: user?.id ?? 'system',
  })
  if (error) return { error: error.message }
  return { success: true }
}
