import { redirect } from 'next/navigation'

// Digabung ke /stok-cabang sebagai tab "PO Cabang" — route lama tetap dipertahankan
// sebagai redirect agar link/bookmark lama tidak rusak.
export default function PoCabangRedirect() {
  redirect('/stok-cabang?tab=po')
}
