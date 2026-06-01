// @ts-nocheck
'use client'

import { useState } from 'react'
import { Package, ChevronDown, ChevronRight, Warehouse, Building2, Search, AlertCircle, CheckCircle } from 'lucide-react'

function Badge({ children, color }) {
  const map = {
    green:  'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    gray:   'bg-gray-100 text-gray-500',
    violet: 'bg-violet-50 text-violet-600',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[color] ?? map.gray}`}>{children}</span>
}

function STList({ tags }) {
  const [show, setShow] = useState(false)
  if (!tags || tags.length === 0) return null
  return (
    <div className="mt-2">
      <button onClick={() => setShow(!show)} className="flex items-center gap-1 text-[11px] font-semibold text-violet-500">
        {show ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {show ? 'Sembunyikan' : `Lihat ${tags.length} Shieldtag`}
      </button>
      {show && (
        <div className="mt-2 space-y-1">
          {tags.map(st => (
            <div key={st.kode} className="flex items-center justify-between px-3 py-1.5 bg-[#F9F9FB] rounded-xl">
              <span className="text-[11px] font-mono font-semibold text-gray-700">{st.kode}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">{st.tgl_regis}</span>
                <Badge color={st.status === 'Aktif' ? 'green' : st.status === 'Terdistribusi' ? 'violet' : 'gray'}>{st.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabGudang({ items }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const filtered = items.filter(item => !search || item.produk_nama.toLowerCase().includes(search.toLowerCase()))
  const totalPcs     = items.reduce((s, i) => s + i.total_pcs, 0)
  const totalAktif   = items.reduce((s, i) => s + i.st_aktif, 0)
  const totalPending = items.reduce((s, i) => s + i.st_pending, 0)

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Stok', val: totalPcs,     bg: 'bg-white',        text: 'text-gray-900'    },
          { label: 'Siap Jual',  val: totalAktif,   bg: 'bg-emerald-50',   text: 'text-emerald-700' },
          { label: 'Pending ST', val: totalPending, bg: 'bg-amber-50',     text: 'text-amber-700'   },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-3 text-center`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p className={`text-lg font-black ${c.text}`}>{c.val}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk…"
          className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none" />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Stok kosong</p>
        </div>
      )}

      {filtered.map(item => {
        const open = expanded === item.produk_nama
        return (
          <div key={item.produk_nama} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <button onClick={() => setExpanded(open ? null : item.produk_nama)} className="w-full px-4 py-3.5 flex items-center justify-between">
              <div className="text-left min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.produk_nama}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{item.gramasi} gr</span>
                  <Badge color="violet">{item.series_nama}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900">{item.total_pcs}</p>
                  <p className="text-[10px] text-gray-400 font-medium">pcs</p>
                </div>
                {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </div>
            </button>

            {open && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-black text-emerald-700">{item.st_aktif}</p>
                      <p className="text-[10px] font-semibold text-emerald-500">Siap jual/mutasi</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-black text-amber-700">{item.st_pending}</p>
                      <p className="text-[10px] font-semibold text-amber-500">Belum ada ST</p>
                    </div>
                  </div>
                </div>
                {item.st_pending > 0 && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                    ⚠️ {item.st_pending} pcs belum bisa dijual/dimutasi — daftarkan Shieldtag dulu
                  </p>
                )}
                <STList tags={item.shieldtags} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TabCabang({ cabangStok }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)

  const filtered = cabangStok.filter(c =>
    !search || c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 space-y-3 pb-20">
      <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div>
          <p className="text-xs font-semibold text-gray-400">Cabang Punya Stok</p>
          <p className="text-2xl font-black text-gray-900">{cabangStok.filter(c => c.items.length > 0).length}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-400">Total Stok Cabang</p>
          <p className="text-2xl font-black text-violet-600">
            {cabangStok.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.pcs, 0), 0)} pcs
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari cabang…"
          className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none" />
      </div>

      {filtered.map(cab => {
        const open = expanded === cab.kode
        const totalPcs = cab.items.reduce((s, i) => s + i.pcs, 0)
        return (
          <div key={cab.kode} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <button onClick={() => setExpanded(open ? null : cab.kode)} className="w-full px-4 py-3.5 flex items-center justify-between">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <Badge color="violet">{cab.kode}</Badge>
                  <p className="text-sm font-bold text-gray-900">{cab.nama}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{cab.items.length} jenis produk</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900">{totalPcs}</p>
                  <p className="text-[10px] text-gray-400">pcs</p>
                </div>
                {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </div>
            </button>

            {open && (
              <div className="border-t border-gray-50">
                {cab.items.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">Tidak ada stok</p>
                ) : cab.items.map(item => {
                  const ikey = cab.kode + item.produk_nama
                  const iopen = expandedItem === ikey
                  return (
                    <div key={ikey} className="border-b border-gray-50 last:border-0">
                      <button onClick={() => setExpandedItem(iopen ? null : ikey)} className="w-full px-4 py-3 flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-800">{item.produk_nama}</p>
                          <p className="text-xs text-gray-400">{item.gramasi} gr</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-900">{item.pcs} pcs</span>
                          {iopen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                        </div>
                      </button>
                      {iopen && <div className="px-4 pb-3"><STList tags={item.shieldtags} /></div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Tidak ada data cabang</p>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { key: 'gudang', label: namaGudang, icon: Warehouse },
  { key: 'cabang', label: 'Cabang',    icon: Building2 },
]

export default function InventoryClient({ namaGudang = 'Gudang CJ', gudangItems, cabangStok }) {
  const [tab, setTab] = useState('gudang')
  const totalGudang = gudangItems.reduce((s, i) => s + i.total_pcs, 0)
  const totalCabang = cabangStok.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.pcs, 0), 0)

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-0">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Inventory</h1>
          <div className="flex gap-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl whitespace-nowrap transition-all
                  ${tab === key ? 'bg-white text-violet-700 shadow-sm border-t border-x border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
                <Icon size={13} />
                {label}
                <span className="ml-0.5 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">
                  {key === 'gudang' ? totalGudang : totalCabang} pcs
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'gudang' && <TabGudang items={gudangItems} />}
      {tab === 'cabang' && <TabCabang cabangStok={cabangStok} />}
    </div>
  )
}

