import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  TW_OPTIONS,
  TW_TARGET_PERSEN,
  computeOrganisasi,
  computePerSeksi,
  formatRupiah,
  shortUnitName,
  triwulanOf,
} from '../lib/kinerjaOrganisasi'

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '-'
  const n = Number(bytes)
  if (Number.isNaN(n)) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatRupiahShort(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  if (Math.abs(num) >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (Math.abs(num) >= 1_000_000) return `Rp ${(num / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (Math.abs(num) >= 1000) return `Rp ${(num / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
  return `Rp ${num.toLocaleString('id-ID')}`
}

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function predikat(capaian) {
  if (capaian === null || capaian === undefined) return { label: 'Belum terhitung', cls: 'bg-surface-container text-secondary' }
  if (capaian >= 100) return { label: 'Sangat Baik', cls: 'bg-primary-fixed text-on-primary-fixed' }
  if (capaian >= 85) return { label: 'Baik', cls: 'bg-secondary-container text-on-secondary-container' }
  if (capaian >= 70) return { label: 'Cukup', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' }
  return { label: 'Kurang', cls: 'bg-error-container text-on-error-container' }
}

const CHART_COLORS = ['#059669', '#2563EB', '#D97706', '#0D9488', '#7C3AED', '#DB2777', '#0891B2', '#65A30D']

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs max-w-[260px]">
      <p className="font-bold text-slate-800">{row.full}</p>
      <p className="font-semibold text-emerald-700">
        Rata-rata capaian: {row.capaian === null ? '-' : `${row.capaian.toFixed(2)}%`}
      </p>
      <p className="text-slate-500">{row.rencana} rencana • {row.terealisasi} terealisasi</p>
    </div>
  )
}

function DashboardAdmin({ onNavigate }) {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rencanaRows, setRencanaRows] = useState([])
  const [realisasiRows, setRealisasiRows] = useState([])
  const [periodeRows, setPeriodeRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')
  const [filterTriwulan, setFilterTriwulan] = useState('Semua')
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes, unitRes, cascRes, rencanaRes, realRes, periodeRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('cascading_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('rencana_aksi_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('realisasi_kinerja').select('*').order('tanggal_kegiatan', { ascending: false }),
      // Periode kinerja opsional: jangan gagalkan dashboard bila tabel belum ada.
      supabase.from('periode_kinerja').select('*').order('tanggal_mulai', { ascending: true }),
    ])
    const firstError = skRes.error || ikskRes.error || unitRes.error || cascRes.error || rencanaRes.error || realRes.error
    if (firstError) {
      if (firstError.code === '42P01') {
        setFetchError('Salah satu tabel belum ada (perkin_sk / perkin_iksk / unit_kerja / cascading_kinerja / rencana_aksi_kinerja / realisasi_kinerja). Jalankan seluruh file SQL di folder supabase/ secara berurutan di SQL Editor, kemudian Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${firstError.message}`)
      }
    } else {
      setSkList(skRes.data ?? [])
      setIkskList(ikskRes.data ?? [])
      setUnitList(unitRes.data ?? [])
      setCascadingRows(cascRes.data ?? [])
      setRencanaRows(rencanaRes.data ?? [])
      setRealisasiRows(realRes.data ?? [])
      // Abaikan error periode (tabel opsional untuk badge info).
      if (!periodeRes.error) setPeriodeRows(periodeRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const cascadingById = useMemo(() => Object.fromEntries(cascadingRows.map((c) => [c.id, c])), [cascadingRows])
  const unitById = useMemo(() => Object.fromEntries(unitList.map((u) => [u.id, u])), [unitList])

  const tahunOptions = useMemo(() => {
    const set = new Set([
      ...cascadingRows.map((c) => String(c.tahun_anggaran)),
      ...rencanaRows.map((r) => String(r.tahun_anggaran)),
      ...realisasiRows.map((r) => String(r.tahun_anggaran)),
    ])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [cascadingRows, rencanaRows, realisasiRows])

  // Agregasi level organisasi (rumus yang sama dengan Laporan Kinerja Organisasi).
  const { footer } = useMemo(() => computeOrganisasi({
    skList, ikskList, unitList, cascadingRows, rencanaRows, realisasiRows,
    filterTahun, filterTriwulan,
  }), [skList, ikskList, unitList, cascadingRows, rencanaRows, realisasiRows, filterTahun, filterTriwulan])

  // Agregasi per seksi: % realisasi + % capaian per rencana, dirata-rata per unit.
  // (fungsi bersama dengan grafik PublicPortal — satu sumber perhitungan)
  const perSeksi = useMemo(() => computePerSeksi({
    unitList, cascadingRows, rencanaRows, realisasiRows, ikskList,
    filterTahun, filterTriwulan,
  }), [unitList, cascadingRows, rencanaRows, realisasiRows, ikskList, filterTahun, filterTriwulan])

  const keyword = search.trim().toLowerCase()
  const visibleSeksi = useMemo(() => {
    if (!keyword) return perSeksi
    return perSeksi.filter((g) =>
      (g.unit.nama_unit ?? '').toLowerCase().includes(keyword) ||
      (g.unit.kode_unit ?? '').toLowerCase().includes(keyword) ||
      (g.unit.kepala_unit ?? '').toLowerCase().includes(keyword),
    )
  }, [perSeksi, keyword])

  const chartData = useMemo(() => perSeksi
    .filter((g) => g.rataCapaian !== null)
    .map((g, i) => ({
      unit: shortUnitName(g.unit.nama_unit),
      full: g.unit.nama_unit,
      capaian: Number(g.rataCapaian.toFixed(2)),
      rencana: g.rencana,
      terealisasi: g.terealisasi,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })), [perSeksi])

  // Kendala terbaru seluruh seksi (maks. 5).
  const kendalaTerbaru = useMemo(() => {
    const inTahun = (t) => filterTahun === 'Semua' || String(t) === String(filterTahun)
    const inTw = (tgl) => filterTriwulan === 'Semua' || triwulanOf(tgl) === filterTriwulan
    return realisasiRows
      .filter((e) => e.catatan_kendala && String(e.catatan_kendala).trim() !== '' && inTahun(e.tahun_anggaran) && inTw(e.tanggal_kegiatan))
      .sort((a, b) => String(b.tanggal_kegiatan ?? '').localeCompare(String(a.tanggal_kegiatan ?? '')))
      .slice(0, 5)
      .map((e) => {
        const rencana = rencanaRows.find((r) => r.id === e.rencana_aksi_id) || null
        const cascading = rencana ? cascadingById[rencana.cascading_id] || null : null
        const unit = cascading ? unitById[cascading.unit_kerja_id] || null : null
        return { entry: e, rencana, unit }
      })
  }, [realisasiRows, rencanaRows, cascadingById, unitById, filterTahun, filterTriwulan])

  const buktiInfo = useMemo(() => {
    const inTahun = (t) => filterTahun === 'Semua' || String(t) === String(filterTahun)
    const inTw = (tgl) => filterTriwulan === 'Semua' || triwulanOf(tgl) === filterTriwulan
    const docs = realisasiRows.filter((e) => e.bukti_path && inTahun(e.tahun_anggaran) && inTw(e.tanggal_kegiatan))
    return {
      count: docs.length,
      size: docs.reduce((s, e) => s + (Number(e.bukti_size) || 0), 0),
    }
  }, [realisasiRows, filterTahun, filterTriwulan])

  const unitsWithRencana = perSeksi.filter((g) => g.rencana > 0)
  const unitsLapor = unitsWithRencana.filter((g) => g.terealisasi > 0)
  const unitsBelumLapor = unitsWithRencana.filter((g) => g.terealisasi === 0)
  const kepatuhanPersen = unitsWithRencana.length > 0 ? (unitsLapor.length / unitsWithRencana.length) * 100 : null

  const periodeAktif = useMemo(() => {
    const list = periodeRows.filter((p) => p.status === 'Aktif')
    if (filterTahun !== 'Semua') {
      return list.find((p) => String(p.tahun_anggaran) === String(filterTahun)) ?? list[0] ?? null
    }
    return list[0] ?? null
  }, [periodeRows, filterTahun])

  const orgPredikat = predikat(footer.rataCapaian)
  // Target hitung selalu tahunan 100%; target triwulan hanya teks info.
  const targetTwInfo = filterTriwulan === 'Semua' ? null : TW_TARGET_PERSEN[filterTriwulan]
  const targetTwLabel = 'target tahunan 100%'

  const go = (page) => {
    if (onNavigate) onNavigate(page)
  }

  return (
    <div className="flex flex-col w-full">
      {/* Breadcrumb & header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-xs text-secondary font-label-md">
            <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Dashboard</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Evaluasi & Akuntabilitas Kinerja Satker
            </h1>
            <span className="px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              T.A {filterTahun === 'Semua' ? (tahunOptions[0] ?? '—') : filterTahun}
            </span>
            {filterTriwulan !== 'Semua' && (
              <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm uppercase font-bold tracking-wider">
                {filterTriwulan} • Target tahunan 100%{targetTwInfo !== null ? ` (info TW ${targetTwInfo}%)` : ''}
              </span>
            )}
            {periodeAktif && (
              <span className="px-space-xs py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm uppercase font-bold tracking-wider">
                {periodeAktif.nama_periode} • {periodeAktif.status}
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-secondary max-w-3xl">
            Seluruh angka dihitung langsung dari Supabase (PERKIN → Cascading → Rencana Aksi → Realisasi) —
            rumus capaian sama dengan Laporan Kinerja Seksi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs shrink-0">
          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() => go('laporan-kinerja')}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">assessment</span>
            Laporan Organisasi
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-error bg-error-container/40 p-space-md text-error">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <div className="flex-1">
            <h3 className="font-title-sm text-title-sm font-bold">Terjadi kesalahan</h3>
            <p className="font-body-sm text-body-sm">{fetchError}</p>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center gap-space-2xs rounded-lg border border-error/30 px-space-sm py-space-2xs font-body-sm text-body-sm font-bold hover:bg-error-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Muat ulang
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-end">
          <div className="md:col-span-3">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Tahun Anggaran</label>
            <div className="relative">
              <select
                value={filterTahun}
                onChange={(event) => setFilterTahun(event.target.value)}
                aria-label="Filter tahun"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Tahun</option>
                {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">filter_alt</span>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Periode Evaluasi</label>
            <div className="relative">
              <select
                value={filterTriwulan}
                onChange={(event) => setFilterTriwulan(event.target.value)}
                aria-label="Filter triwulan"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Triwulan</option>
                {TW_OPTIONS.map((t) => <option key={t} value={t}>{t} — target {TW_TARGET_PERSEN[t]}%</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</span>
            </div>
          </div>
          <div className="md:col-span-6">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Pencarian Seksi</label>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama / kode seksi / kepala unit..."
                aria-label="Cari seksi"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              />
              <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kartu ringkasan eksekutif (data real) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
        <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
          <div className="flex items-start justify-between mb-space-xs">
            <div>
              <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Indeks Kinerja Utama</span>
              <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Capaian Organisasi</h3>
            </div>
            <div className="p-space-2xs rounded-lg bg-primary-fixed text-on-primary-fixed">
              <span className="material-symbols-outlined text-[20px]">insights</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs my-space-xs flex-wrap">
            <span className="font-display-lg text-display-lg text-primary font-extrabold tracking-tight">
              {loading ? '…' : footer.persenCapaianOrg === null ? '-' : `${footer.persenCapaianOrg.toFixed(2)}%`}
            </span>
            <span className={`px-space-xs py-0.5 rounded font-label-sm font-bold uppercase ${orgPredikat.cls}`}>
              {orgPredikat.label}
            </span>
          </div>
          <div className="space-y-space-2xs pt-space-2xs">
            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, footer.persenCapaianOrg ?? 0)}%` }}></div>
            </div>
            <div className="flex justify-between font-label-sm text-secondary">
              <span>Rata-rata {footer.rataCapaian === null ? '-' : `${footer.rataCapaian.toFixed(2)}%`} ÷ {targetTwLabel}{targetTwInfo !== null ? ` (info ${filterTriwulan}: ${targetTwInfo}%)` : ''}</span>
              <span className="font-bold">{footer.ikskCount} IKSK</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-tertiary-container"></div>
          <div className="flex items-start justify-between mb-space-xs">
            <div>
              <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Keuangan Negara</span>
              <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Realisasi Anggaran</h3>
            </div>
            <div className="p-space-2xs rounded-lg bg-tertiary-fixed text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs my-space-xs">
            <span className="font-data-metric text-data-metric text-on-surface font-extrabold tracking-tight">
              {loading ? '…' : footer.persenRealisasiAnggaran === null ? '-' : `${footer.persenRealisasiAnggaran.toFixed(2)}%`}
            </span>
            <span className="font-label-md text-secondary">/ Terserap</span>
          </div>
          <div className="space-y-space-2xs pt-space-2xs">
            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
              <div className="bg-tertiary-container h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, footer.persenRealisasiAnggaran ?? 0)}%` }}></div>
            </div>
            <div className="flex justify-between font-label-sm text-secondary">
              <span className="font-bold text-on-surface">{formatRupiahShort(footer.jumlahRealisasi)}</span>
              <span>Pagu {formatRupiahShort(footer.jumlahAnggaran)}</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary"></div>
          <div className="flex items-start justify-between mb-space-xs">
            <div>
              <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Disiplin Administrasi</span>
              <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Kepatuhan Seksi</h3>
            </div>
            <div className="p-space-2xs rounded-lg bg-secondary-fixed text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs my-space-xs">
            <span className="font-data-metric text-data-metric text-on-surface font-extrabold tracking-tight">
              {loading ? '…' : `${unitsLapor.length} `}<span className="text-title-sm text-secondary font-semibold">/ {unitsWithRencana.length}</span>
            </span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-label-sm font-bold">
              {kepatuhanPersen === null ? '-' : `${kepatuhanPersen.toFixed(1)}% SUBMIT`}
            </span>
          </div>
          <div className="flex items-center gap-space-xs pt-space-2xs">
            <span className={`flex h-2.5 w-2.5 rounded-full ${unitsBelumLapor.length > 0 ? 'bg-error animate-ping' : 'bg-primary'}`}></span>
            <span className="font-label-sm text-secondary">
              {unitsBelumLapor.length > 0
                ? `${unitsBelumLapor.length} seksi belum ada realisasi (${unitsBelumLapor.slice(0, 2).map((g) => shortUnitName(g.unit.nama_unit)).join(', ')}${unitsBelumLapor.length > 2 ? '…' : ''})`
                : 'Seluruh seksi berhencana sudah melaporkan'}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary-container"></div>
          <div className="flex items-start justify-between mb-space-xs">
            <div>
              <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Eviden Lapangan</span>
              <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Bukti Dukung</h3>
            </div>
            <div className="p-space-2xs rounded-lg bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <div className="flex flex-col">
              <span className="font-data-metric text-data-metric text-primary font-extrabold">
                {loading ? '…' : buktiInfo.count}
              </span>
              <span className="font-label-sm text-secondary">Dokumen ({formatSize(buktiInfo.size)})</span>
            </div>
            <div className="w-px h-8 bg-outline-variant/30"></div>
            <div className="flex flex-col">
              <span className="font-data-metric text-data-metric text-error font-extrabold">
                {loading ? '…' : perSeksi.reduce((s, g) => s + g.kendala, 0)}
              </span>
              <span className="font-label-sm text-error font-medium">Kendala dilaporkan</span>
            </div>
          </div>
          <div className="pt-space-2xs flex justify-between font-label-sm text-secondary">
            <span>{footer.rencanaCount} rencana aksi total</span>
            <button type="button" onClick={() => go('bukti-dukung')} className="text-primary font-semibold hover:underline">Lihat arsip</button>
          </div>
        </div>
      </div>

      {/* Grafik + panel samping */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-lg">
        <div className="xl:col-span-8 p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-space-md">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Rata-rata Capaian per Seksi</h3>
              <p className="font-body-sm text-body-sm text-secondary">Ambang 100% — capping 0–120%, rumus sama dengan laporan seksi</p>
            </div>
            <button
              type="button" onClick={() => go('monitoring')}
              className="inline-flex items-center gap-space-2xs font-body-sm text-body-sm font-bold text-primary hover:underline shrink-0"
            >
              Detail monitoring
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          {loading ? (
            <p className="py-space-xl text-center font-body-sm text-body-sm text-secondary">Memuat grafik...</p>
          ) : chartData.length > 0 ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="unit" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} interval={0} angle={chartData.length > 5 ? -18 : 0} dy={chartData.length > 5 ? 12 : 0} height={chartData.length > 5 ? 56 : 30} />
                  <YAxis domain={[0, 120]} ticks={[0, 20, 40, 60, 80, 100, 120]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                  <ReferenceLine y={100} stroke="#059669" strokeDasharray="8 4" strokeWidth={2} label={{ value: 'Standar 100%', position: 'insideTopRight', fontSize: 11, fontWeight: 700, fill: '#047857' }} />
                  <Bar dataKey="capaian" name="Capaian" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((row) => (
                      <Cell key={row.full} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-space-xl text-center font-body-sm text-body-sm text-secondary">
              Belum ada capaian terhitung — seksi belum mengisi Rencana Aksi / Realisasi pada filter ini.
            </p>
          )}
        </div>

        <div className="xl:col-span-4 flex flex-col gap-space-lg">
          <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm">
            <div className="flex items-center justify-between mb-space-sm">
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface">Kendala Terbaru Seksi</h3>
              <span className="px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm font-bold">
                {kendalaTerbaru.length} terbaru
              </span>
            </div>
            {loading ? (
              <p className="font-body-sm text-body-sm text-secondary">Memuat...</p>
            ) : kendalaTerbaru.length > 0 ? (
              <div className="flex flex-col divide-y divide-surface-container">
                {kendalaTerbaru.map(({ entry, rencana, unit }) => (
                  <div key={entry.id} className="py-space-xs flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
                    <div className="min-w-0">
                      <div className="font-body-sm text-body-sm text-on-surface leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {String(entry.catatan_kendala).trim()}
                      </div>
                      <div className="font-label-sm text-label-sm text-secondary mt-0.5">
                        {unit?.nama_unit ?? '—'} • {rencana ? `${rencana.rencana_aksi.slice(0, 48)}${rencana.rencana_aksi.length > 48 ? '…' : ''} • ` : ''}{formatTanggal(entry.tanggal_kegiatan)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-secondary">Tidak ada kendala dilaporkan pada filter ini.</p>
            )}
            <button
              type="button" onClick={() => go('monitoring')}
              className="mt-space-md inline-flex items-center gap-space-2xs font-body-sm text-body-sm font-bold text-primary hover:underline"
            >
              Lihat semua di Monitoring
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="p-space-lg rounded-2xl bg-gradient-to-br from-primary-container via-primary to-surface-tint text-on-primary shadow-md">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed-dim">Serapan Anggaran Satker</span>
            <div className="font-display-lg text-display-lg font-extrabold text-on-primary mt-space-2xs">
              {loading ? '…' : formatRupiahShort(footer.jumlahRealisasi)}
            </div>
            <div className="w-full h-3 rounded-full bg-on-primary/20 overflow-hidden mt-space-md">
              <div className="h-full rounded-full bg-primary-fixed transition-all duration-500" style={{ width: `${Math.min(100, footer.persenRealisasiAnggaran ?? 0)}%` }} />
            </div>
            <div className="flex justify-between items-center mt-space-xs text-primary-fixed-dim font-label-sm text-label-sm">
              <span>dari {formatRupiahShort(footer.jumlahAnggaran)} pagu rencana</span>
              <span className="text-on-primary font-semibold">
                {footer.persenRealisasiAnggaran === null ? '-' : `${footer.persenRealisasiAnggaran.toFixed(1)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel rekap per seksi (data real) */}
      <div className="flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-low/50">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Rekapitulasi Kinerja Seksi & Subbagian</h2>
            <p className="font-body-sm text-body-sm text-secondary">
              {loading ? 'Memuat data...' : `${visibleSeksi.length} unit kerja • rata-rata capaian, serapan anggaran, kendala & bukti per seksi`}
            </p>
          </div>
          <button
            type="button" onClick={() => go('laporan-kinerja')}
            className="inline-flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-primary-container text-on-primary font-body-sm text-body-sm font-bold hover:bg-primary hover:text-on-primary transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">assessment</span>
            Laporan Organisasi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider">
                <th className="py-space-sm px-space-md font-semibold w-[52px]">No</th>
                <th className="py-space-sm px-space-md font-semibold">Unit / Seksi</th>
                <th className="py-space-sm px-space-md font-semibold text-center">Rencana</th>
                <th className="py-space-sm px-space-md font-semibold text-center">Rata-rata Capaian</th>
                <th className="py-space-sm px-space-md font-semibold text-center">Anggaran</th>
                <th className="py-space-sm px-space-md font-semibold text-center">Kendala</th>
                <th className="py-space-sm px-space-md font-semibold text-center">Bukti</th>
                <th className="py-space-sm px-space-md font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low text-on-surface font-body-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-space-xl px-space-md text-center text-secondary">
                    <span className="inline-flex items-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : visibleSeksi.length > 0 ? visibleSeksi.map((g, idx) => {
                const serapanPersen = g.anggaran > 0 ? (g.serapan / g.anggaran) * 100 : null
                const initials = g.unit.nama_unit.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                return (
                  <tr key={g.unit.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-space-sm px-space-md font-bold text-secondary">{idx + 1}</td>
                    <td className="py-space-sm px-space-md">
                      <div className="flex items-center gap-space-xs">
                        <div className="w-7 h-7 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-[11px] shrink-0">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-on-surface">{g.unit.nama_unit}</span>
                          <span className="font-label-sm text-secondary">
                            {g.unit.kode_unit}{g.unit.kepala_unit ? ` • ${g.unit.kepala_unit}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-space-sm px-space-md text-center font-semibold whitespace-nowrap">
                      <span className="text-primary">{g.terealisasi}</span>
                      <span className="text-secondary"> / {g.rencana}</span>
                    </td>
                    <td className="py-space-sm px-space-md">
                      {g.rataCapaian === null ? (
                        <span className="flex justify-center text-secondary">-</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1 min-w-[130px] mx-auto">
                          <span className="font-bold text-primary">{g.rataCapaian.toFixed(2)}%</span>
                          <div className="w-full max-w-[140px] bg-surface-container h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, g.rataCapaian)}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-space-sm px-space-md text-center whitespace-nowrap">
                      <span className="block font-semibold">{formatRupiahShort(g.serapan)} <span className="text-secondary font-normal">/ {formatRupiahShort(g.anggaran)}</span></span>
                      <span className="font-label-sm font-bold text-tertiary-container">
                        {serapanPersen === null ? '-' : `${serapanPersen.toFixed(1)}% terserap`}
                      </span>
                      <span className="sr-only">{formatRupiah(g.serapan)} dari {formatRupiah(g.anggaran)}</span>
                    </td>
                    <td className="py-space-sm px-space-md text-center">
                      {g.kendala > 0 ? (
                        <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm font-bold whitespace-nowrap">
                          <span className="material-symbols-outlined text-[13px]">warning</span>
                          {g.kendala} kendala
                        </span>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                    <td className="py-space-sm px-space-md text-center">
                      {g.bukti > 0 ? (
                        <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm font-bold whitespace-nowrap">
                          <span className="material-symbols-outlined text-[13px]">description</span>
                          {g.bukti} dok
                        </span>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                    <td className="py-space-sm px-space-md text-right">
                      <button
                        type="button" onClick={() => go('monitoring')} title="Lihat di Monitoring Kinerja"
                        className="p-1 rounded hover:bg-surface-container text-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="8" className="py-space-xl px-space-md text-center text-secondary">
                    <span className="inline-flex items-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search ? 'Tidak ada unit yang cocok dengan pencarian' : 'Belum ada data unit kerja'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-low/30">
          <span className="font-label-sm text-secondary">
            Menampilkan {visibleSeksi.length} dari {perSeksi.length} unit kerja • % capaian = rata-rata capaian rencana seksi (capping 0–120%)
          </span>
          <div className="flex items-center gap-space-2xs">
            <button type="button" onClick={() => go('monitoring')} className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high">
              Monitoring
            </button>
            <button type="button" onClick={() => go('bukti-dukung')} className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high">
              Bukti Dukung
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardAdmin
