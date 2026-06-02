'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PROD_PREFIX = 'PROD.GDCJ'
const PCKG_PREFIX = 'PCKG.GDCJ'

async function generateProduksiCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('get_next_code', { p_name: 'produksi' })
  return `${PROD_PREFIX}/${String(data ?? 1).padStart(4, '0')}`
}

async function generatePackingCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('packing').select('*', { count: 'exact', head: true })
  return `${PCKG_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
}

async function updateBatchSisaSeharusnya(supabase: any, batchKode: string) {
  const { data: produksiList } = await supabase
    .from('produksi_item').select('berat_awal')
    .eq('batch_kode', batchKode).is('voided_at', null)
  const totalTerpakai = (produksiList ?? []).reduce((s: number, p: any) => s + (p.berat_awal || 0), 0)
  const { data: batch } = await supabase.from('batch').select('timbangan_akhir').eq('kode', batchKode).single()
  if (batch) {
    await supabase.from('batch').update({
      sisa_bahan_seharusnya: Math.max(0, (batch.timbangan_akhir ?? 0) - totalTerpakai)
    }).eq('kode', batchKode)
  }
}

async function uploadBase64Fotos(supabase: any, b64Array: string[], prefix: string): Promise<string[]> {
  const urls: string[] = []
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_')
  for (let i = 0; i < b64Array.length; i++) {
    const b64 = b64Array[i]
    if (!b64) continue
    try {
      const base64Data = b64.replace(/^data:image\/[^;]+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const path = `produksi/${safe}/${Date.now()}_${i}.jpg`
      const { error } = await supabase.storage
        .from('fotos').upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('fotos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    } catch {}
  }
  return urls
}

export async function createProduksi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const batchKode = formData.get('batch_kode') as string
  const gramasi = formData.get('gramasi') as string
  const pcs = parseInt(formData.get('pcs') as string)
  const beratAwal = parseFloat(formData.get('berat_awal') as string)
  const statusAwal = formData.get('status_awal') as string
  const tanggalProduksi = formData.get('tanggal_produksi') as string

  if (!batchKode) return { error: 'Batch wajib dipilih' }
  if (!gramasi) return { error: 'Gramasi wajib dipilih' }
  if (!pcs || pcs <= 0) return { error: 'PCS wajib diisi' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat wajib diisi' }
  if (!statusAwal) return { error: 'Status awal wajib dipilih' }
  if (!tanggalProduksi) return { error: 'Tanggal produksi wajib diisi' }

  const { data: batch } = await supabase.from('batch').select('*').eq('kode', batchKode).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status === 'terkunci') return { error: 'Batch terkunci — tidak bisa dipakai untuk produksi baru' }

  const sisaSeharusnya = batch.sisa_bahan_seharusnya ?? batch.timbangan_akhir ?? 0
  if (beratAwal > sisaSeharusnya + 0.01) {
    return { error: `Berat melebihi sisa bahan batch (${sisaSeharusnya.toFixed(2)} gr tersisa)` }
  }

  const kode = await generateProduksiCode(supabase)
  const sisaSerbuk = statusAwal === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0

  const { data: produksi, error } = await supabase.from('produksi_item').insert({
    kode, batch_kode: batchKode, gramasi, pcs, pcs_awal: pcs, pcs_good: pcs, pcs_reject: 0,
    nama_item: formData.get('nama_item') as string || null,
    produk_id: formData.get('produk_id') ? parseInt(formData.get('produk_id') as string) : null,
    berat_awal: beratAwal, total_gram: beratAwal, current_status: statusAwal,
    tanggal_produksi: tanggalProduksi, tanggal: tanggalProduksi,
    memo: formData.get('memo') as string || null,
    operator: formData.get('operator') as string || profile?.name || null,
    catatan: formData.get('catatan') as string || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  const fotosSerbukRaw = formData.get('fotos_sisa_serbuk_b64') as string
  const fotosSerbukB64 = fotosSerbukRaw ? JSON.parse(fotosSerbukRaw) : []
  const fotoSerbukUrls = fotosSerbukB64.length > 0 ? await uploadBase64Fotos(supabase, fotosSerbukB64, kode + '_serbuk') : []

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksi.id, tanggal: tanggalProduksi,
    status: statusAwal, total_gram: beratAwal, berat_sebelumnya: beratAwal,
    sisa_serbuk: sisaSerbuk, losses: 0,
    pcs_good_snapshot: pcs,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null,
    fotos: fotoUrls,
    fotos_sisa_serbuk: fotoSerbukUrls.length > 0 ? fotoSerbukUrls : null,
  })

  await updateBatchSisaSeharusnya(supabase, batchKode)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE', module: 'PRODUKSI', record_key: kode, record_id: String(produksi.id), after_data: produksi,
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true, kode }
}

export async function updateStatusProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const statusBaru = formData.get('status_baru') as string
  const tanggal = formData.get('tanggal') as string
  const isReject = statusBaru === 'Reject'

  if (!statusBaru) return { error: 'Status wajib dipilih' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  // ── REJECT PATH ─────────────────────────────────────────────────────────────
  if (isReject) {
    const pcsReject  = parseInt(formData.get('pcs_reject') as string)
    const beratReject = parseFloat(formData.get('berat_reject') as string)
    const pcsGoodNow  = produksi.pcs_good ?? produksi.pcs ?? 0
    const beratNow    = parseFloat(String(produksi.total_gram ?? 0))

    if (!pcsReject  || pcsReject  <= 0) return { error: 'PCS reject wajib diisi' }
    if (!beratReject || beratReject <= 0) return { error: 'Berat reject wajib diisi' }
    if (pcsReject > pcsGoodNow) return { error: `Reject (${pcsReject}) melebihi PCS good (${pcsGoodNow})` }

    const newPcsGood   = pcsGoodNow - pcsReject
    const newTotalGram = Math.max(0, beratNow - beratReject)

    const fotosB64Raw = formData.get('fotos_b64') as string
    const fotosB64    = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
    const fotoUrls    = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, \`\${produksiKode}-reject\`) : []

    await supabase.from('produksi_event').insert({
      produksi_item_id: produksiId, tanggal, status: 'Reject',
      total_gram: newTotalGram, berat_sebelumnya: beratNow,
      sisa_serbuk: 0, losses: 0,
      pcs_good_snapshot: newPcsGood,
      pcs_reject_snapshot: pcsReject,
      catatan: formData.get('catatan') as string || null,
      user_name: profile?.name || null,
      fotos: fotoUrls,
    })

    await supabase.from('produksi_item').update({
      pcs_good: newPcsGood,
      total_gram: newTotalGram,
    }).eq('id', produksiId)

    await supabase.from('audit_log').insert({
      user_id: user.id, user_name: profile?.name, user_role: profile?.role,
      action: 'REJECT', module: 'PRODUKSI',
      record_key: produksiKode, record_id: String(produksiId),
      before_data: { pcs_good: pcsGoodNow, total_gram: beratNow },
      after_data: { pcs_good: newPcsGood, pcs_reject: pcsReject, berat_reject: beratReject },
    })

    revalidatePath('/produksi')
    return { success: true }
  }
  // ── END REJECT PATH ─────────────────────────────────────────────────────────

  const totalGramBaru = parseFloat(formData.get('total_gram_baru') as string)
  const sisaSerbuk = statusBaru === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0

  if (!totalGramBaru || totalGramBaru <= 0) return { error: 'Total berat wajib diisi' }

  // ─── Guard: status non-Reject tidak boleh duplikat ─────────────────────────
  if (statusBaru !== 'Reject') {
    const { count: dupCount } = await supabase.from('produksi_event')
      .select('*', { count: 'exact', head: true })
      .eq('produksi_item_id', produksiId)
      .eq('status', statusBaru)
      .is('voided_at', null)
    if ((dupCount ?? 0) > 0)
      return { error: `Status "${statusBaru}" sudah diinput. Gunakan tombol Edit pada event yang ada jika perlu mengubah data.` }
  }

  // ─── Guard: urutan status harus benar ───────────────────────────────────────
  const STATUS_ORDER: Record<string, number> = { Cutting:1, 'Pas Berat':2, Annealing:3, 'Siap Packing':4, 'Sudah Packing':5 }
  const currentOrder  = STATUS_ORDER[produksi.current_status ?? ''] ?? 0
  const incomingOrder = STATUS_ORDER[statusBaru] ?? 0
  if (incomingOrder > 0 && incomingOrder < currentOrder)
    return { error: `Tidak bisa mundur ke status "${statusBaru}". Status saat ini: "${produksi.current_status}". Hapus event terakhir jika perlu mengulang.` }

  // Reject belum dilebur: warning saja di UI, tidak memblokir Siap Packing
  // Karena pcs good dan reject adalah proses terpisah

  const beratSebelumnya = produksi.total_gram ?? 0

  // H4: berat tidak boleh naik melebihi toleransi timbangan ±0.05gr
  const SCALE_TOLERANCE = 0.05
  if (totalGramBaru > beratSebelumnya + SCALE_TOLERANCE && statusBaru !== 'Cutting')
    return { error: `Berat baru (${totalGramBaru}gr) jauh lebih tinggi dari berat sebelumnya (${beratSebelumnya}gr). Periksa kembali data. Toleransi timbangan: ±${SCALE_TOLERANCE}gr.` }

  const losses = Math.max(0, beratSebelumnya - totalGramBaru - sisaSerbuk)

  // ─── 3% Losses Threshold Confirmation ──────────────────────────────────────
  const overrideReason = (formData.get('override_reason') as string | null)?.trim() ?? ''
  if (losses > 0) {
    const { data: prevEvs } = await supabase.from('produksi_event')
      .select('losses, status').eq('produksi_item_id', produksiId).is('voided_at', null)
    const prevLosses    = (prevEvs ?? []).filter((e: any) => e.status !== 'Reject')
      .reduce((s: number, e: any) => s + (Number(e.losses) || 0), 0)
    const totalLosses   = prevLosses + losses
    const lossesPercent = produksi.berat_awal > 0 ? (totalLosses / produksi.berat_awal) * 100 : 0

    if (lossesPercent > 3 && !overrideReason) {
      return {
        requiresConfirmation: true,
        lossesPercent: Math.round(lossesPercent * 100) / 100,
        totalLosses: Math.round(totalLosses * 1000) / 1000,
        beratAwal: produksi.berat_awal,
        message: `Total losses ${lossesPercent.toFixed(2)}% (${totalLosses.toFixed(3)}gr dari ${produksi.berat_awal}gr) melebihi batas 3%. Butuh konfirmasi Owner/Manager.`,
      }
    }
    if (lossesPercent > 3 && overrideReason) {
      await supabase.from('losses_override_log').insert({
        produksi_id: produksiId, produksi_kode: produksiKode, event_status: statusBaru,
        losses_gram: totalLosses, berat_awal: produksi.berat_awal, losses_percent: lossesPercent,
        override_by: user.id, override_name: profile?.name, override_role: profile?.role,
        override_reason: overrideReason,
      })
    }
  }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-${statusBaru}`) : []

  const fotosSerbukB64Raw = formData.get('fotos_sisa_serbuk_b64') as string
  const fotosSerbukB64 = fotosSerbukB64Raw ? JSON.parse(fotosSerbukB64Raw) : []
  const fotoSerbukUrls = fotosSerbukB64.length > 0 ? await uploadBase64Fotos(supabase, fotosSerbukB64, `${produksiKode}-serbuk`) : []

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId, tanggal, status: statusBaru,
    total_gram: totalGramBaru, berat_sebelumnya: beratSebelumnya,
    sisa_serbuk: sisaSerbuk, losses,
    pcs_good_snapshot: produksi.pcs_good ?? produksi.pcs ?? 0,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null,
    fotos: fotoUrls,
    fotos_sisa_serbuk: fotoSerbukUrls,
  })

  await supabase.from('produksi_item').update({
    current_status: statusBaru, total_gram: totalGramBaru,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_STATUS', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: { status: produksi.current_status, total_gram: beratSebelumnya },
    after_data: { status: statusBaru, total_gram: totalGramBaru, losses },
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function editEvent(eventId: number, produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { data: ev } = await supabase.from('produksi_event').select('*').eq('id', eventId).single()
  if (!ev) return { error: 'Event tidak ditemukan' }
  if (ev.voided_at) return { error: 'Event sudah dihapus, tidak bisa diedit' }
  if (ev.status === 'Reject') return { error: 'Event Reject tidak bisa diedit. Void event jika perlu mengulang.' }

  const totalGram  = parseFloat(formData.get('total_gram') as string)
  const sisaSerbuk = parseFloat(formData.get('sisa_serbuk') as string || '0')
  const catatan    = formData.get('catatan') as string || null
  const tanggal    = formData.get('tanggal') as string

  if (!totalGram || totalGram <= 0) return { error: 'Berat wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  // Losses dihitung ulang dari berat sebelumnya event ini
  const losses = Math.max(0, (ev.berat_sebelumnya ?? 0) - totalGram - sisaSerbuk)

  // pcs_good_snapshot + fotos bisa diedit
  const pcsRaw = formData.get('pcs_good_snapshot')
  const pcsGoodSnap = pcsRaw !== null && pcsRaw !== '' ? parseInt(pcsRaw as string) : null

  // Fotos: gabungan existing + new uploads
  const existingFotosRaw = formData.get('existing_fotos') as string
  const newFotosB64Raw   = formData.get('new_fotos_b64') as string
  const existingFotos: string[] = existingFotosRaw ? JSON.parse(existingFotosRaw) : []
  const newFotosB64: string[]   = newFotosB64Raw   ? JSON.parse(newFotosB64Raw)   : []
  let finalFotos = [...existingFotos]
  if (newFotosB64.length > 0) {
    const uploadedUrls = await uploadBase64Fotos(supabase, newFotosB64, `event-${eventId}`)
    finalFotos = [...existingFotos, ...uploadedUrls]
  }

  await supabase.from('produksi_event').update({
    total_gram: totalGram, sisa_serbuk: sisaSerbuk, losses, catatan, tanggal,
    fotos: finalFotos,
    ...(pcsGoodSnap !== null ? { pcs_good_snapshot: pcsGoodSnap } : {}),
  }).eq('id', eventId)

  // ── Bidirectional sync: first event ↔ base data, latest event → current ──
  const { data: allMeta } = await supabase.from('produksi_event')
    .select('id, status').eq('produksi_item_id', produksiId).is('voided_at', null)
    .order('created_at', { ascending: true })
  const firstEvId  = allMeta?.[0]?.id
  const latestEvId = allMeta?.[allMeta.length - 1]?.id
  const isFirst    = eventId === firstEvId
  const isLatest   = eventId === latestEvId

  const itemUpdate: Record<string, any> = {}

  if (isFirst) {
    // Editing first event → sync back to base data
    itemUpdate.berat_awal       = totalGram
    itemUpdate.tanggal_produksi = tanggal
    itemUpdate.tanggal          = tanggal
    itemUpdate.catatan          = catatan || null
    if (pcsGoodSnap !== null) {
      itemUpdate.pcs      = pcsGoodSnap
      itemUpdate.pcs_awal = pcsGoodSnap
      // Only update pcs_good if no reject events exist
      const hasReject = allMeta?.some((e: any) => e.status === 'Reject') ?? false
      if (!hasReject) itemUpdate.pcs_good = pcsGoodSnap
    }
  }

  // Latest event always updates current total_gram
  if (isLatest) {
    itemUpdate.total_gram = totalGram
    if (pcsGoodSnap !== null) itemUpdate.pcs_good = pcsGoodSnap
  }

  if (Object.keys(itemUpdate).length > 0) {
    await supabase.from('produksi_item').update(itemUpdate).eq('id', produksiId)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_EVENT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: { total_gram: ev.total_gram, sisa_serbuk: ev.sisa_serbuk, losses: ev.losses },
    after_data:  { total_gram: totalGram, sisa_serbuk: sisaSerbuk, losses, catatan, tanggal },
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function deleteEvent(eventId: number, produksiId: number, produksiKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  // Ambil semua event aktif, diurutkan dari terbaru
  const { data: allEvs } = await supabase.from('produksi_event')
    .select('*').eq('produksi_item_id', produksiId).is('voided_at', null)
    .order('created_at', { ascending: false })
  if (!allEvs || allEvs.length === 0) return { error: 'Tidak ada event' }

  // Hanya event TERAKHIR yang bisa dihapus (jaga integritas chain)
  if (allEvs[0].id !== eventId)
    return { error: 'Hanya event terakhir yang bisa dihapus. Edit event jika perlu mengubah data di tengah.' }

  // Jangan hapus event pertama (CREATE) — hapus item produksi jika mau
  if (allEvs.length === 1)
    return { error: 'Tidak bisa hapus event pertama. Hapus item produksi jika mau membatalkan sepenuhnya.' }

  const evToDelete = allEvs[0]

  // Khusus Reject: cek sudah lebur atau belum
  if (evToDelete.status === 'Reject') {
    const { data: item } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
    if (item?.status_reject === 'sudah_dilebur')
      return { error: 'Reject sudah dilebur, tidak bisa dihapus. Batalkan lebur terlebih dahulu.' }
    // Revert pcs & berat
    const rejectPcs  = evToDelete.pcs_reject_snapshot ?? 0
    const rejectBerat = (evToDelete.berat_sebelumnya ?? 0) - (evToDelete.total_gram ?? 0)
    await supabase.from('produksi_item').update({
      pcs_good:     (item?.pcs_good   ?? 0) + rejectPcs,
      pcs_reject:   Math.max(0, (item?.pcs_reject  ?? 0) - rejectPcs),
      berat_reject: Math.max(0, (item?.berat_reject ?? 0) - rejectBerat),
      status_reject: (item?.pcs_reject ?? 0) - rejectPcs > 0 ? item?.status_reject : null,
    }).eq('id', produksiId)
  }

  // Soft-delete event
  await supabase.from('produksi_event')
    .update({ voided_at: new Date().toISOString() }).eq('id', eventId)

  // Kembalikan total_gram + current_status ke event sebelumnya
  const prev = allEvs[1]
  await supabase.from('produksi_item').update({
    total_gram:     prev.total_gram,
    current_status: prev.status,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE_EVENT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: evToDelete,
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function inputReject(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }
  if (produksi.current_status === 'Sudah Packing')
    return { error: 'Item sudah selesai packing, tidak bisa menambah reject' }

  const { data: activePack } = await supabase.from('packing')
    .select('pcs_dipack').eq('produksi_item_id', produksiId).is('voided_at', null)
  const pcsAlreadyPacked = (activePack ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)

  const pcsReject = parseInt(formData.get('pcs_reject') as string)
  const beratReject = parseFloat(formData.get('berat_reject') as string)

  if (!pcsReject || pcsReject <= 0) return { error: 'PCS reject wajib diisi' }
  if (!beratReject || beratReject <= 0) return { error: 'Berat reject wajib diisi' }

  const pcsGoodNow    = produksi.pcs_good ?? produksi.pcs ?? 0
  const pcsAvailable  = pcsGoodNow - pcsAlreadyPacked
  if (pcsReject > pcsAvailable)
    return { error: `Reject (${pcsReject}) melebihi PCS tersedia (${pcsAvailable} = ${pcsGoodNow} good − ${pcsAlreadyPacked} sudah dipacking)` }

  const newPcsGood = pcsGoodNow - pcsReject
  const newTotalGram = Math.max(0, (produksi.total_gram ?? 0) - beratReject)

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId,
    tanggal: formData.get('tanggal') as string || new Date().toISOString().split('T')[0],
    status: 'Reject',
    total_gram: newTotalGram,
    berat_sebelumnya: produksi.total_gram ?? 0,
    sisa_serbuk: 0,
    losses: 0, // reject BUKAN losses permanen — emas akan dilebur kembali
    pcs_good_snapshot: newPcsGood,    // pcs good SETELAH reject
    pcs_reject_snapshot: pcsReject,   // berapa pcs yg di-reject di event ini
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null,
    fotos: [],
  })

  await supabase.from('produksi_item').update({
    pcs_good: newPcsGood,
    pcs: newPcsGood,
    pcs_reject: (produksi.pcs_reject ?? 0) + pcsReject,
    berat_reject: (produksi.berat_reject ?? 0) + beratReject,
    total_gram: newTotalGram,
    status_reject: 'belum_dilebur',
    current_status: produksi.current_status,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'INPUT_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { pcs_reject: pcsReject, berat_reject: beratReject, pcs_good_remaining: newPcsGood },
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function leburReject(produksiId: number, produksiKode: string, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  // Atomic RPC: prevents race condition + double-lebur in one transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc('lebur_reject_atomic', {
    p_produksi_id: produksiId,
    p_batch_kode:  batchKode,
  })
  if (rpcError) return { error: rpcError.message }
  if (rpcResult?.error) return { error: rpcResult.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'LEBUR_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { berat_kembali: rpcResult?.berat_kembali, batch_kode: batchKode },
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true, berat_kembali: rpcResult?.berat_kembali }
}

export async function batalLeburReject(produksiId: number, produksiKode: string, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('batal_lebur_reject_atomic', {
    p_produksi_id: produksiId,
    p_batch_kode:  batchKode,
  })
  if (rpcError) return { error: rpcError.message }
  if (rpcResult?.error) return { error: rpcResult.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'BATAL_LEBUR_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { berat_dikembalikan: rpcResult?.berat_dikembalikan, batch_kode: batchKode },
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function deleteProduksi(produksiId: number, produksiKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: existing } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!existing) return { error: 'Item produksi tidak ditemukan' }

  const { count: packingCount } = await supabase.from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)

  if ((packingCount ?? 0) > 0) {
    return {
      error: `Item produksi ini memiliki ${packingCount} data packing aktif. Hapus data packing terlebih dahulu.`,
      step: 'packing',
    }
  }

  await supabase.from('produksi_item').update({
    voided_at: new Date().toISOString(), void_reason: 'DELETED_BY_USER',
  }).eq('id', produksiId)

  if (existing.batch_kode) await updateBatchSisaSeharusnya(supabase, existing.batch_kode)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId), before_data: existing,
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function createPacking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const produksiItemId = parseInt(formData.get('produksi_item_id') as string)
  const pcsDispack = parseInt(formData.get('pcs_dipack') as string)
  const totalGramAktual = parseFloat(formData.get('total_gram_aktual') as string)
  const tanggal = formData.get('tanggal') as string

  if (!produksiItemId) return { error: 'Item produksi wajib dipilih' }
  if (!pcsDispack || pcsDispack <= 0) return { error: 'PCS yang dipack wajib diisi' }
  if (!totalGramAktual || totalGramAktual <= 0) return { error: 'Total gram aktual wajib diisi' }
  if (!tanggal) return { error: 'Tanggal packing wajib diisi' }

  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiItemId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const kode = await generatePackingCode(supabase)
  const selisih = (produksi.total_gram ?? 0) - totalGramAktual

  const { data: packing, error } = await supabase.from('packing').insert({
    kode, produksi_item_id: produksiItemId, batch_kode: produksi.batch_kode,
    gramasi: produksi.gramasi, pcs: pcsDispack, pcs_dipack: pcsDispack,
    total_gram: totalGramAktual, total_gram_aktual: totalGramAktual,
    selisih_gram: selisih, tanggal,
    pic: formData.get('pic') as string || profile?.name || null,
    catatan: formData.get('catatan') as string || null,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PRODUKSI',
    record_key: kode, record_id: String(packing.id), after_data: packing,
  })

  revalidatePath('/produksi')
  return { success: true, kode }
}

export async function voidPacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  await supabase.from('packing').update({
    voided_at: new Date().toISOString(), void_reason: 'VOIDED_BY_USER',
  }).eq('id', packingId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_PACKING', module: 'PRODUKSI',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function updateSisaFisikBatch(batchKode: string, sisaFisik: number | null, fotosB64: string[] = []) {
  const supabase = await createClient()

  // BUG 4 FIX: Validasi range sisa fisik
  if (sisaFisik !== null) {
    if (sisaFisik < 0) return { error: 'Sisa fisik tidak boleh negatif' }
    const { data: batchCheck } = await supabase.from('batch').select('timbangan_akhir').eq('kode', batchKode).single()
    if (batchCheck && sisaFisik > batchCheck.timbangan_akhir) {
      return { error: `Sisa fisik (${sisaFisik}gr) tidak boleh melebihi bahan masuk (${batchCheck.timbangan_akhir}gr)` }
    }
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // Upload fotos jika ada
  let fotoUrls: string[] = []
  if (fotosB64.length > 0) {
    fotoUrls = await uploadBase64Fotos(supabase, fotosB64, `sisa-fisik-${batchKode}`)
  }

  const { error } = await supabase.from('batch').update({
    sisa_fisik: sisaFisik,
    ...(fotoUrls.length > 0 ? { fotos_sisa_fisik: fotoUrls } : {}),
  }).eq('kode', batchKode)
  if (error) return { error: error.message }
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_SISA_FISIK', module: 'PRODUKSI',
    record_key: batchKode, after_data: { sisa_fisik: sisaFisik },
  })
  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function editProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const gramasi   = formData.get('gramasi') as string
  const pcs       = parseInt(formData.get('pcs') as string)
  const beratAwal = parseFloat(formData.get('berat_awal') as string)
  const operator  = formData.get('operator') as string
  const catatan   = formData.get('catatan') as string
  const tanggal   = formData.get('tanggal_produksi') as string
  const memo      = formData.get('memo') as string

  if (!gramasi) return { error: 'Gramasi wajib diisi' }
  if (!pcs || pcs <= 0) return { error: 'PCS wajib diisi' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const { data: before } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!before) return { error: 'Item produksi tidak ditemukan' }

  // Block edit jika ada packing aktif
  const { count: packingCount } = await supabase.from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  if ((packingCount ?? 0) > 0)
    return { error: `Tidak bisa edit: ada ${packingCount} packing aktif. Void packing terlebih dahulu.` }

  // Recalculate pcs_good: new pcs minus existing rejects
  const existingReject = before.pcs_reject ?? 0
  const newPcsGood = pcs - existingReject
  if (newPcsGood < 0)
    return { error: `PCS baru (${pcs}) tidak boleh kurang dari jumlah reject yang sudah ada (${existingReject})` }

  // total_gram: reset ke beratAwal HANYA jika belum ada event proses
  // (lebih dari 1 event berarti sudah ada proses setelah CREATE)
  const { count: eventCount } = await supabase.from('produksi_event')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId)
  const hasProcessEvents = (eventCount ?? 0) > 1
  const newTotalGram = hasProcessEvents ? before.total_gram : beratAwal

  const { error } = await supabase.from('produksi_item').update({
    gramasi, pcs, pcs_awal: pcs, pcs_good: newPcsGood,
    berat_awal: beratAwal, total_gram: newTotalGram,
    operator: operator || null, catatan: catatan || null,
    tanggal_produksi: tanggal, tanggal, memo: memo || null,
  }).eq('id', produksiId)

  if (error) return { error: error.message }

  // ── Bidirectional sync: update first event to match new base data ──────────
  const { data: firstEvForSync } = await supabase.from('produksi_event')
    .select('id').eq('produksi_item_id', produksiId).is('voided_at', null)
    .order('created_at', { ascending: true }).limit(1).single()
  if (firstEvForSync) {
    await supabase.from('produksi_event').update({
      total_gram:        beratAwal,
      berat_sebelumnya:  beratAwal,
      pcs_good_snapshot: newPcsGood,
      tanggal:           tanggal,
      catatan:           catatan || null,
    }).eq('id', firstEvForSync.id)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: before,
    after_data: { gramasi, pcs, pcs_good: newPcsGood, berat_awal: beratAwal, operator, tanggal },
  })

  revalidatePath('/produksi')
  return { success: true }
}
















