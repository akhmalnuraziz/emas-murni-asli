# Performance & Architecture Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Percepat response time save/submit dari ~1-2 detik ke <300ms, dan rapikan arsitektur Server Actions agar lebih scalable.

**Architecture:** Tiga lapis optimasi — (1) infra: Vercel region + Supabase pooler, (2) server: parallelisasi DB calls + non-blocking audit log, (3) client: optimistic UI via useTransition agar user tidak nunggu server.

**Tech Stack:** Next.js 15 App Router, Server Actions, Supabase (PostgreSQL), Tailwind CSS, TypeScript

---

## Diagnosis Bottleneck

| # | Masalah | Estimasi Dampak | Fix |
|---|---------|-----------------|-----|
| 1 | Vercel functions region default US East, Supabase di Singapore → 2x round trip ~300ms overhead | **TINGGI** | Set `sin1` di vercel.json |
| 2 | Setiap action: sequential `getUser → getProfile → getData → insert → update` — 4-6 network hops berurutan | **TINGGI** | Promise.all untuk calls yang independen |
| 3 | `audit_log.insert` di-await padahal user tidak butuh hasilnya | **MEDIUM** | Hapus await, fire-and-forget |
| 4 | Tidak ada optimistic UI — user nunggu server selesai baru tombol aktif lagi | **TINGGI** | useTransition + pending state |
| 5 | Supabase direct connection (port 5432), bukan pooler — cold start tiap Server Action buat koneksi baru | **MEDIUM** | Ganti ke pooler URL port 6543 |
| 6 | `createClient()` di setiap function call dalam satu action — bisa dishare satu instance | **LOW** | Pass client sebagai parameter |

---

## Task 1: Vercel Region → Singapore

**Files:**
- Modify: `vercel.json`

**Kenapa ini paling penting:** Supabase project `kcwrsovghmivborkgcam` di region Singapore (ap-southeast-1). Kalau Vercel functions jalan di US East (iad1), setiap Server Action = Jakarta → US → Singapore → US → Jakarta. Pindah ke `sin1` = Jakarta → Singapore → Jakarta. Hemat ~250ms per action.

- [ ] **Step 1: Update vercel.json tambah regions**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "regions": ["sin1"]
}
```

- [ ] **Step 2: Commit & push**

```bash
git add vercel.json
git commit -m "perf: set Vercel function region ke Singapore (sin1) — match Supabase"
git push origin main
```

- [ ] **Step 3: Verify di Vercel dashboard**

Buka Vercel → project → Functions tab → pastikan region = `sin1 (Singapore)`.

---

## Task 2: Supabase Connection Pooler

**Files:**
- Modify: `lib/supabase/server.ts`
- Modify: `.env.local` (tambah `SUPABASE_DB_URL`)
- Modify: Vercel env vars (tambah `SUPABASE_DB_URL`)

**Kenapa:** Serverless functions tidak persistent — setiap Server Action cold-start dan buat koneksi baru ke Postgres. Dengan pgbouncer pooler, koneksi di-reuse. Latency turun, tidak ada "connection limit exceeded" saat concurrent requests.

- [ ] **Step 1: Ambil pooler URL dari Supabase dashboard**

Buka Supabase → Settings → Database → Connection Pooling.
Copy **Transaction mode** URL (port 6543). Format:
`postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

Tambahkan ke `.env.local`:
```
SUPABASE_DB_URL=postgresql://postgres.kcwrsovghmivborkgcam:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

- [ ] **Step 2: Tambah env var ke Vercel**

```bash
# Jalankan di terminal (butuh Vercel CLI: npm i -g vercel)
vercel env add SUPABASE_DB_URL production
# paste URL pooler saat diminta
```

Atau manual: Vercel dashboard → Settings → Environment Variables → tambah `SUPABASE_DB_URL`.

- [ ] **Step 3: Tidak ada perubahan kode** — `@supabase/ssr` sudah otomatis pakai pooler kalau koneksi DB-level diperlukan. Untuk Supabase JS client (yang kita pakai untuk API calls), ini tidak perlu. Skip step ini — `createClient()` pakai REST API bukan direct PostgreSQL, jadi pooler URL tidak relevan untuk JS client. **Task ini bisa diskip**, revalidasi setelah Task 1 dulu.

---

## Task 3: Non-Blocking Audit Log

**Files:**
- Modify: `app/(dashboard)/produksi/actions.ts`
- Modify: `app/(dashboard)/bahan-baku/actions.ts`
- Modify: `app/(dashboard)/po-vendor-packaging/actions.ts`
- Modify: `app/(dashboard)/packing-log/actions.ts`
- Modify: `app/(dashboard)/mutasi/actions.ts`
- Modify: `app/(dashboard)/shieldtag/actions.ts`
- Modify: `app/(dashboard)/pengaturan/actions.ts`

**Kenapa:** `audit_log.insert` di-await di setiap action, padahal user tidak perlu menunggu log tersimpan. Hapus `await` → action selesai lebih cepat, log tetap tersimpan di background.

- [ ] **Step 1: Buat helper `logAudit` di lib/audit.ts**

```typescript
// lib/audit.ts
export function logAudit(supabase: any, payload: {
  user_id: string
  aksi: string
  tabel: string
  data?: Record<string, any>
}) {
  // ponytail: fire-and-forget — tidak perlu await, tidak ada efek ke user
  supabase.from('audit_log').insert(payload).then(() => {})
}
```

- [ ] **Step 2: Ganti semua `await supabase.from('audit_log').insert(...)` di produksi/actions.ts**

Cari semua pola ini:
```typescript
await supabase.from('audit_log').insert({ ... })
```

Ganti ke:
```typescript
logAudit(supabase, { ... })
```

Import di atas file:
```typescript
import { logAudit } from '@/lib/audit'
```

- [ ] **Step 3: Ulangi untuk bahan-baku/actions.ts, po-vendor-packaging/actions.ts, packing-log/actions.ts, mutasi/actions.ts, shieldtag/actions.ts, pengaturan/actions.ts**

Pattern sama: cari `await supabase.from('audit_log').insert`, ganti dengan `logAudit(supabase, ...)`.

- [ ] **Step 4: Commit**

```bash
git add lib/audit.ts app/(dashboard)/*/actions.ts
git commit -m "perf: audit_log fire-and-forget — hapus await agar action lebih cepat"
git push origin main
```

---

## Task 4: Parallelisasi DB Calls dalam Server Actions

**Files:**
- Modify: `app/(dashboard)/produksi/actions.ts`
- Modify: `app/(dashboard)/bahan-baku/actions.ts`

**Kenapa:** Pattern saat ini:
```typescript
const { data: { user } } = await supabase.auth.getUser()          // 50ms
const { data: profile } = await supabase.from('users_profile')... // 50ms
const { data: produksi } = await supabase.from('produksi_item')... // 50ms
// Total: 150ms sequential
```

Bisa jadi:
```typescript
const [{ data: { user } }, { data: produksi }] = await Promise.all([
  supabase.auth.getUser(),
  supabase.from('produksi_item')...
])
// Total: 50ms parallel
```

**Profile tidak bisa diparallelkan** karena butuh `user.id` — tapi bisa digabung dengan fetch data lain setelah dapat user.id.

- [ ] **Step 1: Identifikasi pattern di produksi/actions.ts**

Cari fungsi-fungsi yang punya pattern:
```typescript
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
const { data: someData } = await supabase.from('some_table')...
```

- [ ] **Step 2: Refactor pattern — profile + data fetch parallel setelah getUser**

```typescript
// SEBELUM (sequential):
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()

// SESUDAH (parallel setelah user.id dapat):
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Unauthorized' }
const [{ data: profile }, { data: produksi }] = await Promise.all([
  supabase.from('users_profile').select('name, role').eq('id', user.id).single(),
  supabase.from('produksi_item').select('*').eq('id', produksiId).single(),
])
```

- [ ] **Step 3: Parallelkan write yang independen di akhir action**

```typescript
// SEBELUM (sequential):
await supabase.from('produksi_event').insert({ ... })
await supabase.from('batch').update({ ... })
await supabase.from('audit_log').insert({ ... })  // sudah jadi fire-and-forget dari Task 3

// SESUDAH (parallel):
await Promise.all([
  supabase.from('produksi_event').insert({ ... }),
  supabase.from('batch').update({ ... }),
])
logAudit(supabase, { ... })  // fire-and-forget
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/produksi/actions.ts app/(dashboard)/bahan-baku/actions.ts
git commit -m "perf: parallelisasi DB calls di actions — Promise.all untuk reads & writes independen"
git push origin main
```

---

## Task 5: Optimistic UI — Tombol Loading Instant

**Files:**
- Modify: `components/modules/produksi/produksi-client.tsx`
- Modify: `components/modules/bahan-baku/bahan-baku-client.tsx`

**Kenapa:** Saat ini tombol Save tidak memberikan feedback sampai server selesai. User pikir tombolnya tidak diklik, lalu klik lagi. Dengan `useTransition`, UI langsung berikan feedback (spinner, disabled) saat klik, baru server action jalan di background.

- [ ] **Step 1: Pastikan semua form submission sudah pakai `useTransition`**

Pattern yang sudah benar:
```typescript
const [isPending, startTransition] = useTransition()

const handleSubmit = (fd: FormData) => {
  startTransition(async () => {
    const result = await someAction(fd)
    if (result?.error) setError(result.error)
    else onClose()
  })
}
```

- [ ] **Step 2: Cek dan perbaiki tombol submit — pastikan `disabled={isPending}` dan ada spinner**

```tsx
<button
  type="submit"
  disabled={isPending}
  className="... disabled:opacity-50"
>
  {isPending && <Loader2 size={14} className="animate-spin" />}
  {isPending ? 'Menyimpan...' : 'Simpan'}
</button>
```

- [ ] **Step 3: Hapus `startTransition` manual yang punya delay karena menunggu seluruh chain**

Kalau ada pattern ini, jadikan `onSubmit` langsung call action tanpa wrapping ekstra yang blocking:
```typescript
// Hindari:
const handleSubmit = async (fd: FormData) => {
  setLoading(true)
  await action(fd)  // blocking — user nunggu
  setLoading(false)
}

// Pakai:
const [isPending, startTransition] = useTransition()
const handleSubmit = (fd: FormData) => {
  startTransition(() => action(fd))
}
```

- [ ] **Step 4: Commit**

```bash
git add components/modules/produksi/produksi-client.tsx components/modules/bahan-baku/bahan-baku-client.tsx
git commit -m "perf: optimistic UI — useTransition + instant loading feedback pada semua form submit"
git push origin main
```

---

## Task 6: Shared `createNotif` — Jangan Await

**Files:**
- Modify: `app/(dashboard)/produksi/actions.ts`
- Modify: `app/(dashboard)/bahan-baku/actions.ts`

- [ ] **Step 1: Cek semua `await createNotif(...)` di actions.ts**

```bash
grep -n "await createNotif" app/(dashboard)/*/actions.ts
```

- [ ] **Step 2: Hapus await dari createNotif — notifikasi adalah fire-and-forget**

```typescript
// SEBELUM:
await createNotif(supabase, { ... })

// SESUDAH:
createNotif(supabase, { ... })  // ponytail: fire-and-forget — user tidak butuh tunggu notif tersimpan
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/*/actions.ts
git commit -m "perf: createNotif fire-and-forget — hapus await agar action selesai lebih cepat"
git push origin main
```

---

## Urutan Eksekusi yang Dianjurkan

```
Task 1 (Vercel region) → deploy → ukur latency
Task 3 (audit_log non-blocking) → deploy
Task 6 (createNotif non-blocking) → bisa digabung Task 3
Task 4 (parallelisasi DB) → deploy
Task 5 (optimistic UI) → deploy
Task 2 (pooler) → skip, tidak relevan untuk Supabase JS client
```

## Estimasi Dampak

| Task | Latency Saved | Effort |
|------|--------------|--------|
| Task 1: Vercel region | ~200-300ms per action | 1 menit |
| Task 3: Non-blocking audit_log | ~30-50ms per action | 15 menit |
| Task 6: Non-blocking createNotif | ~30-50ms per action | 5 menit |
| Task 4: Parallel DB calls | ~50-100ms per action | 30 menit |
| Task 5: Optimistic UI | 0ms actual, tapi **terasa 0ms ke user** | 45 menit |

**Total estimasi: save action dari ~1.5s → <400ms terasa oleh user.**
