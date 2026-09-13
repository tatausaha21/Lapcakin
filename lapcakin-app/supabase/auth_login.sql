-- ============================================================
-- AUTH LOGIN: Supabase Auth untuk Login SICAKIN
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- Prasyarat: jalankan supabase/master_users.sql terlebih dahulu.
-- ============================================================
-- Desain:
--   * Password & sesi ditangani Supabase Auth (auth.users) — aman,
--     tidak lagi menyimpan password di master_users.password_hash.
--   * master_users tetap menjadi sumber profil (nama, NIP, username,
--     jabatan, peran, unit kerja, status) + kolom baru auth_user_id
--     sebagai penghubung ke auth.users.id.
--   * Login mendukung identifier Username / Email / NIP melalui
--     fungsi SECURITY DEFINER resolve_login_email() agar anon key
--     tidak perlu akses baca langsung ke master_users.
-- ============================================================

-- 0) Kolom penghubung ke auth.users
alter table public.master_users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists idx_master_users_auth_user_id
  on public.master_users (auth_user_id);

-- 1) Fungsi: petakan Username / Email / NIP -> email Auth
--    SECURITY DEFINER supaya bisa dipanggil anon tanpa membuka
--    seluruh tabel master_users. Hanya mengembalikan email milik
--    akun berstatus Aktif.
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if p_identifier is null or btrim(p_identifier) = '' then
    return null;
  end if;

  select m.email into v_email
  from public.master_users as m
  where m.status = 'Aktif'
    and (
      lower(m.username) = lower(btrim(p_identifier))
      or lower(m.email) = lower(btrim(p_identifier))
      or m.nip = btrim(p_identifier)
    )
  order by m.created_at asc
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- 2) Fungsi: catat waktu login terakhir (dipanggil setelah login sukses)
create or replace function public.record_login(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.master_users
  set last_login_at = now()
  where auth_user_id = p_auth_user_id;
end;
$$;

revoke all on function public.record_login(uuid) from public;
grant execute on function public.record_login(uuid) to anon, authenticated;

-- 3) Trigger: saat user dibuat di auth.users, tautkan otomatis
--    ke baris master_users yang email-nya sama (disiapkan admin
--    lewat Master User). Jika belum ada barisnya, buat profil
--    dasar berstatus Aktif dari user_metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.master_users as m
  set auth_user_id = new.id
  where lower(m.email) = lower(new.email)
    and m.auth_user_id is null;

  if not found then
    insert into public.master_users
      (auth_user_id, nama_lengkap, username, email, jabatan, peran, unit_kerja_nama, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nama_lengkap', split_part(new.email, '@', 1)),
      coalesce(
        new.raw_user_meta_data ->> 'username',
        split_part(new.email, '@', 1)
      ),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'jabatan', 'Pegawai'),
      coalesce(new.raw_user_meta_data ->> 'peran', 'Operator Unit'),
      coalesce(new.raw_user_meta_data ->> 'unit_kerja_nama', ''),
      'Aktif'
    )
    on conflict (email) do update
      set auth_user_id = excluded.auth_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_users_link_master on auth.users;
create trigger trg_auth_users_link_master
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) RLS: perketat master_users — user hanya baca/ubah profil sendiri.
--    (Kebijakan terbuka "…_all" dari master_users.sql diganti.)
drop policy if exists "master_users_select_all" on public.master_users;
drop policy if exists "master_users_insert_all" on public.master_users;
drop policy if exists "master_users_update_all" on public.master_users;
drop policy if exists "master_users_delete_all" on public.master_users;

-- Baca: baris milik sendiri (atau semua baris bagi service_role / admin via backend).
drop policy if exists "master_users_select_own" on public.master_users;
create policy "master_users_select_own"
  on public.master_users for select
  to authenticated
  using (auth.uid() = auth_user_id);

-- Ubah: hanya kolom last_login_at milik sendiri (aplikasi memakai record_login()).
drop policy if exists "master_users_update_own_login" on public.master_users;
create policy "master_users_update_own_login"
  on public.master_users for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- NOTE: operasi admin (tambah/edit/hapus user lewat Master User) sebaiknya
-- lewat backend / Edge Function memakai service_role key agar melewati RLS.
-- Selama masa transisi prototyping, bila Master User harus tetap bisa
-- ditulis dari anon key, jalankan blok opsional di bawah ini:
--
--   create policy "master_users_prototype_write"
--     on public.master_users for all
--     to anon, authenticated
--     using (true)
--     with check (true);
--
-- Hapus kebijakan itu sebelum production.

-- ============================================================
-- CARA MEMBUAT AKUN (pilih salah satu):
--
-- A) Via Dashboard (disarankan):
--    1. Authentication > Users > Add user > Create new user
--       (isi Email + Password, centang Auto Confirm).
--    2. Di User Metadata (App Metadata / User Metadata) opsional:
--       { "username": "admin.sicakin", "nama_lengkap": "...",
--         "peran": "Admin Organisasi", "jabatan": "...",
--         "unit_kerja_nama": "Subbagian Tata Usaha" }
--    3. Pastikan baris master_users dengan email yang sama sudah ada
--       (buat lewat menu Master User) — trigger otomatis mengisi
--       auth_user_id. Jika belum ada, trigger membuatkan profil dasar.
--
-- B) Backfill akun lama (sudah ada di master_users, belum punya Auth):
--    Buatkan dulu user di Authentication untuk tiap email, lalu:
--
--    update public.master_users as m
--    set auth_user_id = u.id
--    from auth.users as u
--    where lower(u.email) = lower(m.email)
--      and m.auth_user_id is null;
--
-- C) Reset password user: Authentication > Users > pilih user >
--    Send password recovery, atau dari aplikasi via
--    supabase.auth.resetPasswordForEmail(email).
-- ============================================================
