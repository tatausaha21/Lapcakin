-- ============================================================
-- SKEMA TABEL: cascading_kinerja (Cascading Kinerja - SICAKIN)
-- Relasi: 1 IKSK (master perkin) -> N Unit Kerja (penanggung jawab)
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- paste seluruh file ini > Run
-- Prasyarat: supabase/perkin.sql dan supabase/unit_kerja.sql
-- sudah dijalankan terlebih dahulu.
-- ============================================================

-- 1) Tabel utama (satu baris = satu penugasan IKSK ke satu unit)
-- target_cascading default = target IKSK induk, bisa disesuaikan per unit.
create table if not exists public.cascading_kinerja (
  id uuid primary key default gen_random_uuid(),
  iksk_id uuid not null references public.perkin_iksk (id) on delete cascade,
  unit_kerja_id uuid not null references public.unit_kerja (id) on delete cascade,
  target_cascading text not null,
  satuan text not null default 'Persen'
    check (satuan in ('Persen', 'Nilai', 'Rasio', 'Teks')),
  tahun_anggaran integer not null check (tahun_anggaran between 2000 and 2100),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (iksk_id, unit_kerja_id)
);

-- 2) Index
create index if not exists idx_cascading_iksk
  on public.cascading_kinerja (iksk_id);
create index if not exists idx_cascading_unit
  on public.cascading_kinerja (unit_kerja_id);
create index if not exists idx_cascading_tahun
  on public.cascading_kinerja (tahun_anggaran);

-- 3) Trigger updated_at (reuse fungsi jika sudah ada)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_cascading_updated_at on public.cascading_kinerja;
create trigger trg_cascading_updated_at
  before update on public.cascading_kinerja
  for each row execute function public.handle_updated_at();

-- 4) RLS (prototyping: anon + authenticated full CRUD)
alter table public.cascading_kinerja enable row level security;

drop policy if exists "cascading_select_all" on public.cascading_kinerja;
create policy "cascading_select_all" on public.cascading_kinerja
  for select to anon, authenticated using (true);
drop policy if exists "cascading_insert_all" on public.cascading_kinerja;
create policy "cascading_insert_all" on public.cascading_kinerja
  for insert to anon, authenticated with check (true);
drop policy if exists "cascading_update_all" on public.cascading_kinerja;
create policy "cascading_update_all" on public.cascading_kinerja
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "cascading_delete_all" on public.cascading_kinerja;
create policy "cascading_delete_all" on public.cascading_kinerja
  for delete to anon, authenticated using (true);

-- 5) Seed contoh (opsional, idempotent via DO block)
-- Memetakan IKSK seed perkin.sql ke unit seed unit_kerja.sql.
-- Dilewati otomatis bila data induk belum ada.
do $$
declare
  v_iksk11 uuid;
  v_iksk12 uuid;
  v_iksk21 uuid;
  v_pendis uuid;
  v_tu uuid;
  v_bimas uuid;
  v_tahun int := 2026;
begin
  select i.id into v_iksk11
  from public.perkin_iksk i
  join public.perkin_sk s on s.id = i.sk_id
  where s.tahun_anggaran = v_tahun and s.nomor = 1 and i.nomor_urut = 1
  limit 1;

  select i.id into v_iksk12
  from public.perkin_iksk i
  join public.perkin_sk s on s.id = i.sk_id
  where s.tahun_anggaran = v_tahun and s.nomor = 1 and i.nomor_urut = 2
  limit 1;

  select i.id into v_iksk21
  from public.perkin_iksk i
  join public.perkin_sk s on s.id = i.sk_id
  where s.tahun_anggaran = v_tahun and s.nomor = 2 and i.nomor_urut = 1
  limit 1;

  select id into v_pendis from public.unit_kerja where kode_unit = 'SEKS-PENDIS-01' limit 1;
  select id into v_tu from public.unit_kerja where kode_unit = 'SUBBAG-TU-01' limit 1;
  select id into v_bimas from public.unit_kerja where kode_unit = 'SEKS-BIMAS-01' limit 1;

  -- IKSK 1.1 (50%, Persen) dic cascading ke Pendis + TU
  if v_iksk11 is not null and v_pendis is not null then
    insert into public.cascading_kinerja (iksk_id, unit_kerja_id, target_cascading, satuan, tahun_anggaran, catatan)
    values (v_iksk11, v_pendis, '50%', 'Persen', v_tahun, 'Penanggung jawab utama dialog kerukunan Islam')
    on conflict (iksk_id, unit_kerja_id) do nothing;
  end if;
  if v_iksk11 is not null and v_tu is not null then
    insert into public.cascading_kinerja (iksk_id, unit_kerja_id, target_cascading, satuan, tahun_anggaran, catatan)
    values (v_iksk11, v_tu, '50%', 'Persen', v_tahun, 'Dukungan administrasi dan dokumentasi')
    on conflict (iksk_id, unit_kerja_id) do nothing;
  end if;

  -- IKSK 1.2 (50%, Persen) dic cascading ke Bimas
  if v_iksk12 is not null and v_bimas is not null then
    insert into public.cascading_kinerja (iksk_id, unit_kerja_id, target_cascading, satuan, tahun_anggaran, catatan)
    values (v_iksk12, v_bimas, '50%', 'Persen', v_tahun, 'Fasilitasi forum kerukunan umat beragama')
    on conflict (iksk_id, unit_kerja_id) do nothing;
  end if;

  -- IKSK 2.1 (28, Nilai) dic cascading ke Pendis + Bimas
  if v_iksk21 is not null and v_pendis is not null then
    insert into public.cascading_kinerja (iksk_id, unit_kerja_id, target_cascading, satuan, tahun_anggaran, catatan)
    values (v_iksk21, v_pendis, '14', 'Nilai', v_tahun, 'Pembinaan KUA wilayah I')
    on conflict (iksk_id, unit_kerja_id) do nothing;
  end if;
  if v_iksk21 is not null and v_bimas is not null then
    insert into public.cascading_kinerja (iksk_id, unit_kerja_id, target_cascading, satuan, tahun_anggaran, catatan)
    values (v_iksk21, v_bimas, '14', 'Nilai', v_tahun, 'Pembinaan KUA wilayah II')
    on conflict (iksk_id, unit_kerja_id) do nothing;
  end if;
end $$;
