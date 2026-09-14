-- ============================================================
-- HUBUNGKAN AKUN AUTH (Kepala Seksi): kasubagtukablebak@gmail.com
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================
-- User sudah ada di Authentication (auth.users) tapi belum punya
-- baris di public.master_users, sehingga login gagal dengan pesan
-- "profil pegawai belum terdaftar".
-- File ini membuat / menautkan profil Kepala Satker (menu Kepala Seksi).
-- Aman dijalankan ulang (idempotent).
-- UBAH default di bawah bila perlu: nama, username, jabatan, unit.
-- ============================================================

-- 0) Pastikan kolom penghubung ada (dari auth_login.sql)
alter table public.master_users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists idx_master_users_auth_user_id
  on public.master_users (auth_user_id);

-- 1) Tautkan bila baris dengan email yang sama sudah ada
update public.master_users as m
set auth_user_id = '9597b6b3-7242-4791-9312-072f092ec4b6',
    status = 'Aktif',
    peran = 'Kepala Satker'
where lower(m.email) = lower('kasubagtukablebak@gmail.com')
  and (m.auth_user_id is null or m.auth_user_id = '9597b6b3-7242-4791-9312-072f092ec4b6');

-- 2) Bila belum ada barisnya sama sekali, buatkan profil default
insert into public.master_users
  (auth_user_id, nama_lengkap, nip, username, email, no_hp, jabatan, peran, unit_kerja_nama, status, catatan)
select
  '9597b6b3-7242-4791-9312-072f092ec4b6',
  'Kasubag TU Kemenag Lebak',
  null,
  'kasubagtu.lebak',
  'kasubagtukablebak@gmail.com',
  null,
  'Kepala Subbagian Tata Usaha',
  'Kepala Satker',
  'Subbagian Tata Usaha',
  'Aktif',
  'Akun kepala seksi/kasubag TU - ditautkan manual via SQL'
where not exists (
  select 1 from public.master_users
  where lower(email) = lower('kasubagtukablebak@gmail.com')
     or auth_user_id = '9597b6b3-7242-4791-9312-072f092ec4b6'
     or lower(username) = lower('kasubagtu.lebak')
)
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      status = 'Aktif',
      peran = 'Kepala Satker';

-- 3) Verifikasi: harus mengembalikan 1 baris Aktif
select id, nama_lengkap, username, email, jabatan, peran, unit_kerja_nama, status, auth_user_id
from public.master_users
where lower(email) = lower('kasubagtukablebak@gmail.com');
