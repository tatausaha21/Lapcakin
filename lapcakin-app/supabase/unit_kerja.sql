-- ============================================================
-- SKEMA TABEL: unit_kerja (Master Unit Kerja - SICAKIN)
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================

-- 0) Ekstensi wajib untuk index pencarian trigram.
-- Harus dijalankan SEBELUM create index ... gin_trgm_ops.
create extension if not exists pg_trgm;

-- 1) Tabel utama
create table if not exists public.unit_kerja (
  id uuid primary key default gen_random_uuid(),
  kode_unit text not null unique,
  nama_unit text not null,
  jenis_unit text not null default 'Seksi'
    check (jenis_unit in ('Seksi', 'Subbagian', 'Bagian', 'Bidang', 'Satuan Kerja')),
  induk_organisasi text not null default 'Kantor Kementerian Agama Kabupaten Lebak',
  kepala_unit text not null,
  nip_kepala_unit text,
  email text,
  telepon text,
  alamat text,
  status text not null default 'Aktif'
    check (status in ('Aktif', 'Nonaktif', 'Dalam Verifikasi')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index untuk pencarian Kode / Nama (dipakai search bar)
-- idx kode untuk lookup exact, idx trigram untuk pencarian LIKE/ILIKE yang cepat.
create index if not exists idx_unit_kerja_kode
  on public.unit_kerja (kode_unit);
create index if not exists idx_unit_kerja_nama_trgm
  on public.unit_kerja using gin (nama_unit gin_trgm_ops);

-- 3) Trigger auto-update kolom updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_unit_kerja_updated_at on public.unit_kerja;
create trigger trg_unit_kerja_updated_at
  before update on public.unit_kerja
  for each row execute function public.handle_updated_at();

-- 4) Row Level Security (wajib agar anon key bisa akses)
alter table public.unit_kerja enable row level security;

-- Kebijakan terbuka untuk prototyping (anon + authenticated full CRUD).
-- Untuk produksi, ganti dengan kebijakan berbasis auth.uid() / role.
drop policy if exists "unit_kerja_select_all" on public.unit_kerja;
create policy "unit_kerja_select_all"
  on public.unit_kerja for select
  to anon, authenticated
  using (true);

drop policy if exists "unit_kerja_insert_all" on public.unit_kerja;
create policy "unit_kerja_insert_all"
  on public.unit_kerja for insert
  to anon, authenticated
  with check (true);

drop policy if exists "unit_kerja_update_all" on public.unit_kerja;
create policy "unit_kerja_update_all"
  on public.unit_kerja for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "unit_kerja_delete_all" on public.unit_kerja;
create policy "unit_kerja_delete_all"
  on public.unit_kerja for delete
  to anon, authenticated
  using (true);

-- 5) Seed awal (opsional, idempotent berdasarkan kode_unit)
insert into public.unit_kerja
  (kode_unit, nama_unit, jenis_unit, induk_organisasi, kepala_unit, nip_kepala_unit, email, telepon, alamat, status, catatan)
values
  ('SEKS-PENDIS-01', 'Seksi Pendidikan Madrasah', 'Seksi', 'Kantor Kementerian Agama Kabupaten Lebak', 'Dr. Ahmad Baswedan, M.Pd.', '196701011990031001', 'pendis@kemenag.go.id', '021-5299011', 'Jl. M.H. Thamrin No. 1, Jakarta', 'Aktif', 'Unit kerja seksi pembinaan madrasah'),
  ('SUBBAG-TU-01', 'Subbagian Tata Usaha', 'Subbagian', 'Kantor Kementerian Agama Kabupaten Lebak', 'Rizki Pratama, S.E.', '198505102010011002', 'tu@kemenag.go.id', '021-5299012', 'Jl. M.H. Thamrin No. 1, Jakarta', 'Aktif', null),
  ('SEKS-BIMAS-01', 'Seksi Bimbingan Masyarakat Islam', 'Seksi', 'Kantor Kementerian Agama Kabupaten Lebak', 'H. Muhammad Saleh, M.Ag.', '197203152000031003', 'bimas@kemenag.go.id', '021-5299013', 'Jl. M.H. Thamrin No. 1, Jakarta', 'Dalam Verifikasi', null)
on conflict (kode_unit) do nothing;
