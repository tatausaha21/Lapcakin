-- ============================================================
-- SKEMA TABEL: master_users (Master User - SICAKIN)
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================

-- 0) Ekstensi wajib untuk index pencarian trigram.
create extension if not exists pg_trgm;

-- 1) Tabel utama
-- NOTE: tabel ini terpisah dari auth.users (Supabase Auth).
-- Kolom password_hash diisi hash (bcrypt) dari backend / edge function,
-- jangan simpan password plain-text. Untuk prototyping, boleh nullable.
create table if not exists public.master_users (
  id uuid primary key default gen_random_uuid(),
  nama_lengkap text not null,
  nip text unique,
  username text not null unique,
  email text not null unique,
  no_hp text,
  jabatan text not null,
  peran text not null default 'Operator Unit'
    check (peran in ('Admin Organisasi', 'Kepala Satker', 'Operator Unit', 'Viewer / Auditor')),
  unit_kerja_id uuid references public.unit_kerja (id) on delete set null,
  unit_kerja_nama text not null default '',
  password_hash text,
  status text not null default 'Aktif'
    check (status in ('Aktif', 'Nonaktif', 'Blokir')),
  catatan text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index untuk pencarian Nama / Username / Email / NIP
create index if not exists idx_master_users_username
  on public.master_users (username);
create index if not exists idx_master_users_email
  on public.master_users (email);
create index if not exists idx_master_users_nama_trgm
  on public.master_users using gin (nama_lengkap gin_trgm_ops);
create index if not exists idx_master_users_unit_kerja
  on public.master_users (unit_kerja_id);

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

drop trigger if exists trg_master_users_updated_at on public.master_users;
create trigger trg_master_users_updated_at
  before update on public.master_users
  for each row execute function public.handle_updated_at();

-- 4) Row Level Security (wajib agar anon key bisa akses)
alter table public.master_users enable row level security;

-- Kebijakan terbuka untuk prototyping (anon + authenticated full CRUD).
-- Untuk produksi, batasi hanya peran Admin Organisasi via auth.jwt().
drop policy if exists "master_users_select_all" on public.master_users;
create policy "master_users_select_all"
  on public.master_users for select
  to anon, authenticated
  using (true);

drop policy if exists "master_users_insert_all" on public.master_users;
create policy "master_users_insert_all"
  on public.master_users for insert
  to anon, authenticated
  with check (true);

drop policy if exists "master_users_update_all" on public.master_users;
create policy "master_users_update_all"
  on public.master_users for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "master_users_delete_all" on public.master_users;
create policy "master_users_delete_all"
  on public.master_users for delete
  to anon, authenticated
  using (true);

-- 5) Seed awal (opsional, idempotent berdasarkan username)
insert into public.master_users
  (nama_lengkap, nip, username, email, no_hp, jabatan, peran, unit_kerja_nama, status, catatan)
values
  ('Administrator SICAKIN', '196701011990031001', 'admin.sicakin', 'admin@kemenag.go.id', '081200000001', 'Administrator Sistem', 'Admin Organisasi', 'Subbagian Tata Usaha', 'Aktif', 'Akun admin utama organisasi'),
  ('Dr. Ahmad Baswedan, M.Pd.', '196701011990031002', 'ahmad.baswedan', 'pendis@kemenag.go.id', '081200000002', 'Kepala Seksi Pendidikan Madrasah', 'Kepala Satker', 'Seksi Pendidikan Madrasah', 'Aktif', null),
  ('Rizki Pratama, S.E.', '198505102010011002', 'rizki.pratama', 'tu@kemenag.go.id', '081200000003', 'Operator Tata Usaha', 'Operator Unit', 'Subbagian Tata Usaha', 'Nonaktif', null)
on conflict (username) do nothing;
