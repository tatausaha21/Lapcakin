-- ============================================================
-- SKEMA TABEL: PERKIN - Master Perjanjian Kinerja (SICAKIN)
-- 2 tabel: perkin_sk (Sasaran Kegiatan) + perkin_iksk (Indikator)
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- ============================================================

create extension if not exists pg_trgm;

-- ---------- 1) Tabel Sasaran Kegiatan (SK) ----------
-- nomor = penomoran otomatis per tahun (1, 2, 3...)
create table if not exists public.perkin_sk (
  id uuid primary key default gen_random_uuid(),
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  nomor integer not null check (nomor >= 1),
  uraian text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tahun_anggaran, nomor)
);

-- ---------- 2) Tabel Indikator Kinerja Sasaran Kegiatan (IKSK) ----------
-- nomor_urut = urutan dalam SK (1,2,3...) -> tampil "1.1", "1.2"
-- target_tahunan disimpan sebagai TEXT agar mendukung
--   Persen ("50%"), Nilai ("28"), Rasio ("1:5"), Teks ("Baik")
-- polaritas: Positive = semakin tinggi semakin baik (maximize)
--            Negative = semakin rendah semakin baik (minimize)
--   dipakai untuk penghitungan capaian kinerja nantinya.
create table if not exists public.perkin_iksk (
  id uuid primary key default gen_random_uuid(),
  sk_id uuid not null references public.perkin_sk (id) on delete cascade,
  nomor_urut integer not null check (nomor_urut >= 1),
  uraian text not null,
  target_tahunan text not null,
  satuan text not null default 'Persen'
    check (satuan in ('Persen', 'Nilai', 'Rasio', 'Teks')),
  polaritas text not null default 'Positive'
    check (polaritas in ('Positive', 'Negative')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sk_id, nomor_urut)
);

-- ---------- 3) Index ----------
create index if not exists idx_perkin_sk_tahun_nomor
  on public.perkin_sk (tahun_anggaran, nomor);
create index if not exists idx_perkin_sk_uraian_trgm
  on public.perkin_sk using gin (uraian gin_trgm_ops);
create index if not exists idx_perkin_iksk_sk
  on public.perkin_iksk (sk_id);
create index if not exists idx_perkin_iksk_uraian_trgm
  on public.perkin_iksk using gin (uraian gin_trgm_ops);

-- ---------- 4) Trigger updated_at ----------
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_perkin_sk_updated_at on public.perkin_sk;
create trigger trg_perkin_sk_updated_at
  before update on public.perkin_sk
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_perkin_iksk_updated_at on public.perkin_iksk;
create trigger trg_perkin_iksk_updated_at
  before update on public.perkin_iksk
  for each row execute function public.handle_updated_at();

-- ---------- 5) RLS (prototyping: anon + authenticated full CRUD) ----------
alter table public.perkin_sk enable row level security;
alter table public.perkin_iksk enable row level security;

drop policy if exists "perkin_sk_select_all" on public.perkin_sk;
create policy "perkin_sk_select_all" on public.perkin_sk
  for select to anon, authenticated using (true);
drop policy if exists "perkin_sk_insert_all" on public.perkin_sk;
create policy "perkin_sk_insert_all" on public.perkin_sk
  for insert to anon, authenticated with check (true);
drop policy if exists "perkin_sk_update_all" on public.perkin_sk;
create policy "perkin_sk_update_all" on public.perkin_sk
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "perkin_sk_delete_all" on public.perkin_sk;
create policy "perkin_sk_delete_all" on public.perkin_sk
  for delete to anon, authenticated using (true);

drop policy if exists "perkin_iksk_select_all" on public.perkin_iksk;
create policy "perkin_iksk_select_all" on public.perkin_iksk
  for select to anon, authenticated using (true);
drop policy if exists "perkin_iksk_insert_all" on public.perkin_iksk;
create policy "perkin_iksk_insert_all" on public.perkin_iksk
  for insert to anon, authenticated with check (true);
drop policy if exists "perkin_iksk_update_all" on public.perkin_iksk;
create policy "perkin_iksk_update_all" on public.perkin_iksk
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "perkin_iksk_delete_all" on public.perkin_iksk;
create policy "perkin_iksk_delete_all" on public.perkin_iksk
  for delete to anon, authenticated using (true);

-- ---------- 6) Seed contoh (idempotent) ----------
-- SK 1 + SK 2 tahun 2026 beserta IKSK-nya, sesuai contoh isian.
do $$
declare
  v_sk1 uuid;
  v_sk2 uuid;
begin
  insert into public.perkin_sk (tahun_anggaran, nomor, uraian)
  values (2026, 1, 'Meningkatnya jaminan beragama, toleransi, dan cinta kemanusiaan umat beragama')
  on conflict (tahun_anggaran, nomor) do update set uraian = excluded.uraian
  returning id into v_sk1;

  -- fallback bila conflict tanpa returning (id sudah ada)
  if v_sk1 is null then
    select id into v_sk1 from public.perkin_sk where tahun_anggaran = 2026 and nomor = 1;
  end if;

  insert into public.perkin_sk (tahun_anggaran, nomor, uraian)
  values (2026, 2, 'Terlaksananya KUA sebagai Pusat Kerukunan Umat Beragama Tingkat Kecamatan / Tingkat Akar Rumput')
  on conflict (tahun_anggaran, nomor) do update set uraian = excluded.uraian
  returning id into v_sk2;

  if v_sk2 is null then
    select id into v_sk2 from public.perkin_sk where tahun_anggaran = 2026 and nomor = 2;
  end if;

  insert into public.perkin_iksk (sk_id, nomor_urut, uraian, target_tahunan, satuan, polaritas)
  values
    (v_sk1, 1, 'Persentase peningkatan dialog kerukunan agama Islam yang difasilitasi untuk merumuskan rekomendasi EWS', '50%', 'Persen', 'Positive'),
    (v_sk1, 2, 'Persentase peningkatan dialog forum kerukunan umat beragama yang difasilitasi untuk merumuskan rekomendasi EWS', '50%', 'Persen', 'Positive'),
    (v_sk2, 1, 'Jumlah KUA yang menyelenggarakan EWS', '28', 'Nilai', 'Positive')
  on conflict (sk_id, nomor_urut) do update set
    uraian = excluded.uraian,
    target_tahunan = excluded.target_tahunan,
    satuan = excluded.satuan,
    polaritas = excluded.polaritas;
end $$;
