'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const GRAMASI_ORDER = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

export interface StokRow {
  gramasi: string
  pcs_sistem: number
  gram_sistem: number
  pcs_fisik: number
  gram_fisik: number
  selisih_pcs: number
  selisih_gram: number
}

async function generateSOCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'stock_opname' })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `SO.GDCJ/${today}/${String(data ?? 1).padStart(3, '0')}`
}

export async function getStokSistem(lokasi: string): Promise<StokRow[]> {
  const supabase = await createClient()

  if (lokasi === 'gudang_pusat') {
    // Stok gudang: shieldtag aktif (status Aktif = belum dimutasi)
    const { data: tags } = await supabase
      .from('shieldtag')
      .select('gramasi, hpp')
      .eq('status', 'Aktif')
      .is('voided_at', null)

    const map: Record<string, { pcs: number; gram: number }> = {}
    for (const t of tags ?? []) {
      const g = t.gramasi ?? '0'
      if (!map[g]) map[g] = { pcs: 0, gram: 0 }
      map[g].pcs++
      map[g].gram += parseFloat(g)
    }
    return GRAMASI_ORDER
      .filter(g => map[g])
      .map(g => ({
        gramasi: g,
        pcs_sistem: map[g].pcs,
        gram_sistem: parseFloat((map[g].gram).toFixed(3)),
        pcs_fisik: map[g].pcs,
        gram_fisik: parseFloat((map[g].gram).toFixed(3)),
        selisih_pcs: 0,
        selisih_gram: 0,
      }))
  } else {
    // Stok cabang: ShieldTag status Aktif yang lokasinya di cabang tersebut
    const { data: tags } = await supabase
      .from('shieldtag')
      .select('gramasi')
      .eq('status', 'Aktif')
      .eq('lokasi', lokasi)
      .is('voided_at', null)

    const map: Record<string, { pcs: number; gram: number }> = {}
    for (const t of tags ?? []) {
      const g = t.gramasi ?? '0'
      if (!map[g]) map[g] = { pcs: 0, gram: 0 }
      map[g].pcs++
      map[g].gram += parseFloat(g)
    }
    return GRAMASI_ORDER
      .filter(g => map[g])
      .map(g => ({
        gramasi: g,
        pcs_sistem: map[g].pcs,
        gram_sistem: parseFloat((map[g].gram).toFixed(3)),
        pcs_fisik: map[g].pcs,
        gram_fisik: parseFloat((map[g].gram).toFixed(3)),
        selisih_pcs: 0,
        selisih_gram: 0,
      }))
  }
}

export async function saveStockOpname(params: {
  lokasi: string
  lokasiLabel: string
  dataFisik: { gramasi: string; pcs_fisik: number }[]
  catatan: string
  userName?: string
}): Promise<{ success: boolean; error?: string; kode?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const userName = profile?.name ?? params.userName ?? 'Unknown'

  try {
    const sistemRows = await getStokSistem(params.lokasi)
    const fisikMap: Record<string, number> = {}
    for (const f of params.dataFisik) fisikMap[f.gramasi] = f.pcs_fisik

    const dataSistem = sistemRows.map(r => ({
      gramasi: r.gramasi,
      pcs: r.pcs_sistem,
      gram: r.gram_sistem,
    }))

    const dataFisik = sistemRows.map(r => {
      const pcsFisik = fisikMap[r.gramasi] ?? r.pcs_sistem
      return {
        gramasi: r.gramasi,
        pcs: pcsFisik,
        gram: parseFloat((pcsFisik * parseFloat(r.gramasi)).toFixed(3)),
      }
    })

    const selisih = sistemRows.map(r => {
      const pcsFisik = fisikMap[r.gramasi] ?? r.pcs_sistem
      const selisihPcs = pcsFisik - r.pcs_sistem
      return {
        gramasi: r.gramasi,
        selisih_pcs: selisihPcs,
        selisih_gram: parseFloat((selisihPcs * parseFloat(r.gramasi)).toFixed(3)),
      }
    })

    const adaSelisih = selisih.some(s => s.selisih_pcs !== 0)
    const kode = await generateSOCode(supabase)

    const { error } = await supabase.from('stock_opname').insert({
      kode,
      tanggal: new Date().toISOString().slice(0, 10),
      lokasi: params.lokasi,
      status: adaSelisih ? 'pending_approval' : 'selesai',
      data_sistem: dataSistem,
      data_fisik: dataFisik,
      selisih,
      catatan: params.catatan || null,
      created_by: user.id,
    })

    if (error) return { success: false, error: error.message }

    // Audit log
    supabase.from('audit_log').insert({
      user_id: user.id,
      user_name: userName,
      action: 'CREATE',
      module: 'stock_opname',
      record_key: kode,
      after_data: { lokasi: params.lokasi, ada_selisih: adaSelisih },
    })

    revalidatePath('/stock-opname')
    return { success: true, kode }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function approveStockOpname(params: {
  id: number
  kode: string
  approved: boolean
  catatan: string
  userName?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv'].includes(profile?.role ?? ''))
    return { success: false, error: 'Hanya SPV/Admin yang bisa approve' }
  const userName = profile?.name ?? 'Unknown'

  const { error } = await supabase.from('stock_opname').update({
    status: params.approved ? 'disetujui' : 'ditolak',
    approved_by: userName,
    approved_at: new Date().toISOString(),
    catatan: params.catatan || null,
  }).eq('id', params.id)

  if (error) return { success: false, error: error.message }

  supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: userName,
    action: params.approved ? 'APPROVE' : 'REJECT',
    module: 'stock_opname',
    record_key: params.kode,
    reason: params.catatan,
  })

  revalidatePath('/stock-opname')
  return { success: true }
}

export async function getStockOpnameList() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_opname')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data: data ?? [], error: error?.message }
}

export async function getCabangList() {
  const supabase = await createClient()
  const { data } = await supabase.from('cabang').select('kode, nama').eq('aktif', true).order('nama')
  return data ?? []
}
