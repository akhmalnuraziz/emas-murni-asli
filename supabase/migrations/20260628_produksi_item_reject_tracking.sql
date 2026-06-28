-- Tambah kolom tracking lebur untuk produksi_item
ALTER TABLE produksi_item
  ADD COLUMN IF NOT EXISTS berat_reject_dilebur NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pcs_reject_dilebur   INTEGER DEFAULT 0;
