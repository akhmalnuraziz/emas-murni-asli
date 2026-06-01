// @ts-nocheck
'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Check, AlertTriangle, ShoppingBag, Printer, ChevronDown, ChevronRight, Tag, User, CreditCard, ArrowRight } from 'lucide-react'
import { getShieldtagByKode, searchCustomer, createCustomer, createPenjualan, getPenjualanDetail } from '@/app/(dashboard)/penjualan/actions'

const INP = "w-full h-11 px-3.5 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all"
const CHANNELS = [
  { value:'toko',      label:'Toko Fisik',  icon:'🏪' },
  { value:'shopee',    label:'Shopee',       icon:'🛒' },
  { value:'tiktok',    label:'TikTok Shop',  icon:'📱' },
  { value:'raja_emas', label:'Raja Emas App',icon:'👑' },
  { value:'lainnya',   label:'Lainnya',      icon:'📦' },
]
const METHODS = ['cash','transfer','qris','shopee_pay','gopay','ovo','dana','lainnya']
const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

function FL({ label, req, children }: any) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{req && <span className="text-violet-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

function Toast({ msg }: { msg: any }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg ${msg.ok ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}>
        {msg.ok ? <Check size={14}/> : <AlertTriangle size={14}/>} {msg.text}
      </div>
    </div>
  )
}

// ── Invoice Print View ──────────────────────────────────────────────────────────
function InvoicePrint({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null
  const { penjualan: p, items, payments } = data
  const customer = p.customer ?? { nama: p.nama_customer, no_hp: p.hp_customer, ktp: p.ktp_customer }
  const channelLabel = CHANNELS.find(c => c.value === (p.channel || p.source))?.label ?? p.channel ?? p.source

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <p className="text-sm font-bold text-gray-900">Invoice</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-violet-600 text-white flex items-center gap-1.5">
              <Printer size={12}/>Cetak
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
              <X size={14} className="text-gray-500"/>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Header invoice */}
          <div className="text-center border-b pb-3">
            <p className="text-base font-black text-gray-900">PT EMAS MURNI ASLI</p>
            <p className="text-xs text-gray-500 mt-0.5">Production System</p>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              ['No. Invoice', p.nomor_invoice || p.no_faktur],
              ['Tanggal',     p.tanggal],
              ['Channel',     channelLabel],
              ['Status',      'LUNAS'],
            ].map(([k,v]) => (
              <div key={k}>
                <p className="text-gray-400">{k}</p>
                <p className="font-semibold text-gray-800">{v}</p>
              </div>
            ))}
          </div>

          {/* Customer */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs space-y-0.5">
            <p className="font-bold text-gray-700">Data Customer:</p>
            <p className="text-gray-600">Nama: <span className="font-semibold">{customer.nama}</span></p>
            {customer.no_hp && <p className="text-gray-600">HP: {customer.no_hp}</p>}
            {customer.ktp && <p className="text-gray-600">KTP: {customer.ktp}</p>}
          </div>

          {/* Items */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Detail Produk</p>
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-50 px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase">
                <span className="col-span-2">Produk</span><span>Kode ST</span><span className="text-right">Harga</span>
              </div>
              {items.map((item: any, i: number) => (
                <div key={i} className="grid grid-cols-4 px-3 py-2 border-t text-xs items-center">
                  <div className="col-span-2">
                    <p className="font-semibold text-gray-800">{item.produk_nama}</p>
                    <p className="text-gray-400">{item.gramasi} gr</p>
                  </div>
                  <p className="font-mono text-gray-600 text-[10px]">{item.shieldtag_kode}</p>
                  <p className="text-right font-bold text-gray-800">{fmt(item.harga_jual)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Payment */}
          <div className="space-y-1 pt-1 border-t">
            <div className="flex justify-between text-sm font-black text-gray-900">
              <span>TOTAL</span><span>{fmt(items.reduce((s: number, i: any) => s + i.harga_jual, 0))}</span>
            </div>
            {payments.map((pay: any, i: number) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span className="capitalize">{pay.metode.replace('_',' ')}</span>
                <span>{fmt(pay.jumlah)}</span>
              </div>
            ))}
          </div>

          {/* TTD */}
          <div className="grid grid-cols-2 gap-6 pt-4">
            {['Penjual','Pembeli'].map(role => (
              <div key={role} className="text-center">
                <p className="text-xs font-semibold text-gray-400 mb-10">{role}</p>
                <div className="border-t border-gray-200 pt-1">
                  <p className="text-[10px] text-gray-300">( __________________ )</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Form Buat Penjualan ─────────────────────────────────────────────────────────
function BuatPenjualanModal({ onClose, showToast }: { onClose: () => void; showToast: (m: string, ok?: boolean) => void }) {
  const router = useRouter()
  const [step, setStep]           = useState<'channel'|'items'|'customer'|'payment'>('channel')
  const [channel, setChannel]     = useState('')
  const [mktplFee, setMktplFee]   = useState('')
  const [items, setItems]         = useState<any[]>([])
  const [customer, setCustomer]   = useState<any>(null)
  const [payments, setPayments]   = useState([{ metode: 'cash', jumlah: '' }])
  const [catatan, setCatatan]     = useState('')
  const [pend, start]             = useTransition()
  const [err, setErr]             = useState('')

  // ST scanner
  const [stInput, setStInput]  = useState('')
  const [stLoading, setStLoading] = useState(false)
  const stRef = useRef<HTMLInputElement>(null)

  // Customer search
  const [custSearch, setCustSearch]   = useState('')
  const [custResults, setCustResults] = useState<any[]>([])
  const [showNewCust, setShowNewCust] = useState(false)
  const [newCust, setNewCust]         = useState({ nama:'', no_hp:'', ktp:'', alamat:'', email:'' })

  const totalHJ  = items.reduce((s, i) => s + (parseFloat(i.harga_jual) || 0), 0)
  const totalHPP = items.reduce((s, i) => s + (parseFloat(i.hpp) || 0), 0)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.jumlah) || 0), 0)
  const sisaBayar = totalHJ - totalPaid

  async function scanST() {
    if (!stInput.trim()) return
    setStLoading(true); setErr('')
    if (items.find(i => i.shieldtag_kode === stInput.trim().toUpperCase())) {
      setErr('ST sudah ada di daftar'); setStLoading(false); return
    }
    const r = await getShieldtagByKode(stInput.trim())
    setStLoading(false)
    if (r.error) { setErr(r.error); return }
    setItems(prev => [...prev, { ...r.data, harga_jual: '' }])
    setStInput(''); stRef.current?.focus()
  }

  async function searchCust(q: string) {
    setCustSearch(q)
    if (q.length < 2) { setCustResults([]); return }
    const results = await searchCustomer(q)
    setCustResults(results)
  }

  async function saveNewCust() {
    const fd = new FormData()
    Object.entries(newCust).forEach(([k,v]) => fd.set(k,v))
    const r = await createCustomer(fd)
    if (r.error) { setErr(r.error); return }
    setCustomer(r.data); setShowNewCust(false)
  }

  async function submit() {
    setErr('')
    if (!customer) { setErr('Pilih customer dulu'); return }
    if (items.some(i => !i.harga_jual)) { setErr('Isi harga jual semua item'); return }
    if (Math.abs(totalPaid - totalHJ) > 1) { setErr(`Kurang bayar ${fmt(sisaBayar)}`); return }

    const fd = new FormData()
    fd.set('customer_id', String(customer.id))
    fd.set('channel', channel)
    fd.set('marketplace_fee', mktplFee || '0')
    fd.set('catatan', catatan)
    fd.set('items', JSON.stringify(items.map(i => ({
      shieldtag_kode: i.shieldtag_kode || i.kode,
      produk_nama: i.produk_nama,
      gramasi: i.gramasi,
      hpp: i.hpp,
      harga_jual: parseFloat(i.harga_jual),
    }))))
    fd.set('payments', JSON.stringify(payments.filter(p => parseFloat(p.jumlah) > 0)))

    start(async () => {
      const r = await createPenjualan(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`Invoice ${r.nomor} berhasil dibuat ✓`)
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[93vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Buat Penjualan</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {['channel','items','customer','payment'].map((s,i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${step === s ? 'bg-violet-500' : items.length > 0 && i < ['channel','items','customer','payment'].indexOf(step) ? 'bg-emerald-400' : 'bg-gray-200'}`}/>
                  {i < 3 && <div className="w-3 h-px bg-gray-200"/>}
                </div>
              ))}
              <span className="text-[10px] text-gray-400 ml-1 capitalize">{step}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={15} className="text-gray-500"/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {err && <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-xl text-xs text-red-600"><AlertTriangle size={13}/>{err}</div>}

          {/* STEP 1: Channel */}
          {step === 'channel' && (
            <>
              <FL label="Channel Penjualan" req>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map(c => (
                    <button key={c.value} onClick={() => setChannel(c.value)}
                      className={`h-12 rounded-2xl flex items-center gap-2 px-3 border-2 transition-all ${channel===c.value ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-white'}`}>
                      <span>{c.icon}</span>
                      <span className={`text-sm font-semibold ${channel===c.value ? 'text-violet-700' : 'text-gray-700'}`}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </FL>
              {['shopee','tiktok','raja_emas','lainnya'].includes(channel) && (
                <FL label="Fee Marketplace (%)">
                  <input value={mktplFee} onChange={e => setMktplFee(e.target.value)}
                    type="number" step="0.1" className={INP} placeholder="cth: 2.5"/>
                </FL>
              )}
              <button onClick={() => { if (!channel) { setErr('Pilih channel dulu'); return } setErr(''); setStep('items') }}
                className="w-full h-12 rounded-2xl text-sm font-bold text-white"
                style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                Lanjut →
              </button>
            </>
          )}

          {/* STEP 2: Items (scan ST) */}
          {step === 'items' && (
            <>
              <div className="flex gap-2">
                <input ref={stRef} value={stInput} onChange={e => setStInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && scanST()}
                  className={INP} placeholder="Scan / ketik kode Shieldtag…" autoFocus/>
                <button onClick={scanST} disabled={stLoading || !stInput}
                  className="h-11 px-4 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                  {stLoading ? '…' : '+ Add'}
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{item.produk_nama}</p>
                          <p className="text-[10px] text-gray-400">{item.gramasi} gr · {item.shieldtag_kode || item.kode}</p>
                          <p className="text-[10px] text-gray-400">HPP: {fmt(item.hpp)}</p>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_,j) => j !== i))}
                          className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                          <X size={12} className="text-red-400"/>
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">Rp</span>
                        <input type="number" value={item.harga_jual}
                          onChange={e => setItems(prev => prev.map((it,j) => j===i ? {...it, harga_jual: e.target.value} : it))}
                          className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm font-semibold focus:outline-none"
                          placeholder="Harga jual…"/>
                      </div>
                      {item.harga_jual && (
                        <p className={`text-[10px] font-semibold ${parseFloat(item.harga_jual) >= item.hpp ? 'text-emerald-500' : 'text-red-400'}`}>
                          Profit: {fmt(parseFloat(item.harga_jual) - item.hpp)}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="bg-violet-50 rounded-xl px-3 py-2 flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">{items.length} item · Total:</span>
                    <span className="font-black text-violet-700">{fmt(totalHJ)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('channel')} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">← Kembali</button>
                <button onClick={() => { if (!items.length) { setErr('Tambah item dulu'); return } if (items.some(i=>!i.harga_jual)){setErr('Isi harga jual semua item');return} setErr(''); setStep('customer') }}
                  className="flex-[2] h-11 rounded-xl text-sm font-bold text-white"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                  Lanjut → Customer
                </button>
              </div>
            </>
          )}

          {/* STEP 3: Customer */}
          {step === 'customer' && (
            <>
              {customer ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-white"/>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-700">{customer.nama}</p>
                    {customer.no_hp && <p className="text-xs text-emerald-600">{customer.no_hp}</p>}
                  </div>
                  <button onClick={() => setCustomer(null)} className="text-emerald-400"><X size={14}/></button>
                </div>
              ) : (
                <>
                  <FL label="Cari Customer">
                    <input value={custSearch} onChange={e => searchCust(e.target.value)}
                      className={INP} placeholder="Nama atau nomor HP…"/>
                  </FL>
                  {custResults.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {custResults.map(c => (
                        <button key={c.id} onClick={() => { setCustomer(c); setCustSearch(''); setCustResults([]) }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-left hover:border-violet-300">
                          <div className="w-7 h-7 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User size={12} className="text-violet-500"/>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{c.nama}</p>
                            {c.no_hp && <p className="text-xs text-gray-400">{c.no_hp}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowNewCust(!showNewCust)}
                    className="w-full h-11 rounded-2xl border-2 border-dashed border-violet-300 flex items-center justify-center gap-2 text-sm font-semibold text-violet-500">
                    <Plus size={14}/> Customer Baru
                  </button>
                  {showNewCust && (
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm font-bold text-gray-800">Data Customer Baru</p>
                      {[['nama','Nama*'],['no_hp','No HP*'],['ktp','No KTP'],['alamat','Alamat'],['email','Email']].map(([k,l]) => (
                        <div key={k}>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{l}</p>
                          <input value={(newCust as any)[k]} onChange={e => setNewCust(p => ({...p,[k]:e.target.value}))}
                            className={INP} placeholder={l.replace('*','')} />
                        </div>
                      ))}
                      <button onClick={saveNewCust}
                        className="w-full h-10 rounded-xl text-sm font-bold text-white"
                        style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                        Simpan Customer
                      </button>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => setStep('items')} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">← Kembali</button>
                <button onClick={() => { if (!customer) { setErr('Pilih customer dulu'); return } setErr(''); setStep('payment') }}
                  disabled={!customer}
                  className="flex-[2] h-11 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                  Lanjut → Payment
                </button>
              </div>
            </>
          )}

          {/* STEP 4: Payment */}
          {step === 'payment' && (
            <>
              <div className="bg-violet-50 rounded-xl px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total tagihan</span>
                  <span className="font-black text-violet-700">{fmt(totalHJ)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">Terbayar</span>
                  <span className={`font-bold ${totalPaid >= totalHJ ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(totalPaid)}</span>
                </div>
                {sisaBayar > 0 && <p className="text-xs text-red-500 font-bold mt-1">Kurang: {fmt(sisaBayar)}</p>}
                {sisaBayar < 0 && <p className="text-xs text-amber-600 font-bold mt-1">Kembalian: {fmt(-sisaBayar)}</p>}
              </div>

              <div className="space-y-3">
                {payments.map((pay, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={pay.metode}
                      onChange={e => setPayments(prev => prev.map((p,j) => j===i ? {...p, metode:e.target.value} : p))}
                      className="h-11 px-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none flex-shrink-0 w-32">
                      {METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                      <input type="number" value={pay.jumlah}
                        onChange={e => setPayments(prev => prev.map((p,j) => j===i ? {...p, jumlah:e.target.value} : p))}
                        className="w-full h-11 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none"
                        placeholder="Nominal…"/>
                    </div>
                    {payments.length > 1 && (
                      <button onClick={() => setPayments(prev => prev.filter((_,j) => j!==i))}
                        className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <X size={12} className="text-red-400"/>
                      </button>
                    )}
                  </div>
                ))}
                {payments.length < 3 && (
                  <button onClick={() => setPayments(prev => [...prev, { metode:'transfer', jumlah:'' }])}
                    className="text-xs font-semibold text-violet-500 flex items-center gap-1">
                    <Plus size={11}/> Tambah metode pembayaran
                  </button>
                )}
              </div>

              <FL label="Catatan">
                <input value={catatan} onChange={e => setCatatan(e.target.value)}
                  className={INP} placeholder="Opsional…"/>
              </FL>

              <div className="flex gap-2">
                <button onClick={() => setStep('customer')} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">← Kembali</button>
                <button onClick={submit} disabled={pend || sisaBayar > 1}
                  className="flex-[2] h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                  {pend && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                  {pend ? 'Menyimpan…' : '✓ Selesaikan Penjualan'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────────
export default function PenjualanClient({ penjualanList, userRole }: { penjualanList: any[]; userRole: string }) {
  const [showBuat, setShowBuat]     = useState(false)
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [toast, setToast]           = useState<any>(null)
  const [search, setSearch]         = useState('')

  const canSell = ['owner','admin_pusat','spv','operator_produksi','kepala_cabang'].includes(userRole)

  function showToast(text: string, ok = true) { setToast({ text, ok }); setTimeout(() => setToast(null), 4000) }

  async function showInvoice(id: number) {
    const r = await getPenjualanDetail(id)
    setInvoiceData(r)
  }

  const filtered = penjualanList.filter(p =>
    !search || (p.nomor_invoice || p.no_faktur || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.customer?.nama || p.nama_customer || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Toast msg={toast}/>

      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Penjualan</h1>
              <p className="text-xs text-gray-400">{penjualanList.length} transaksi</p>
            </div>
            {canSell && (
              <button onClick={() => setShowBuat(true)}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                <Plus size={14}/>Jual
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari invoice, customer…"
              className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none"/>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-20">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag size={32} className="mx-auto mb-2 opacity-20"/>
            <p className="text-sm">Belum ada transaksi penjualan</p>
          </div>
        )}
        {filtered.map(p => {
          const nomor    = p.nomor_invoice || p.no_faktur
          const custNama = p.customer?.nama || p.nama_customer
          const total    = p.total_harga_jual || p.harga_jual || 0
          const profit   = p.total_profit || p.profit || 0
          const ch       = CHANNELS.find(c => c.value === (p.channel || p.source))
          return (
            <div key={p.id} className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-violet-600">{nomor}</p>
                    {ch && <span className="text-[10px]">{ch.icon}</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{custNama}</p>
                  <p className="text-[10px] text-gray-400">{p.tanggal} · {p.pcs} pcs</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-gray-900">{fmt(total)}</p>
                  <p className={`text-[10px] font-semibold ${profit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    Profit {fmt(profit)}
                  </p>
                </div>
              </div>
              <button onClick={() => showInvoice(p.id)}
                className="mt-2.5 w-full h-8 rounded-xl bg-gray-50 text-xs font-semibold text-gray-600 flex items-center justify-center gap-1.5">
                <Printer size={11}/>Lihat & Cetak Invoice
              </button>
            </div>
          )
        })}
      </div>

      {showBuat && <BuatPenjualanModal onClose={() => setShowBuat(false)} showToast={showToast}/>}
      {invoiceData && <InvoicePrint data={invoiceData} onClose={() => setInvoiceData(null)}/>}
    </div>
  )
}
