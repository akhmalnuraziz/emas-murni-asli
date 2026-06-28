// ponytail: fire-and-forget audit log — user tidak perlu menunggu log tersimpan
export function logAudit(supabase: any, payload: {
  user_id: string
  aksi: string
  tabel: string
  record_id?: string | number | null
  data_lama?: Record<string, any> | null
  data_baru?: Record<string, any> | null
  catatan?: string | null
}) {
  supabase.from('audit_log').insert(payload).then(() => {})
}
