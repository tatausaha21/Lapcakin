-- ============================================================
-- HUBUNGKAN AKUN AUTH: arsipkemenaglebak@gmail.com
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================
-- Masalah: user sudah ada di Authentication (auth.users) tapi
-- belum punya baris di public.master_users, sehingga login
-- gagal dengan pesan "profil pegawai belum terdaftar".
-- File ini membuat / menautkan profil Admin Organisasi.
-- Artinya aman dijalankan ulang (idempotent).
-- ============================================================

-- 0) Pastikan kolom penghubung ada (dari auth_login.sql)
alter table public.master_users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists idx_master_users_auth_user_id
  on public.master_users (auth_user_id);

-- 1) Tautkan bila baris dengan email yang sama sudah ada
update public.master_users as m
set auth_user_id = 'fa2b7b17-fa42-48c1-929b-df3d7c49c9a2',
    status = 'Aktif',
    peran = 'Admin Organisasi'
where lower(m.email) = lower('arsipkemenaglebak@gmail.com')
  and (m.auth_user_id is null or m.auth_user_id = 'fa2b7b17-fa42-48c1-929b-df3d7c49c9a2');

-- 2) Bila belum ada barisnya sama sekali, buatkan profil default
insert into public.master_users
  (auth_user_id, nama_lengkap, nip, username, email, no_hp, jabatan, peran, unit_kerja_nama, status, catatan)
select
  'fa2b7b17-fa42-48c1-929b-df3d7c49c9a2',
  'Arsip Kemenag Lebak',
  null,
  'arsip.lebak',
  'arsipkemenaglebak@gmail.com',
  null,
  'Administrator Sistem',
  'Admin Organisasi',
  'Subbagian Tata Usaha',
  'Aktif',
  'Akun admin arsip - ditautkan manual via SQL'
where not exists (
  select 1 from public.master_users
  where lower(email) = lower('arsipkemenaglebak@gmail.com')
     or auth_user_id = 'fa2b7b17-fa42-48c1-929b-df3d7c49c9a2'
     or lower(username) = lower('arsip.lebak')
)
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      status = 'Aktif',
      peran = 'Admin Organisasi';

-- 3) Verifikasi: harus mengembalikan 1 baris Aktif
select id, nama_lengkap, username, email, peran, status, auth_user_id
from public.master_users
where lower(email) = lower('arsipkemenaglebak@gmail.com');
