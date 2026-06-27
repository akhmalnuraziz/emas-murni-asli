-- Add jam, tim_id, tim_anggota_aktif columns to packing table
ALTER TABLE packing ADD COLUMN IF NOT EXISTS jam text;
ALTER TABLE packing ADD COLUMN IF NOT EXISTS tim_id integer REFERENCES tim_produksi(id);
ALTER TABLE packing ADD COLUMN IF NOT EXISTS tim_anggota_aktif text;
