-- ============================================================
-- PERBAIKAN RLS: master_users — "new row violates row-level
-- security policy" saat simpan dari menu Master User
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run, lalu ulangi simpan di aplikasi.
-- (Tidak perlu rebuild/deploy — ini murni sisi database.)
-- ============================================================
-- Penyebab: auth_login.sql mengganti kebijakan terbuka (..._all)
-- dengan kebijakan ketat (hanya profil sendiri). Aplikasi memakai
-- anon key sehingga insert/update/delete ditolak.
--
-- File ini mengembalikan kebijakan prototyping terbuka agar
-- Master User bisa simpan lagi. Fungsi login (resolve_login_email,
-- record_login) tidak terganggu.
-- ============================================================

-- 1) Hapus kebijakan ketat dari auth_login.sql (jika ada)
drop policy if exists "master_users_select_own" on public.master_users;
drop policy if exists "master_users_update_own_login" on public.master_users;

-- 2) Kembalikan kebijakan terbuka untuk prototyping
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

-- ============================================================
-- CATATAN PRODUKSI: anon key itu publik, jadi RLS saja tidak bisa
-- benar-benar membatasi tulis ke hanya-admin selama aplikasi
-- menulis langsung dengan anon key. Untuk produksi, tulis Master
-- User sebaiknya lewat backend / Edge Function memakai
-- service_role key, lalu RLS diketatkan kembali (lihat komentar
-- di supabase/auth_login.sql bagian 4).
-- ============================================================
