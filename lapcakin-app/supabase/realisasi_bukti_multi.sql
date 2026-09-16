-- ============================================================
-- MULTI-DOKUMEN bukti dukung (satu realisasi -> N berkas)
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- Prasyarat: supabase/realisasi_kinerja.sql sudah dijalankan.
-- ============================================================
-- Tabel anak baru: public.realisasi_bukti
-- Kolom parent bukti_* di realisasi_kinerja TETAP dipakai sebagai
-- arsip dokumen pertama (kompatibilitas mundur) — jangan dihapus.
-- ============================================================

-- 1) Tabel anak
create table if not exists public.realisasi_bukti (
  id uuid primary key default gen_random_uuid(),
  realisasi_id uuid not null references public.realisasi_kinerja (id) on delete cascade,
  bukti_path text not null,
  bukti_nama text,
  bukti_tipe text,
  bukti_size bigint check (bukti_size is null or bukti_size >= 0),
  bukti_drive_id text,
  bukti_drive_link text,
  created_at timestamptz not null default now()
);

create index if not exists idx_realisasi_bukti_realisasi
  on public.realisasi_bukti (realisasi_id);

-- 2) RLS (prototyping: sama seperti tabel induk)
alter table public.realisasi_bukti enable row level security;

drop policy if exists "bukti_multi_select_all" on public.realisasi_bukti;
create policy "bukti_multi_select_all" on public.realisasi_bukti
  for select to anon, authenticated using (true);
drop policy if exists "bukti_multi_insert_all" on public.realisasi_bukti;
create policy "bukti_multi_insert_all" on public.realisasi_bukti
  for insert to anon, authenticated with check (true);
drop policy if exists "bukti_multi_update_all" on public.realisasi_bukti;
create policy "bukti_multi_update_all" on public.realisasi_bukti
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "bukti_multi_delete_all" on public.realisasi_bukti;
create policy "bukti_multi_delete_all" on public.realisasi_bukti
  for delete to anon, authenticated using (true);

-- 3) Migrasi data lama: satu baris anak per parent yang berlampiran.
--    Aman dijalankan ulang (tidak duplikat berkat not exists).
insert into public.realisasi_bukti
  (realisasi_id, bukti_path, bukti_nama, bukti_tipe, bukti_size, bukti_drive_id, bukti_drive_link)
select
  r.id, r.bukti_path, r.bukti_nama, r.bukti_tipe, r.bukti_size,
  r.bukti_drive_id, r.bukti_drive_link
from public.realisasi_kinerja r
where r.bukti_path is not null
  and not exists (
    select 1 from public.realisasi_bukti b
    where b.realisasi_id = r.id and b.bukti_path = r.bukti_path
  );
