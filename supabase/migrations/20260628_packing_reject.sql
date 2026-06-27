-- Tambah kolom reject ke tabel packing
ALTER TABLE packing
  ADD COLUMN IF NOT EXISTS pcs_reject integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gram_reject numeric(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gram_reject_dilebur numeric(10,3) DEFAULT 0;
