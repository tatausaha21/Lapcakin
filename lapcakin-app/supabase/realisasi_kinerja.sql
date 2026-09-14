-- ============================================================
-- SKEMA TABEL: realisasi_kinerja (Input Realisasi Kinerja Seksi)
-- Relasi: rencana_aksi_kinerja (1) -> realisasi_kinerja (N)
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- Prasyarat: supabase/rencana_aksi_kinerja.sql sudah dijalankan.
-- ============================================================
-- Kolom:
--   rencana_aksi_id    -> dropdown dari rencana aksi milik seksi user
--   realisasi_kinerja  -> TEXT isian kepala seksi (mis. "115", "95%")
--   tanggal_kegiatan   -> date (calendar picker di form)
--   realisasi_anggaran -> numeric nullable (Rp, opsional)
--   catatan_kendala    -> text nullable (opsional)
--   bukti_*            -> metadata file di Storage bucket bukti-dukung
--   tahun_anggaran     -> disalin dari cascading saat simpan
--
-- Rumus "% realisasi target" dihitung di aplikasi (bukan trigger):
--   satuan Persen            -> (realisasi / target) * 100,
--                               capping 0%..120%
--   satuan selain Persen      -> target - realisasi
-- ============================================================

-- 1) Tabel utama
create table if not exists public.realisasi_kinerja (
  id uuid primary key default gen_random_uuid(),
  rencana_aksi_id uuid not null references public.rencana_aksi_kinerja (id) on delete cascade,
  realisasi_kinerja text not null check (btrim(realisasi_kinerja) <> ''),
  tanggal_kegiatan date not null,
  realisasi_anggaran numeric check (realisasi_anggaran is null or realisasi_anggaran >= 0),
  catatan_kendala text,
  bukti_path text,
  bukti_nama text,
  bukti_tipe text,
  bukti_size bigint check (bukti_size is null or bukti_size >= 0),
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index
create index if not exists idx_realisasi_rencana
  on public.realisasi_kinerja (rencana_aksi_id);
create index if not exists idx_realisasi_tahun
  on public.realisasi_kinerja (tahun_anggaran);
create index if not exists idx_realisasi_tanggal
  on public.realisasi_kinerja (tanggal_kegiatan);

-- 3) Trigger updated_at (reuse fungsi jika sudah ada)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_realisasi_updated_at on public.realisasi_kinerja;
create trigger trg_realisasi_updated_at
  before update on public.realisasi_kinerja
  for each row execute function public.handle_updated_at();

-- 4) RLS (prototyping: anon + authenticated full CRUD,
--    sama seperti tabel perkin / cascading / rencana aksi)
alter table public.realisasi_kinerja enable row level security;

drop policy if exists "realisasi_select_all" on public.realisasi_kinerja;
create policy "realisasi_select_all" on public.realisasi_kinerja
  for select to anon, authenticated using (true);
drop policy if exists "realisasi_insert_all" on public.realisasi_kinerja;
create policy "realisasi_insert_all" on public.realisasi_kinerja
  for insert to anon, authenticated with check (true);
drop policy if exists "realisasi_update_all" on public.realisasi_kinerja;
create policy "realisasi_update_all" on public.realisasi_kinerja
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "realisasi_delete_all" on public.realisasi_kinerja;
create policy "realisasi_delete_all" on public.realisasi_kinerja
  for delete to anon, authenticated using (true);

-- 5) Storage bucket untuk file bukti dukung (pdf/excel/jpg/png)
insert into storage.buckets (id, name, public)
values ('bukti-dukung', 'bukti-dukung', true)
on conflict (id) do nothing;

-- Kebijakan prototyping: anon + authenticated boleh baca/unggah/ubah/hapus
-- file di bucket bukti-dukung. Untuk produksi, batasi ke authenticated
-- dan/atau awalan path per unit kerja.
drop policy if exists "bukti_select_all" on storage.objects;
create policy "bukti_select_all" on storage.objects
  for select to anon, authenticated using (bucket_id = 'bukti-dukung');
drop policy if exists "bukti_insert_all" on storage.objects;
create policy "bukti_insert_all" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'bukti-dukung');
drop policy if exists "bukti_update_all" on storage.objects;
create policy "bukti_update_all" on storage.objects
  for update to anon, authenticated using (bucket_id = 'bukti-dukung') with check (bucket_id = 'bukti-dukung');
drop policy if exists "bukti_delete_all" on storage.objects;
create policy "bukti_delete_all" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'bukti-dukung');
