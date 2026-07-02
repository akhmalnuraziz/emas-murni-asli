'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import StokCabangClient from './stok-cabang-client'
import PoCabangClient from '@/components/modules/po-cabang/po-cabang-client'

interface Props {
  stokProps: React.ComponentProps<typeof StokCabangClient>
  poProps: React.ComponentProps<typeof PoCabangClient>
}

export default function StokPoCabangTabs({ stokProps, poProps }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const initialTab = sp.get('tab') === 'po' ? 'po' : 'stok'
  const [tab, setTab] = useState<'stok' | 'po'>(initialTab)

  function switchTab(t: 'stok' | 'po') {
    setTab(t)
    router.replace(t === 'po' ? '/stok-cabang?tab=po' : '/stok-cabang')
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 w-fit">
        <button onClick={() => switchTab('stok')}
          className={cn('flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold transition-all',
            tab === 'stok' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <MapPin size={14}/> Stok Cabang
        </button>
        <button onClick={() => switchTab('po')}
          className={cn('flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-semibold transition-all',
            tab === 'po' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Store size={14}/> PO Cabang
        </button>
      </div>

      {tab === 'stok' ? <StokCabangClient {...stokProps} /> : <PoCabangClient {...poProps} />}
    </div>
  )
}
