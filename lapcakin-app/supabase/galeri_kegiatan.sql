-- ============================================================
-- SKEMA TABEL: galeri_kegiatan (Galeri Portal Publik - SICAKIN)
-- Foto dokumentasi lapangan yang diunggah oleh tiap Seksi melalui
-- menu "Portal Publik", ditampilkan di galeri PublicPortal.
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================

-- 0) Ekstensi wajib untuk index pencarian trigram.
create extension if not exists pg_trgm;

-- 1) Tabel utama
create table if not exists public.galeri_kegiatan (
  id uuid primary key default gen_random_uuid(),
  unit_kerja_id uuid references public.unit_kerja (id) on delete set null,
  unit_kerja_nama text not null default '',
  judul text not null,
  deskripsi text,
  lokasi text,
  status_label text not null default 'Dokumentasi Lapangan',
  tanggal_kegiatan date,
  image_path text not null,
  image_nama text,
  image_tipe text,
  image_size integer,
  tampil boolean not null default true,
  urutan integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Index untuk pencarian & filter
create index if not exists idx_galeri_judul_trgm
  on public.galeri_kegiatan using gin (judul gin_trgm_ops);
create index if not exists idx_galeri_unit
  on public.galeri_kegiatan (unit_kerja_id);
create index if not exists idx_galeri_tampil
  on public.galeri_kegiatan (tampil);
create index if not exists idx_galeri_tanggal
  on public.galeri_kegiatan (tanggal_kegiatan desc nulls last);

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

drop trigger if exists trg_galeri_updated_at on public.galeri_kegiatan;
create trigger trg_galeri_updated_at
  before update on public.galeri_kegiatan
  for each row execute function public.handle_updated_at();

-- 4) Row Level Security (wajib agar anon key bisa akses)
-- Galeri tayang dibaca publik (portal); tulis oleh seksi login.
-- Untuk prototyping, kebijakan terbuka seperti tabel lain.
-- Untuk produksi, batasi tulis hanya peran seksi/admin via auth.jwt().
alter table public.galeri_kegiatan enable row level security;

drop policy if exists "galeri_select_all" on public.galeri_kegiatan;
create policy "galeri_select_all"
  on public.galeri_kegiatan for select
  to anon, authenticated
  using (true);

drop policy if exists "galeri_insert_all" on public.galeri_kegiatan;
create policy "galeri_insert_all"
  on public.galeri_kegiatan for insert
  to anon, authenticated
  with check (true);

drop policy if exists "galeri_update_all" on public.galeri_kegiatan;
create policy "galeri_update_all"
  on public.galeri_kegiatan for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "galeri_delete_all" on public.galeri_kegiatan;
create policy "galeri_delete_all"
  on public.galeri_kegiatan for delete
  to anon, authenticated
  using (true);

-- 5) Storage bucket publik untuk foto galeri (jpg/jpeg/png)
insert into storage.buckets (id, name, public)
values ('galeri-portal', 'galeri-portal', true)
on conflict (id) do nothing;

-- Kebijakan terbuka untuk file di bucket galeri-portal. Untuk produksi,
-- batasi insert/update/delete ke authenticated.
drop policy if exists "galeri_obj_select_all" on storage.objects;
create policy "galeri_obj_select_all" on storage.objects
  for select to anon, authenticated using (bucket_id = 'galeri-portal');

drop policy if exists "galeri_obj_insert_all" on storage.objects;
create policy "galeri_obj_insert_all" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'galeri-portal');

drop policy if exists "galeri_obj_update_all" on storage.objects;
create policy "galeri_obj_update_all" on storage.objects
  for update to anon, authenticated using (bucket_id = 'galeri-portal') with check (bucket_id = 'galeri-portal');

drop policy if exists "galeri_obj_delete_all" on storage.objects;
create policy "galeri_obj_delete_all" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'galeri-portal');
