export type UserRole =
  | 'owner'
  | 'manager'
  | 'spv'
  | 'admin_produksi'
  | 'admin_gudang'
  | 'admin_accounting'

export type StatusProduksi = 'Cutting' | 'Pas Berat' | 'Annealing' | 'Siap Packing' | 'Sudah Packing' | 'Reject'
export type StatusShieldtag = 'Aktif' | 'Terdistribusi' | 'Transit' | 'Terjual' | 'VOID' | 'RETURNED'
export type StatusKirimMut = 'Belum Dikirim' | 'Sudah Dikirim' | 'Cancel'
export type StatusTerimaMut = 'Belum Diterima' | 'Sudah Diterima' | 'Cancel'
export type StatusKirimPO = 'Belum Dikirim' | 'Sedang Diproses' | 'Sudah Dikirim' | 'Cancel'
export type StatusTerimaPO = 'Belum Sampai' | 'Dalam Perjalanan' | 'Sudah Sampai' | 'Cancel'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: UserRole
  toko: string | null
  aktif: boolean
  note: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

export interface Cabang {
  id: number
  kode: string
  nama: string
  alamat: string | null
  kepala: string | null
  telp: string | null
  aktif: boolean
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

export interface Batch {
  id: number
  kode: string
  tanggal: string
  supplier: string | null
  bahan_dari_pusat: number | null
  foto_bahan_pusat: string | null
  timbangan_akhir: number | null
  foto_timbangan_akhir: string | null
  sisa_fisik: number | null
  foto_sisa_fisik: string | null
  harga_beli: number | null
  hpp_gr: number | null
  biaya_tbh: BiayaTambahan[]
  catatan: string | null
  created_at: string
  created_by: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface BiayaTambahan {
  nama: string
  jumlah: number
}

export interface ProduksiItem {
  id: number
  kode: string
  batch_kode: string | null
  gramasi: string
  pcs: number
  total_gram: number | null
  current_status: StatusProduksi | null
  catatan: string | null
  created_at: string
  created_by: string | null
  voided_at: string | null
  void_reason: string | null
  berat_serah_batch: number | null
  sesi_id: string | null
  berat_awal: number | null
  pcs_awal: number | null
  pcs_good: number | null
  pcs_reject: number | null
  terima_gram: number | null
  reject_cutting_gram: number | null
  berat_reject: number | null
  serah_gram: number | null
  nama_item: string | null
  peleburan_id: number | null
  peleburan_kode: string | null
  status_cutting: string | null
  sisa_serbuk: number | null
  operator: string | null
  admin_input: string | null
  tim_id: number | null
  tim_nama: string | null
}

export interface ProduksiEvent {
  id: number
  produksi_item_id: number
  tanggal: string
  status: StatusProduksi
  total_gram: number | null
  sisa_serbuk: number | null
  foto: string | null
  foto_sisa_serbuk: string | null
  fotos_extra: string[]
  catatan: string | null
  user_name: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

export interface Packing {
  id: number
  kode: string
  produksi_item_id: number | null
  tanggal: string
  batch_kode: string | null
  gramasi: string | null
  pcs: number
  total_gram: number | null
  pic: string | null
  foto: string | null
  catatan: string | null
  created_at: string
  created_by: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface Shieldtag {
  id: number
  kode: string
  packing_id: number | null
  batch_kode: string | null
  gramasi: string | null
  hpp: number | null
  status: StatusShieldtag
  lokasi: string | null
  tgl_regis: string | null
  tgl_dist: string | null
  tgl_jual: string | null
  harga_jual: number
  mutasi_id: number | null
  replaced_by_kode: string | null
  replaces_kode: string | null
  void_ttd_operator_url: string | null
  void_ttd_admin_url: string | null
  void_operator_nama: string | null
  void_admin_nama: string | null
  void_approved_by: string | null
  void_approved_at: string | null
  created_at: string
  voided_at: string | null
  void_reason: string | null
}

export interface Mutasi {
  id: number
  kode: string
  nomor: string | null
  tanggal: string
  cabang_tujuan: string | null
  cabang_asal: string | null
  dari_lokasi: string | null
  dari_kode: string | null
  ke_lokasi: string | null
  ke_kode: string | null
  shieldtag_kodes: string[] | null
  shieldtag_kodes_diterima: string[] | null
  shieldtag_kodes_hilang: string[] | null
  alasan_hilang: string | null
  pcs: number | null
  pcs_dikirim: number | null
  pcs_diterima: number | null
  total_gram: number | null
  pic: string | null
  foto: string | null
  foto_kirim: string[] | null
  foto_terima: string[] | null
  catatan: string | null
  status: string | null
  status_kirim: StatusKirimMut
  tanggal_kirim: string | null
  status_terima: StatusTerimaMut
  tanggal_terima: string | null
  keterangan_tambahan: string | null
  pengirim_name: string | null
  pengirim_by: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  acc_by: string | null
  acc_name: string | null
  acc_at: string | null
  acc_catatan: string | null
  created_at: string
  created_by: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface StokToko {
  id: number
  tanggal: string
  toko: string | null
  gramasi: string
  pcs: number
  sumber: string
  catatan: string | null
  created_at: string
  created_by: string | null
}

export interface POToko {
  id: number
  tanggal: string
  toko: string | null
  gramasi: string | null
  pcspo: number
  kirim: number | null
  customer: string | null
  status_g: StatusKirimPO
  status_t: StatusTerimaPO
  keterangan_tambahan: string | null
  catatan: string | null
  created_at: string
  created_by: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface AuditLog {
  id: number
  timestamp: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  action: string
  module: string
  record_key: string | null
  record_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  reason: string | null
}

export interface Penjualan {
  id: number
  no_faktur: string | null
  tanggal: string
  tipe: string
  status: string
  tgl_selesai: string | null
  source: string
  toko: string | null
  marketplace_akun: string | null
  nama_customer: string
  ktp_customer: string | null
  hp_customer: string
  shieldtag_kodes: string[]
  gramasi: string
  pcs: number
  harga_jual: number
  fee_marketplace: number
  ongkir: number
  hpp_total: number
  profit: number
  no_invoice_mktpl: string | null
  catatan: string | null
  created_by: string | null
  created_at: string
}

export interface BarangMasuk {
  id: number
  tanggal: string
  gramasi: string
  pcs: number
  tipe: string
  sumber: string | null
  kondisi: string
  pic: string
  foto: string | null
  catatan: string | null
  created_by: string | null
  created_at: string
  batch_kode: string | null
}

// Role permissions helper
export const ROLE_LABELS: Record<UserRole, string> = {
  owner:             'Owner',
  manager:           'Manager',
  spv:               'SPV',
  admin_produksi:    'Admin Produksi',
  admin_gudang:      'Admin Gudang & Distribusi',
  admin_accounting:  'Admin Accounting',
}

const ALL = ['dashboard', 'bahan-baku', 'produksi', 'packing-log', 'shieldtag', 'kpi-tim', 'scrap',
  'inventory', 'mutasi', 'stock-opname', 'stok-cabang', 'po-cabang', 'po-vendor-packaging', 'prioritas-produksi',
  'penjualan', 'retur-penjualan', 'pelanggan', 'buyback', 'pengeluaran', 'laporan',
  'laporan-batch', 'laporan-efisiensi',
  'pengaturan', 'audit-log', 'backup']

export const ROLE_ACCESS: Record<UserRole, string[]> = {
  owner:            ['*'],
  manager:          ALL,
  spv:              ALL,
  admin_produksi:   ['dashboard', 'bahan-baku', 'produksi', 'packing-log', 'shieldtag', 'kpi-tim', 'scrap'],
  admin_gudang:     ['dashboard', 'inventory', 'mutasi', 'stock-opname', 'stok-cabang', 'po-cabang', 'po-vendor-packaging', 'prioritas-produksi'],
  admin_accounting: ['dashboard', 'penjualan', 'retur-penjualan', 'pelanggan', 'buyback', 'pengeluaran', 'laporan'],
}

export const GRAMASI_OPTIONS = [
  '0.1', '0.5', '1', '2', '5', '10', '20', '25', '50', '100', '250', '500', '1000'
]

export const STATUS_PRODUKSI_COLOR: Record<StatusProduksi, string> = {
  'Cutting': 'blue',
  'Pas Berat': 'orange',
  'Annealing': 'amber',
  'Siap Packing': 'green',
  'Sudah Packing': 'purple',
  'Reject': 'red',
}
