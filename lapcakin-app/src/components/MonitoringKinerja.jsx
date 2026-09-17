import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { BuktiViewer } from './RealisasiKinerjaForm'

// ---------- Helper angka (konsisten dengan Input Realisasi / Laporan Seksi) ----------
function parseNum(str) {
  if (str === null || str === undefined) return NaN
  const m = String(str).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

// % realisasi target per rencana (dari nilai pengisian TERAKHIR — sama dengan
// tabel riwayat di Input Realisasi Kinerja, yang nilainya sudah akumulasi):
// Persen -> (total / target) * 100 capping 0..120;
// selain itu -> target - total.
function calcRealisasiPersen(total, target, satuan) {
  if (Number.isNaN(total)) return null
  if (satuan === 'Persen') {
    const t = parseNum(target)
    if (Number.isNaN(t) || t === 0) return null
    return Math.min(120, Math.max(0, (total / t) * 100))
  }
  const t = parseNum(target)
  if (Number.isNaN(t)) return null
  return t - total
}

// % capaian kinerja dari polaritas IKSK (capping 0..120):
// Positive -> (%realisasi / target tahunan) * 100
// Negative -> (2 * (target tahunan / %realisasi)) * 100
function calcCapaian(persenRealisasi, targetTahunan, polaritas) {
  if (persenRealisasi === null || persenRealisasi === undefined) return null
  const t = parseNum(targetTahunan)
  if (Number.isNaN(t)) return null
  let v
  if (polaritas === 'Negative') {
    if (persenRealisasi === 0) return null
    v = 2 * (t / persenRealisasi) * 100
  } else {
    if (t === 0) return null
    v = (persenRealisasi / t) * 100
  }
  if (!Number.isFinite(v)) return null
  return Math.min(120, Math.max(0, v))
}

function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return `Rp ${num.toLocaleString('id-ID')}`
}

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function triwulanOf(dateStr) {
  if (!dateStr) return null
  const m = new Date(`${dateStr}T00:00:00`).getMonth() + 1
  if (m >= 1 && m <= 3) return 'TW I'
  if (m >= 4 && m <= 6) return 'TW II'
  if (m >= 7 && m <= 9) return 'TW III'
  if (m >= 10 && m <= 12) return 'TW IV'
  return null
}

const TW_OPTIONS = ['TW I', 'TW II', 'TW III', 'TW IV']

function statusKeterangan(capaian, hasRealisasi, kendala) {
  if (!hasRealisasi) return { label: 'Belum ada realisasi', cls: 'bg-surface-container text-secondary' }
  if (capaian === null) return { label: 'Realisasi tercatat', cls: 'bg-secondary-container text-on-secondary-container' }
  if (capaian >= 100) return { label: 'Tercapai', cls: 'bg-primary-fixed/25 text-primary' }
  if (capaian >= 70) return { label: 'Mendekati target', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' }
  return { label: kendala ? 'Terkendala' : 'Belum tercapai', cls: 'bg-error-container text-on-error-container' }
}

function MonitoringKinerja() {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rencanaRows, setRencanaRows] = useState([])
  const [realisasiRows, setRealisasiRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')
  const [filterTriwulan, setFilterTriwulan] = useState('Semua')
  const [filterUnit, setFilterUnit] = useState('Semua')
  const [hanyaTerkendala, setHanyaTerkendala] = useState(false)
  const [viewerRow, setViewerRow] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes, unitRes, cascRes, rencanaRes, realRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('cascading_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('rencana_aksi_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('realisasi_kinerja').select('*').order('tanggal_kegiatan', { ascending: false }),
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
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && viewerRow) setViewerRow(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => {
    document.body.style.overflow = viewerRow ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [viewerRow])

  const skById = useMemo(() => Object.fromEntries(skList.map((s) => [s.id, s])), [skList])
  const ikskById = useMemo(() => Object.fromEntries(ikskList.map((i) => [i.id, i])), [ikskList])
  const cascadingById = useMemo(() => Object.fromEntries(cascadingRows.map((c) => [c.id, c])), [cascadingRows])
  const unitById = useMemo(() => Object.fromEntries(unitList.map((u) => [u.id, u])), [unitList])

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  const tahunOptions = useMemo(() => {
    const set = new Set([
      ...rencanaRows.map((r) => String(r.tahun_anggaran)),
      ...realisasiRows.map((r) => String(r.tahun_anggaran)),
    ])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [rencanaRows, realisasiRows])

  // Satu baris rekap per rencana aksi SELURUH seksi.
  const recap = useMemo(() => {
    const scoped = rencanaRows
      .map((r) => ({ ...r, cascading: cascadingById[r.cascading_id] || null }))
      .filter((r) => {
        if (filterTahun !== 'Semua' && String(r.tahun_anggaran) !== String(filterTahun)) return false
        if (filterUnit !== 'Semua' && r.cascading?.unit_kerja_id !== filterUnit) return false
        return true
      })
      .map((r) => {
        const iksk = r.cascading ? ikskById[r.cascading.iksk_id] || null : null
        const sk = iksk ? skById[iksk.sk_id] || null : null
        const unit = r.cascading ? unitById[r.cascading.unit_kerja_id] || null : null
        // Riwayat realisasi rencana ini (ikut filter triwulan + tahun).
        const entries = realisasiRows.filter((e) => {
          if (e.rencana_aksi_id !== r.id) return false
          if (filterTahun !== 'Semua' && String(e.tahun_anggaran) !== String(filterTahun)) return false
          if (filterTriwulan !== 'Semua' && triwulanOf(e.tanggal_kegiatan) !== filterTriwulan) return false
          return true
        })
        // % diambil dari pengisian TERAKHIR (waktu input) — nilai tersimpan
        // sudah akumulasi sehingga JANGAN dijumlah lagi (double-count).
        // Sama persis dengan 1 baris per rencana di tabel riwayat.
        const byInputTerakhir = (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        const latestEntry = [...entries].sort(byInputTerakhir)[0] ?? null
        const total = latestEntry ? parseNum(latestEntry.realisasi_kinerja) : NaN
        const persen = calcRealisasiPersen(total, r.target_kinerja, r.satuan)
        const angNums = entries.map((e) => (e.realisasi_anggaran === null ? NaN : Number(e.realisasi_anggaran))).filter((n) => !Number.isNaN(n))
        const totalAnggaran = angNums.length > 0 ? angNums.reduce((a, b) => a + b, 0) : null
        const capaian = calcCapaian(persen, iksk?.target_tahunan, iksk?.polaritas ?? 'Positive')
        // Keterangan = seluruh isian seksi pada form Kendala dan Hambatan (catatan_kendala).
        const kendalaList = entries
          .filter((e) => e.catatan_kendala && String(e.catatan_kendala).trim() !== '')
          .map((e) => ({
            id: e.id,
            teks: String(e.catatan_kendala).trim(),
            tanggal: e.tanggal_kegiatan,
            realisasi: e.realisasi_kinerja,
          }))
        const bukti = entries.filter((e) => e.bukti_path)
        return { rencana: r, cascading: r.cascading, iksk, sk, unit, entries, persen, totalAnggaran, capaian, kendalaList, bukti }
      })
      .sort((a, b) => {
        const unitA = a.unit?.nama_unit ?? 'zzz'
        const unitB = b.unit?.nama_unit ?? 'zzz'
        if (unitA !== unitB) return unitA.localeCompare(unitB, 'id')
        const skA = a.sk?.nomor ?? 999
        const skB = b.sk?.nomor ?? 999
        if (skA !== skB) return skA - skB
        return (a.iksk?.nomor_urut ?? 999) - (b.iksk?.nomor_urut ?? 999)
      })

    const keyword = search.trim().toLowerCase()
    let out = scoped
    if (keyword) {
      out = out.filter((row) =>
        (row.rencana.rencana_aksi ?? '').toLowerCase().includes(keyword) ||
        (row.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (row.sk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (row.unit?.nama_unit ?? '').toLowerCase().includes(keyword) ||
        row.kendalaList.some((k) => k.teks.toLowerCase().includes(keyword)),
      )
    }
    if (hanyaTerkendala) {
      out = out.filter((row) => row.kendalaList.length > 0)
    }
    return out
  }, [rencanaRows, cascadingById, ikskById, skById, unitById, realisasiRows, filterTahun, filterTriwulan, filterUnit, search, hanyaTerkendala])

  const summary = useMemo(() => {
    const capaians = recap.map((r) => r.capaian).filter((c) => c !== null)
    const unitIds = new Set(recap.map((r) => r.cascading?.unit_kerja_id).filter(Boolean))
    return {
      seksi: unitIds.size,
      rencana: recap.length,
      terealisasi: recap.filter((r) => r.entries.length > 0).length,
      terkendala: recap.filter((r) => r.kendalaList.length > 0).length,
      rataCapaian: capaians.length > 0 ? capaians.reduce((a, b) => a + b, 0) / capaians.length : null,
    }
  }, [recap])

  // Ringkasan per seksi untuk panel monitoring cepat.
  const perSeksi = useMemo(() => {
    const map = new Map()
    for (const row of recap) {
      const unitId = row.cascading?.unit_kerja_id ?? 'tanpa-unit'
      if (!map.has(unitId)) {
        map.set(unitId, {
          unitId,
          unitNama: row.unit?.nama_unit ?? 'Tanpa unit kerja',
          rencana: 0,
          terealisasi: 0,
          terkendala: 0,
          capaians: [],
        })
      }
      const g = map.get(unitId)
      g.rencana += 1
      if (row.entries.length > 0) g.terealisasi += 1
      if (row.kendalaList.length > 0) g.terkendala += 1
      if (row.capaian !== null) g.capaians.push(row.capaian)
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        rataCapaian: g.capaians.length > 0 ? g.capaians.reduce((a, b) => a + b, 0) / g.capaians.length : null,
      }))
      .sort((a, b) => a.unitNama.localeCompare(b.unitNama, 'id'))
  }, [recap])

  return (
    <div className="max-w-[1720px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Monitoring Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Monitoring Kinerja</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">monitoring</span>
              {recap.length} Rencana • {summary.seksi} Seksi
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-space-xs">
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
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Cetak Monitoring
            </button>
          </div>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Rekap capaian seluruh seksi yang ditarik otomatis dari Rencana Aksi dan Realisasi Kinerja.
          Kolom <span className="font-bold text-on-surface">Keterangan</span> menampilkan persis isian seksi
          pada form <span className="font-bold text-on-surface">Kendala dan Hambatan</span> (catatan_kendala).
        </p>
      </div>

      {/* Ringkasan eksekutif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md mb-space-lg">
        {[
          { label: 'Seksi Termonitor', value: String(summary.seksi), icon: 'apartment' },
          { label: 'Total Rencana', value: String(summary.rencana), icon: 'checklist' },
          { label: 'Rencana Terealisasi', value: String(summary.terealisasi), icon: 'task_alt' },
          { label: 'Rencana Terkendala', value: String(summary.terkendala), icon: 'warning' },
          { label: 'Rata-rata Capaian', value: summary.rataCapaian === null ? '-' : `${summary.rataCapaian.toFixed(2)}%`, icon: 'analytics' },
        ].map((c) => (
          <div key={c.label} className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="font-label-sm text-label-sm text-secondary uppercase font-bold truncate">{c.label}</div>
              <div className="font-data-metric text-data-metric text-on-surface truncate">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ringkasan per seksi */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden mb-space-lg">
        <div className="p-space-md pb-0">
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Capaian per Seksi</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            Agregat rencana, realisasi, kendala, dan rata-rata capaian tiap unit kerja
          </p>
        </div>
        <div className="overflow-x-auto mt-space-sm">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Unit / Seksi</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Rencana</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Terealisasi</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Terkendala</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[180px]">Rata-rata Capaian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : perSeksi.length > 0 ? perSeksi.map((g, idx) => (
                <tr key={g.unitId} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm font-bold text-on-surface">{g.unitNama}</td>
                  <td className="px-space-md py-space-sm text-center font-body-sm text-body-sm font-bold">{g.rencana}</td>
                  <td className="px-space-md py-space-sm text-center font-body-sm text-body-sm font-bold text-primary-container">
                    {g.terealisasi} / {g.rencana}
                  </td>
                  <td className="px-space-md py-space-sm text-center">
                    {g.terkendala > 0 ? (
                      <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm font-bold">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        {g.terkendala} kendala
                      </span>
                    ) : (
                      <span className="font-body-sm text-body-sm text-secondary">-</span>
                    )}
                  </td>
                  <td className="px-space-md py-space-sm">
                    {g.rataCapaian === null ? (
                      <span className="text-secondary">-</span>
                    ) : (
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="font-bold text-primary">{g.rataCapaian.toFixed(2)}%</span>
                        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, g.rataCapaian)}%` }} />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    Belum ada data cascading / rencana untuk ditampilkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      {/* Toolbar filter */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Tabel Rekap Capaian Seluruh Seksi</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${recap.length} baris rekap`}
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-space-sm w-full xl:w-auto">
          <div className="relative">
            <select
              value={filterTahun}
              onChange={(event) => setFilterTahun(event.target.value)}
              aria-label="Filter tahun"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
            >
              <option value="Semua">Semua Tahun</option>
              {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">filter_alt</span>
          </div>
          <div className="relative">
            <select
              value={filterTriwulan}
              onChange={(event) => setFilterTriwulan(event.target.value)}
              aria-label="Filter triwulan"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
            >
              <option value="Semua">Semua Triwulan</option>
              {TW_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</span>
          </div>
          <div className="relative">
            <select
              value={filterUnit}
              onChange={(event) => setFilterUnit(event.target.value)}
              aria-label="Filter seksi"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none max-w-[280px]"
            >
              <option value="Semua">Semua Seksi</option>
              {unitList.map((u) => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">apartment</span>
          </div>
          <div className="relative w-full lg:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari seksi / IKSK / rencana / kendala..."
              aria-label="Cari rekap"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
          <label className="inline-flex items-center gap-space-2xs h-[42px] px-space-sm rounded-lg border border-outline-variant bg-surface font-body-sm text-body-sm font-semibold text-secondary cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={hanyaTerkendala}
              onChange={(event) => setHanyaTerkendala(event.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            Hanya terkendala
          </label>
        </div>
      </div>

      {/* Tabel rekap */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1780px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Unit / Seksi</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK / Rencana Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">Target</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">% Realisasi Target</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[160px]">Anggaran / Realisasi</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">% Capaian Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary min-w-[280px]">Keterangan (Kendala & Hambatan Seksi)</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Bukti Dukung</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : recap.length > 0 ? recap.map((row, idx) => {
                const st = statusKeterangan(row.capaian, row.entries.length > 0, row.kendalaList.length > 0)
                return (
                  <tr key={row.rencana.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors align-top">
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                    <td className="px-space-md py-space-sm max-w-[220px]">
                      <span className="font-body-sm text-body-sm font-bold text-on-surface">{row.unit?.nama_unit ?? 'Tanpa unit kerja'}</span>
                      {row.sk && (
                        <span className="block font-body-sm text-body-sm text-secondary">
                          <span className="font-mono font-bold text-primary">{row.sk.nomor}.</span> {row.sk.uraian}
                        </span>
                      )}
                      <span className="block font-label-sm text-label-sm text-secondary mt-1">TA {row.rencana.tahun_anggaran}</span>
                    </td>
                    <td className="px-space-md py-space-sm font-mono font-bold text-primary whitespace-nowrap">
                      {row.iksk ? ikskNumber(row.iksk) : '-'}
                    </td>
                    <td className="px-space-md py-space-sm max-w-[300px]">
                      {row.iksk
                        ? <>
                          <span className="font-body-sm text-body-sm text-on-surface">{row.iksk.uraian}</span>
                          <span className="block font-body-sm text-body-sm text-secondary mt-1">
                            Rencana: <span className="font-semibold text-on-surface">{row.rencana.rencana_aksi}</span>
                          </span>
                        </>
                        : <span className="font-body-sm text-body-sm text-error">IKSK terhapus</span>}
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <span className="font-body-sm text-body-sm font-extrabold text-on-surface">{row.rencana.target_kinerja}</span>
                      <span className="ml-1 font-label-sm text-label-sm text-secondary">({row.rencana.satuan})</span>
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      {row.persen === null ? (
                        <span className="text-secondary">-</span>
                      ) : row.rencana.satuan === 'Persen' ? (
                        <div className="flex flex-col gap-1 min-w-[100px]" title="(%realisasi / target) × 100, capping 0–120%">
                          <span className="font-bold text-primary-container">{row.persen.toFixed(2)}%</span>
                          <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                            <div className="h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, row.persen)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="font-bold text-tertiary-container" title="target − realisasi">
                          {Number.isInteger(row.persen) ? String(row.persen) : row.persen.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <span className="block font-body-sm text-body-sm text-secondary">Rencana: <span className="font-bold text-on-surface">{formatRupiah(row.rencana.anggaran)}</span></span>
                      <span className="block font-body-sm text-body-sm text-secondary">Realisasi: <span className="font-bold text-on-surface">{row.totalAnggaran === null ? '-' : formatRupiah(row.totalAnggaran)}</span></span>
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      {row.capaian === null ? (
                        <span className="text-secondary" title="Butuh % realisasi dan target tahunan berupa angka">-</span>
                      ) : (
                        <span
                          className="font-bold text-primary"
                          title={row.iksk?.polaritas === 'Negative'
                            ? `(2 × (target tahunan / %realisasi)) × 100, capping 0–120% [Negative]`
                            : `(%realisasi / target tahunan) × 100, capping 0–120% [Positive]`}
                        >
                          {row.capaian.toFixed(2)}%
                        </span>
                      )}
                      <span className={`mt-1 flex w-fit items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-space-md py-space-sm max-w-[360px] min-w-[280px]">
                      {row.kendalaList.length > 0 ? (
                        <ul className="flex flex-col gap-space-2xs">
                          {row.kendalaList.map((k) => (
                            <li key={k.id} className="rounded-lg bg-error-container/30 border border-error/20 px-space-sm py-space-2xs">
                              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{k.teks}</p>
                              <p className="font-label-sm text-label-sm text-secondary mt-1">
                                {formatTanggal(k.tanggal)}{k.realisasi ? ` • realisasi: ${k.realisasi}` : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="font-body-sm text-body-sm text-secondary italic">
                          {row.entries.length > 0 ? 'Tidak ada kendala dilaporkan seksi.' : 'Belum ada realisasi / kendala dari seksi.'}
                        </span>
                      )}
                    </td>
                    <td className="px-space-md py-space-sm">
                      {row.bukti.length > 0 ? (
                        <div className="flex items-center justify-center gap-space-2xs flex-wrap">
                          <span className="w-full text-center font-label-sm text-label-sm font-bold text-secondary">{row.bukti.length} dok</span>
                          {row.bukti.map((b) => (
                            <button
                              key={b.id}
                              type="button" onClick={() => setViewerRow(b)}
                              className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-primary hover:bg-surface-container transition-colors"
                              title={`Lihat ${b.bukti_nama || 'bukti dukung'}`}
                              aria-label="Lihat bukti dukung"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-secondary">-</div>
                      )}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="10" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua' || filterUnit !== 'Semua' || hanyaTerkendala
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada rencana aksi — seksi belum mengisi Rencana Aksi Kinerja'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-secondary font-label-sm text-label-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-container">info</span>
            <span>% Capaian Positive = (%realisasi / target tahunan) × 100; Negative = (2 × (target tahunan / %realisasi)) × 100; capping 0–120%.</span>
          </div>
          <span>Kolom Keterangan = isian apa adanya dari form Kendala dan Hambatan tiap seksi.</span>
        </div>
      </div>

      {viewerRow && (
        <BuktiViewer row={viewerRow} onClose={() => setViewerRow(null)} />
      )}
    </div>
  )
}

export default MonitoringKinerja
