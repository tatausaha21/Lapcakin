-- ============================================================
-- SKEMA TABEL: rencana_aksi_kinerja (Rencana Aksi Kinerja Seksi)
-- Relasi: 1 cascading (IKSK x unit kerja) -> N rencana aksi
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- Prasyarat: supabase/perkin.sql, unit_kerja.sql,
-- dan cascading_kinerja.sql sudah dijalankan terlebih dahulu.
-- ============================================================
-- Kolom:
--   cascading_id   -> IKSK + unit penanggung jawab (dropdown IKSK
--                     di form hanya memunculkan cascading milik
--                     seksi/unit kerja user yang login)
--   rencana_aksi   -> uraian kegiatan yang diinput kepala seksi
--   target_kinerja -> TEXT (mendukung "50%", "28", "1:5", "Baik").
--                     Logika auto-isi ada di aplikasi (bukan trigger):
--                     jika satuan cascading SELAIN 'Persen' maka target
--                     cascading otomatis masuk; jika 'Persen' dikosongkan
--                     agar kepala seksi mengisi sendiri (mis. rincian TW).
--                     Nilai auto-isi tetap bisa diedit.
--   satuan         -> mengikuti satuan cascading (Persen/Nilai/Rasio/Teks)
--   anggaran       -> opsional (nullable), rupiah
--   tahun_anggaran -> disalin dari cascading saat simpan
-- ============================================================

-- 1) Tabel utama
create table if not exists public.rencana_aksi_kinerja (
  id uuid primary key default gen_random_uuid(),
  cascading_id uuid not null references public.cascading_kinerja (id) on delete cascade,
  rencana_aksi text not null check (btrim(rencana_aksi) <> ''),
  target_kinerja text not null check (btrim(target_kinerja) <> ''),
  satuan text not null default 'Persen'
    check (satuan in ('Persen', 'Nilai', 'Rasio', 'Teks')),
  anggaran numeric check (anggaran is null or anggaran >= 0),
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index
create index if not exists idx_rencana_aksi_cascading
  on public.rencana_aksi_kinerja (cascading_id);
create index if not exists idx_rencana_aksi_tahun
  on public.rencana_aksi_kinerja (tahun_anggaran);
create index if not exists idx_rencana_aksi_rencana_trgm
  on public.rencana_aksi_kinerja using gin (rencana_aksi gin_trgm_ops);

-- 3) Trigger updated_at (reuse fungsi jika sudah ada)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_rencana_aksi_updated_at on public.rencana_aksi_kinerja;
create trigger trg_rencana_aksi_updated_at
  before update on public.rencana_aksi_kinerja
  for each row execute function public.handle_updated_at();

-- 4) RLS (prototyping: anon + authenticated full CRUD,
--    sama seperti tabel perkin / cascading)
alter table public.rencana_aksi_kinerja enable row level security;

drop policy if exists "rencana_aksi_select_all" on public.rencana_aksi_kinerja;
create policy "rencana_aksi_select_all" on public.rencana_aksi_kinerja
  for select to anon, authenticated using (true);
drop policy if exists "rencana_aksi_insert_all" on public.rencana_aksi_kinerja;
create policy "rencana_aksi_insert_all" on public.rencana_aksi_kinerja
  for insert to anon, authenticated with check (true);
drop policy if exists "rencana_aksi_update_all" on public.rencana_aksi_kinerja;
create policy "rencana_aksi_update_all" on public.rencana_aksi_kinerja
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "rencana_aksi_delete_all" on public.rencana_aksi_kinerja;
create policy "rencana_aksi_delete_all" on public.rencana_aksi_kinerja
  for delete to anon, authenticated using (true);
