import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchBuktiMap } from '../lib/buktiFiles'
import { BuktiViewer } from './RealisasiKinerjaForm'

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '-'
  const n = Number(bytes)
  if (Number.isNaN(n)) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
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

const JENIS_OPTIONS = [
  { id: 'Semua', label: 'Semua Jenis' },
  { id: 'pdf', label: 'PDF' },
  { id: 'excel', label: 'Excel (xls/xlsx)' },
  { id: 'gambar', label: 'Gambar (jpg/png)' },
]

function docKind(nama) {
  const ext = (nama?.split('.').pop() ?? '').toLowerCase()
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'gambar'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx'].includes(ext)) return 'excel'
  return 'lainnya'
}

function docIcon(nama) {
  const ext = (nama?.split('.').pop() ?? '').toLowerCase()
  if (['jpg', 'jpeg', 'png'].includes(ext)) return { icon: 'image', box: 'bg-tertiary-fixed text-tertiary' }
  if (ext === 'pdf') return { icon: 'picture_as_pdf', box: 'bg-error-container text-on-error-container' }
  if (['xls', 'xlsx'].includes(ext)) return { icon: 'table_chart', box: 'bg-primary-container/25 text-primary' }
  return { icon: 'description', box: 'bg-surface-container text-secondary' }
}

function publicBuktiUrl(path) {
  if (!path) return '#'
  return supabase.storage.from('bukti-dukung').getPublicUrl(path).data.publicUrl
}

// Unduh satu berkas: coba via Storage API (memicu unduhan berkas),
// fallback ke URL publik bila bucket privat / API gagal.
async function downloadSingle(entry, onError) {
  const fallback = () => {
    const a = document.createElement('a')
    a.href = publicBuktiUrl(entry.bukti_path)
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.download = entry.bukti_nama || 'bukti-dukung'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  try {
    const { data, error } = await supabase.storage.from('bukti-dukung').download(entry.bukti_path)
    if (error || !data) {
      fallback()
      return
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.bukti_nama || entry.bukti_path.split('/').pop() || 'bukti-dukung'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (err) {
    if (onError) onError(err)
    fallback()
  }
}

function BuktiDukungOrganisasi() {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rencanaRows, setRencanaRows] = useState([])
  const [realisasiRows, setRealisasiRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')
  const [filterTriwulan, setFilterTriwulan] = useState('Semua')
  const [filterUnit, setFilterUnit] = useState('Semua')
  const [filterJenis, setFilterJenis] = useState('Semua')
  const [selectedFolderKey, setSelectedFolderKey] = useState('all')
  const [viewerRow, setViewerRow] = useState(null)
  const [viewerFiles, setViewerFiles] = useState([])
  const [buktiMap, setBuktiMap] = useState(new Map())

  const openViewer = (entry) => {
    setViewerRow(entry)
    setViewerFiles(entry._files ?? [])
  }
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadingFolder, setDownloadingFolder] = useState(false)

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
      try {
        setBuktiMap(await fetchBuktiMap((realRes.data ?? []).map((r) => r.id)))
      } catch {
        setBuktiMap(new Map())
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && viewerRow) { setViewerRow(null); setViewerFiles([]) }
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
  const rencanaById = useMemo(() => Object.fromEntries(rencanaRows.map((r) => [r.id, r])), [rencanaRows])
  const unitById = useMemo(() => Object.fromEntries(unitList.map((u) => [u.id, u])), [unitList])

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  const tahunOptions = useMemo(() => {
    const set = new Set(realisasiRows.map((r) => String(r.tahun_anggaran)))
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [realisasiRows])

  // Seluruh dokumen bukti dari semua seksi — satu baris per BERKAS
  // (multi-dokumen), fallback ke kolom legacy bila tabel anak belum ada.
  const documents = useMemo(() => realisasiRows
    .flatMap((e) => {
      const files = buktiMap.get(e.id) ?? (e.bukti_path ? [{
        id: `legacy-${e.id}`,
        bukti_path: e.bukti_path,
        bukti_nama: e.bukti_nama,
        bukti_tipe: e.bukti_tipe,
        bukti_size: e.bukti_size,
      }] : [])
      return files.map((f) => ({ parent: e, file: f }))
    })
    .map(({ parent: e, file: f }) => {
      const rencana = rencanaById[e.rencana_aksi_id] || null
      const cascading = rencana ? cascadingById[rencana.cascading_id] || null : null
      const iksk = cascading ? ikskById[cascading.iksk_id] || null : null
      const sk = iksk ? skById[iksk.sk_id] || null : null
      const unit = cascading ? unitById[cascading.unit_kerja_id] || null : null
      const filesOfParent = buktiMap.get(e.id) ?? (e.bukti_path ? [{
        id: `legacy-${e.id}`,
        bukti_path: e.bukti_path,
        bukti_nama: e.bukti_nama,
        bukti_tipe: e.bukti_tipe,
        bukti_size: e.bukti_size,
      }] : [])
      const entry = { ...e, bukti_path: f.bukti_path, bukti_nama: f.bukti_nama, bukti_tipe: f.bukti_tipe, bukti_size: f.bukti_size, _files: filesOfParent, _fileId: f.id }
      return { entry, rencana, cascading, iksk, sk, unit }
    })
    .filter((d) => {
      if (filterTahun !== 'Semua' && String(d.entry.tahun_anggaran) !== String(filterTahun)) return false
      if (filterTriwulan !== 'Semua' && triwulanOf(d.entry.tanggal_kegiatan) !== filterTriwulan) return false
      if (filterUnit !== 'Semua' && d.cascading?.unit_kerja_id !== filterUnit) return false
      if (filterJenis !== 'Semua' && docKind(d.entry.bukti_nama) !== filterJenis) return false
      return true
    }), [realisasiRows, rencanaById, cascadingById, ikskById, skById, unitById, filterTahun, filterTriwulan, filterUnit, filterJenis, buktiMap])

  // Kelompokkan per folder nomor IKSK.
  const folders = useMemo(() => {
    const map = new Map()
    for (const d of documents) {
      const key = d.iksk?.id ?? `unknown-${d.cascading?.id ?? d.entry.id}`
      if (!map.has(key)) {
        map.set(key, { key, iksk: d.iksk, sk: d.sk, docs: [], totalSize: 0, seksiSet: new Set() })
      }
      const f = map.get(key)
      f.docs.push(d)
      f.totalSize += Number(d.entry.bukti_size) || 0
      if (d.unit?.nama_unit) f.seksiSet.add(d.unit.nama_unit)
      else if (d.cascading?.unit_kerja_id) f.seksiSet.add(d.cascading.unit_kerja_id)
    }
    return [...map.values()]
      .map((f) => ({ ...f, seksiNames: [...f.seksiSet] }))
      .sort((a, b) => {
        const skA = a.sk?.nomor ?? 999
        const skB = b.sk?.nomor ?? 999
        if (skA !== skB) return skA - skB
        return (a.iksk?.nomor_urut ?? 999) - (b.iksk?.nomor_urut ?? 999)
      })
  }, [documents])

  const keyword = search.trim().toLowerCase()
  const visibleDocs = useMemo(() => {
    let list = selectedFolderKey === 'all'
      ? documents
      : documents.filter((d) => (d.iksk?.id ?? `unknown-${d.cascading?.id ?? d.entry.id}`) === selectedFolderKey)
    if (keyword) {
      list = list.filter((d) =>
        (d.entry.bukti_nama ?? '').toLowerCase().includes(keyword) ||
        (d.rencana?.rencana_aksi ?? '').toLowerCase().includes(keyword) ||
        (d.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (d.unit?.nama_unit ?? '').toLowerCase().includes(keyword),
      )
    }
    return [...list].sort((a, b) => String(b.entry.tanggal_kegiatan ?? '').localeCompare(String(a.entry.tanggal_kegiatan ?? '')))
  }, [documents, selectedFolderKey, keyword])

  const totalSize = useMemo(() => documents.reduce((s, d) => s + (Number(d.entry.bukti_size) || 0), 0), [documents])

  const resetFolder = () => setSelectedFolderKey('all')

  const handleDownloadOne = async (entry) => {
    if (downloadingId) return
    setDownloadingId(entry._fileId ?? entry.id)
    setDownloadError('')
    try {
      await downloadSingle(entry, (err) => setDownloadError(`Gagal mengunduh ${entry.bukti_nama ?? 'dokumen'}: ${err.message ?? err}`))
    } finally {
      setDownloadingId(null)
    }
  }

  // Unduh seluruh dokumen dalam folder terpilih (atau yang tampil) satu per satu.
  const handleDownloadFolder = async () => {
    if (downloadingFolder || visibleDocs.length === 0) return
    setDownloadingFolder(true)
    setDownloadError('')
    try {
      for (const d of visibleDocs) {
        await downloadSingle(d.entry)
        await new Promise((resolve) => { setTimeout(resolve, 350) })
      }
    } catch (err) {
      setDownloadError(`Unduhan folder terhenti: ${err.message ?? err}`)
    } finally {
      setDownloadingFolder(false)
    }
  }

  const activeFolder = selectedFolderKey === 'all' ? null : folders.find((f) => f.key === selectedFolderKey) ?? null

  return (
    <div className="max-w-[1720px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Bukti Dukung</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Bukti Dukung Organisasi</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">folder_copy</span>
              {folders.length} Folder • {documents.length} Dokumen • {formatSize(totalSize)}
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
              onClick={handleDownloadFolder}
              disabled={downloadingFolder || visibleDocs.length === 0}
              title={selectedFolderKey === 'all' ? 'Unduh semua dokumen yang tampil' : 'Unduh seluruh dokumen dalam folder ini'}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">{downloadingFolder ? 'progress_activity' : 'folder_zip'}</span>
              {downloadingFolder ? 'Mengunduh...' : selectedFolderKey === 'all' ? 'Unduh Tampilan' : 'Unduh Folder'}
            </button>
          </div>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Arsip bukti dukung seluruh seksi, dikelompokkan per folder nomor IKSK.
          Klik folder untuk melihat isinya, pratinjau tiap dokumen, atau unduh per berkas maupun satu folder sekaligus.
        </p>
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

      {downloadError && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-error bg-error-container/40 p-space-md text-error">
          <span className="material-symbols-outlined text-[20px]">download</span>
          <p className="font-body-sm text-body-sm flex-1">{downloadError}</p>
          <button
            type="button"
            onClick={() => setDownloadError('')}
            className="inline-flex items-center rounded-lg border border-error/30 px-space-sm py-space-2xs font-body-sm text-body-sm font-bold hover:bg-error-container transition-colors"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar filter */}
      <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-end">
          <div className="md:col-span-2">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Tahun</label>
            <div className="relative">
              <select
                value={filterTahun}
                onChange={(event) => { setFilterTahun(event.target.value); resetFolder() }}
                aria-label="Filter tahun"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Tahun</option>
                {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">filter_alt</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Triwulan</label>
            <div className="relative">
              <select
                value={filterTriwulan}
                onChange={(event) => { setFilterTriwulan(event.target.value); resetFolder() }}
                aria-label="Filter triwulan"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Triwulan</option>
                {TW_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</span>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Seksi</label>
            <div className="relative">
              <select
                value={filterUnit}
                onChange={(event) => { setFilterUnit(event.target.value); resetFolder() }}
                aria-label="Filter seksi"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Seksi</option>
                {unitList.map((u) => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">apartment</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Jenis Berkas</label>
            <div className="relative">
              <select
                value={filterJenis}
                onChange={(event) => { setFilterJenis(event.target.value); resetFolder() }}
                aria-label="Filter jenis berkas"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                {JENIS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">description</span>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Pencarian</label>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari dokumen / rencana / IKSK / seksi..."
                aria-label="Cari dokumen"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              />
              <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
            </div>
          </div>
        </div>
      </div>

      {/* Folder per nomor IKSK */}
      <div className="flex items-center justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Folder IKSK</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${folders.length} folder • klik folder untuk melihat isinya`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-space-xl text-center font-body-sm text-body-sm text-secondary mb-space-lg">
          <span className="flex items-center justify-center gap-space-2xs">
            <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
            Memuat data dari Supabase...
          </span>
        </div>
      ) : folders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md mb-space-lg">
          {folders.map((f) => {
            const active = selectedFolderKey === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setSelectedFolderKey(active ? 'all' : f.key)}
                aria-pressed={active}
                className={`text-left p-space-md rounded-2xl shadow-sm border-2 transition-all hover:shadow-md ${
                  active ? 'bg-primary-fixed/15 border-primary' : 'bg-surface-container-lowest border-transparent hover:border-outline-variant'
                }`}
              >
                <div className="flex items-start gap-space-sm">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'}`}>
                    <span className="material-symbols-outlined text-[26px]">folder</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-primary text-body-sm">
                      Folder IKSK {f.iksk ? ikskNumber(f.iksk) : '-'}
                    </div>
                    <div className="font-body-sm text-body-sm font-bold text-on-surface leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {f.iksk?.uraian ?? 'IKSK terhapus'}
                    </div>
                    {f.sk && (
                      <div className="font-body-sm text-body-sm text-secondary truncate">
                        SK {f.sk.nomor} — {f.sk.uraian}
                      </div>
                    )}
                    <div className="font-label-sm text-label-sm text-secondary mt-1 truncate" title={f.seksiNames.join(', ')}>
                      {f.seksiNames.length > 0 ? f.seksiNames.join(', ') : '—'}
                    </div>
                    <div className="flex flex-wrap items-center gap-space-xs mt-space-2xs font-label-sm text-label-sm text-secondary font-bold">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        {f.docs.length} dokumen
                      </span>
                      <span>•</span>
                      <span>{f.seksiNames.length} seksi</span>
                      <span>•</span>
                      <span>{formatSize(f.totalSize)}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-space-xl text-center font-body-sm text-body-sm text-secondary mb-space-lg">
          <span className="flex items-center justify-center gap-space-2xs">
            <span className="material-symbols-outlined text-[24px]">folder_off</span>
            {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua' || filterUnit !== 'Semua' || filterJenis !== 'Semua'
              ? 'Tidak ada dokumen yang cocok dengan filter'
              : 'Belum ada dokumen bukti dukung — seksi mengunggah melalui Input Realisasi Kinerja'}
          </span>
        </div>
      )}

      {/* Isi folder */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
            {activeFolder ? `Isi Folder IKSK ${ikskNumber(activeFolder.iksk)}` : 'Semua Dokumen'}
          </h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {activeFolder ? `${activeFolder.iksk?.uraian ?? ''} • ` : ''}{visibleDocs.length} dokumen ditampilkan
          </p>
        </div>
        {selectedFolderKey !== 'all' && (
          <button
            type="button" onClick={resetFolder}
            className="inline-flex items-center gap-space-2xs h-[38px] rounded-lg border border-outline-variant px-space-sm font-body-sm text-body-sm font-bold text-secondary hover:bg-surface-container transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">folder_open</span>
            Semua folder
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Nama Dokumen</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Seksi</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Folder IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Rencana Aksi</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">Tanggal / TW</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : visibleDocs.length > 0 ? visibleDocs.map((d, idx) => {
                const meta = docIcon(d.entry.bukti_nama)
                const isDownloading = downloadingId === (d.entry._fileId ?? d.entry.id)
                return (
                  <tr key={d.entry._fileId ?? d.entry.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                    <td className="px-space-md py-space-sm">
                      <div className="flex items-center gap-space-sm">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.box}`}>
                          <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-body-sm text-body-sm font-bold text-on-surface truncate max-w-[300px]" title={d.entry.bukti_nama}>{d.entry.bukti_nama}</div>
                          <div className="font-label-sm text-label-sm text-secondary">{formatSize(d.entry.bukti_size)}{d.entry.bukti_tipe ? ` • ${d.entry.bukti_tipe}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-space-md py-space-sm max-w-[200px]">
                      <span className="font-body-sm text-body-sm font-bold text-on-surface">{d.unit?.nama_unit ?? '—'}</span>
                      <span className="block font-label-sm text-label-sm text-secondary">TA {d.entry.tahun_anggaran}</span>
                    </td>
                    <td className="px-space-md py-space-sm max-w-[240px]">
                      <span className="font-mono font-bold text-primary text-body-sm">
                        IKSK {d.iksk ? ikskNumber(d.iksk) : '-'}
                      </span>
                      <span className="block font-body-sm text-body-sm text-secondary truncate" title={d.iksk?.uraian ?? ''}>
                        {d.iksk?.uraian ?? 'IKSK terhapus'}
                      </span>
                    </td>
                    <td className="px-space-md py-space-sm max-w-[280px] font-body-sm text-body-sm text-secondary">
                      {d.rencana?.rencana_aksi ?? <span className="italic">Rencana terhapus</span>}
                      <span className="block">Realisasi: <span className="font-bold text-on-surface">{d.entry.realisasi_kinerja}</span></span>
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary whitespace-nowrap">
                      {formatTanggal(d.entry.tanggal_kegiatan)}
                      {triwulanOf(d.entry.tanggal_kegiatan) && (
                        <span className="ml-2 inline-flex items-center px-space-xs py-0.5 rounded-full bg-surface-container font-label-sm font-bold">
                          {triwulanOf(d.entry.tanggal_kegiatan)}
                        </span>
                      )}
                    </td>
                    <td className="px-space-md py-space-sm">
                      <div className="flex items-center justify-center gap-space-2xs">
                        <button
                          type="button" onClick={() => openViewer(d.entry)}
                          className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-primary hover:bg-surface-container transition-colors"
                          title={`Pratinjau ${d.entry.bukti_nama || 'bukti dukung'}`}
                          aria-label="Pratinjau bukti dukung"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button
                          type="button" onClick={() => handleDownloadOne(d.entry)}
                          disabled={isDownloading}
                          className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50"
                          title={`Unduh ${d.entry.bukti_nama || 'bukti dukung'}`}
                          aria-label="Unduh bukti dukung"
                        >
                          <span className={`material-symbols-outlined text-[16px] ${isDownloading ? 'animate-spin' : ''}`}>
                            {isDownloading ? 'progress_activity' : 'download'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="7" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua' || filterUnit !== 'Semua' || filterJenis !== 'Semua' || selectedFolderKey !== 'all'
                        ? 'Tidak ada dokumen yang cocok dengan filter'
                        : 'Folder kosong — dokumen muncul setelah ada upload pada Input Realisasi'}
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
            <span>Pratinjau mendukung PDF & gambar langsung; Excel diunduh untuk dilihat lengkap.</span>
          </div>
          <span>{visibleDocs.length} dari {documents.length} dokumen</span>
        </div>
      </div>

      {viewerRow && (
        <BuktiViewer row={viewerRow} files={viewerFiles} onClose={() => { setViewerRow(null); setViewerFiles([]) }} />
      )}
    </div>
  )
}

export default BuktiDukungOrganisasi
