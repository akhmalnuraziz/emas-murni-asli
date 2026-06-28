ALTER TABLE mutasi ADD COLUMN IF NOT EXISTS po_id integer REFERENCES po_cabang(id);
