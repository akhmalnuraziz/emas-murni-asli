# Standar UI/UX, Alur & Bahasa — PT Emas Murni Asli

> Acuan WAJIB untuk semua kode frontend. Aturan utama: **pakai ulang token & komponen yang sudah ada — jangan bikin warna/ukuran/komponen baru tanpa alasan.** Kalau sebuah pola sudah ada di sini, ikuti persis.

Karakter app: **ERP utilitarian** untuk input data harian operator. Prioritas: **rapi, konsisten, padat-informasi, cepat dipakai.** Bukan desain nyentrik/maximalist.

---

## 1. Fondasi (token di `app/globals.css`)

**Font:** Inter (`--font-sans`). Jangan ganti font.

**Warna brand:**
- Primary: `violet-600` = `#6450D6` (tombol utama, fokus, link aktif)
- Accent: `gold-*` (signature emas — highlight/badge khusus)
- Netral: `slate-*` (sudah di-override jadi warm neutral — teks, border, background)
- Semantik: `green`=sukses, `amber`=warning, `red`=error/destructive, `blue`=info

**Type scale** (jangan pakai ukuran teks di luar daftar ini):

| Nama | px | Pakai untuk |
|---|---|---|
| caption2 | 10px | tag uppercase, label super kecil |
| caption1 | 11px | metadata, label form, hint |
| footnote | 12px | label, badge, teks sekunder |
| subhead | 13px | body tabel, input, deskripsi pendek |
| callout | 14px | nilai card, highlight |
| body | 15px | konten utama |
| headline | 16px | judul section |
| title3/2/1 | 18/20/24px | heading halaman |

**Radius:** `rounded-lg` (input/badge), `rounded-xl` (card/modal/tombol besar). **Shadow:** `shadow-sm` default, `hover:shadow-md`. **Transisi:** `transition-all duration-150`.

**Angka/uang:** selalu `tabular-nums`.

---

## 2. Komponen — PAKAI INI, jangan tulis class mentah

Import dari `@/components/ui/*`. Jangan bikin `<button>`/`<input>` mentah kalau primitive-nya sudah ada.

**Button** (`ui/button.tsx`) — `<Button variant size icon loading>`
- variant: `primary` | `secondary` | `outline` | `ghost` | `destructive`
- size: `sm`(h-7) | `md`(h-8) | `lg`(h-9)

**Input / Select / Textarea** (`ui/input.tsx`) — props `label`, `error`, `hint`, `icon`. Sudah punya label + pesan error + focus ring konsisten.

**Card** (`ui/card.tsx`) — `Card`, `CardHeader`, `CardTitle`, `CardSection`.

**Typography** (`ui/typography.tsx`) — `Title1`…`Title3`, `Headline`, `Body`, `Subhead`, `Footnote`, `Caption`, `Caption2`.

**Badge** (`ui/badge.tsx`) — `<Badge variant dot>` (default/success/warning/error/info/violet/gold) + `<StatusBadge status>` (mapping status produksi sudah ada di sini — tambah status baru di `STATUS_MAP`).

> Belum jadi primitive bersama (tambah ke `ui/` saat butuh, jangan spekulatif): **Tooltip, Table, Panel, Spacer.** Sekarang masih ad-hoc di kode fitur.

---

## 3. Pola wajib (konvensi alur)

1. **Loss > toleransi** (toleransi = **0,05 gr** semua proses) → wajib **alasan + TTD operator + TTD admin**. Pakai komponen `LossApprovalPanel` + indikator loss realtime (hijau dalam toleransi / merah melebihi). Backend simpan via `saveLossApproval`. JANGAN bikin form proses tanpa cek ini.
2. Semua tahap **"Diterima"** wajib: **Tanggal + Jam + Admin Penerima**.
3. Form yang butuh identitas tim wajib punya pilihan **Tim Yang Mengerjakan**.
4. **Upload foto** wajib: preview thumbnail + klik perbesar + tombol ✕ hapus. Maks sesuai konteks (umumnya 10).
5. **Modal**: header (judul + subjudul kode) + tombol ✕, body `overflow-y-auto max-h`, footer `Batal` (kiri, secondary) + aksi utama (kanan, primary) dengan state `Menyimpan…`.
6. **Responsive**: mobile-first. Grid form `grid-cols-1 sm:grid-cols-2`. Sidebar collapse di mobile.
7. **Aksesibilitas**: `focus-visible` ring (sudah global), label `htmlFor`, kontras cukup.

---

## 4. Bahasa (Indonesia, konsisten)

Istilah baku — pakai persis: **Serahkan / Diserahkan**, **Diterima**, **Reject**, **Loss**, **Gramasi**, **Batch**, **Tim Yang Mengerjakan**, **Admin Yang Menyerahkan / Menerima**, **Berat ACC**, **Sisa Serbuk**, **Tahap** (Cutting → Pas Berat → Annealing → Siap Packing). Tombol pakai kata kerja (`Simpan`, `Batal`, `Tambah`, `Hapus`).

---

## 5. Golden rules

- Pakai ulang token & komponen sebelum bikin baru.
- Konsisten > kreatif. Operator pakai tiap hari — jangan kagetin dengan layout/warna baru.
- Diff sependek mungkin; satu pola, satu tempat.
