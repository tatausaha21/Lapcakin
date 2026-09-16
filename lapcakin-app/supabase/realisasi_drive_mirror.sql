-- ============================================================
-- MIRROR GOOGLE DRIVE untuk realisasi_kinerja
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================
-- Menyimpan hasil upload mirror ke Drive (dari Edge Function
-- supabase/functions/upload-to-drive) tanpa mengubah kolom
-- bukti_* lama (Supabase Storage tetap sumber utama).

alter table public.realisasi_kinerja
  add column if not exists bukti_drive_id text,
  add column if not exists bukti_drive_link text;
