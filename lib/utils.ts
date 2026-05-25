import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatGram(gram: number | null | undefined): string {
  if (gram === null || gram === undefined) return '0 gr'
  return `${Number(gram).toFixed(2)} gr`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateBatchCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 9000) + 1000)
  return `BCH/${year}/${month}${random}`
}

export const STATUS_BADGE_STYLES = {
  'Pas Berat': 'bg-blue-50 text-blue-700 border-blue-200',
  'Annealing': 'bg-amber-50 text-amber-700 border-amber-200',
  'Siap Packing': 'bg-green-50 text-green-700 border-green-200',
  'Sudah Packing': 'bg-purple-50 text-purple-700 border-purple-200',
  'Reject': 'bg-red-50 text-red-700 border-red-200',
  'Aktif': 'bg-green-50 text-green-700 border-green-200',
  'Terdistribusi': 'bg-blue-50 text-blue-700 border-blue-200',
  'Terjual': 'bg-purple-50 text-purple-700 border-purple-200',
  'VOID': 'bg-gray-50 text-gray-500 border-gray-200',
  'Belum Dikirim': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Sudah Dikirim': 'bg-blue-50 text-blue-700 border-blue-200',
  'Cancel': 'bg-red-50 text-red-600 border-red-200',
  'Belum Diterima': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Sudah Diterima': 'bg-green-50 text-green-700 border-green-200',
} as const
