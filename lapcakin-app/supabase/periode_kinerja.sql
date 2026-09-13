-- ============================================================
-- SKEMA TABEL: periode_kinerja (Periode Kinerja - SICAKIN)
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================

-- 0) Ekstensi wajib untuk index pencarian trigram.
create extension if not exists pg_trgm;

-- 1) Tabel utama
create table if not exists public.periode_kinerja (
  id uuid primary key default gen_random_uuid(),
  kode_periode text not null unique,
  nama_periode text not null,
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  jenis_periode text not null default 'Triwulan I'
    check (jenis_periode in ('Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV', 'Semester I', 'Semester II', 'Tahunan')),
  tanggal_mulai date not null,
  tanggal_selesai date not null check (tanggal_selesai >= tanggal_mulai),
  status text not null default 'Draft'
    check (status in ('Draft', 'Aktif', 'Selesai', 'Arsip')),
  deskripsi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index untuk pencarian & filter
create index if not exists idx_periode_kinerja_kode
  on public.periode_kinerja (kode_periode);
create index if not exists idx_periode_kinerja_nama_trgm
  on public.periode_kinerja using gin (nama_periode gin_trgm_ops);
create index if not exists idx_periode_kinerja_tahun
  on public.periode_kinerja (tahun_anggaran);
create index if not exists idx_periode_kinerja_status
  on public.periode_kinerja (status);

-- 3) Trigger auto-update kolom updated_at (reuse jika sudah ada)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_periode_kinerja_updated_at on public.periode_kinerja;
create trigger trg_periode_kinerja_updated_at
  before update on public.periode_kinerja
  for each row execute function public.handle_updated_at();

-- 4) Row Level Security (wajib agar anon key bisa akses)
alter table public.periode_kinerja enable row level security;

-- Kebijakan terbuka untuk prototyping (anon + authenticated full CRUD).
-- Untuk produksi, batasi hanya peran Admin Organisasi via auth.jwt().
drop policy if exists "periode_kinerja_select_all" on public.periode_kinerja;
create policy "periode_kinerja_select_all"
  on public.periode_kinerja for select
  to anon, authenticated
  using (true);

drop policy if exists "periode_kinerja_insert_all" on public.periode_kinerja;
create policy "periode_kinerja_insert_all"
  on public.periode_kinerja for insert
  to anon, authenticated
  with check (true);

drop policy if exists "periode_kinerja_update_all" on public.periode_kinerja;
create policy "periode_kinerja_update_all"
  on public.periode_kinerja for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "periode_kinerja_delete_all" on public.periode_kinerja;
create policy "periode_kinerja_delete_all"
  on public.periode_kinerja for delete
  to anon, authenticated
  using (true);

-- 5) Seed awal (opsional, idempotent berdasarkan kode_periode)
insert into public.periode_kinerja
  (kode_periode, nama_periode, tahun_anggaran, jenis_periode, tanggal_mulai, tanggal_selesai, status, deskripsi)
values
  ('2026-TW1', 'Triwulan I 2026', 2026, 'Triwulan I', '2026-01-01', '2026-03-31', 'Selesai', 'Periode evaluasi Januari - Maret 2026'),
  ('2026-TW2', 'Triwulan II 2026', 2026, 'Triwulan II', '2026-04-01', '2026-06-30', 'Aktif', 'Periode evaluasi April - Juni 2026 (berjalan)'),
  ('2026-TW3', 'Triwulan III 2026', 2026, 'Triwulan III', '2026-07-01', '2026-09-30', 'Draft', 'Periode evaluasi Juli - September 2026'),
  ('2026-TW4', 'Triwulan IV 2026', 2026, 'Triwulan IV', '2026-10-01', '2026-12-31', 'Draft', 'Periode evaluasi Oktober - Desember 2026'),
  ('2026-TA', 'Tahunan 2026', 2026, 'Tahunan', '2026-01-01', '2026-12-31', 'Draft', 'Konsolidasi tahunan penuh T.A 2026')
on conflict (kode_periode) do nothing;
