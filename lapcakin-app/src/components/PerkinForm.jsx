import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const satuanOptions = ['Persen', 'Nilai', 'Rasio', 'Teks']
const polaritasOptions = ['Positive', 'Negative']

const initialSkForm = {
  tahunAnggaran: new Date().getFullYear().toString(),
  uraian: '',
}

const initialIkskForm = {
  skId: '',
  uraian: '',
  targetTahunan: '',
  satuan: 'Persen',
  polaritas: 'Positive',
}

const targetHint = {
  Persen: 'Contoh: 50% — capaian dalam persen.',
  Nilai: 'Contoh: 28 — capaian dalam angka/jumlah.',
  Rasio: 'Contoh: 1:5 — perbandingan capaian.',
  Teks: 'Contoh: Baik / Tersedia — capaian kualitatif.',
}

const targetPlaceholder = {
  Persen: 'Contoh: 50%',
  Nilai: 'Contoh: 28',
  Rasio: 'Contoh: 1:5',
  Teks: 'Contoh: Baik',
}

function PerkinForm() {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')

  // Modal SK
  const [skModalOpen, setSkModalOpen] = useState(false)
  const [skEditingId, setSkEditingId] = useState(null)
  const [skForm, setSkForm] = useState(initialSkForm)
  const [skErrors, setSkErrors] = useState({})
  const [savingSk, setSavingSk] = useState(false)

  // Modal IKSK
  const [ikskModalOpen, setIkskModalOpen] = useState(false)
  const [ikskEditingId, setIkskEditingId] = useState(null)
  const [ikskForm, setIkskForm] = useState(initialIkskForm)
  const [ikskErrors, setIkskErrors] = useState({})
  const [savingIksk, setSavingIksk] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null) // { type: 'sk' | 'iksk', data }
  const [deleting, setDeleting] = useState(false)

  const isModalOpen = skModalOpen || ikskModalOpen || deleteTarget !== null
  const isSkEditing = skEditingId !== null
  const isIkskEditing = ikskEditingId !== null

  // ---- READ ----
  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
    ])
    if (skRes.error) {
      if (skRes.error.code === '42P01') {
        setFetchError('Tabel "perkin_sk" belum ada. Jalankan file supabase/perkin.sql di SQL Editor Supabase, lalu klik Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${skRes.error.message}`)
      }
    } else if (ikskRes.error) {
      if (ikskRes.error.code === '42P01') {
        setFetchError('Tabel "perkin_iksk" belum ada. Jalankan file supabase/perkin.sql di SQL Editor Supabase, lalu klik Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${ikskRes.error.message}`)
      }
    } else {
      setSkList(skRes.data ?? [])
      setIkskList(ikskRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Helpers penomoran otomatis ----
  const skById = useMemo(() => {
    const map = {}
    skList.forEach((sk) => { map[sk.id] = sk })
    return map
  }, [skList])

  const tahunOptions = useMemo(() => {
    const set = new Set(skList.map((sk) => String(sk.tahun_anggaran)))
    set.add(String(new Date().getFullYear()))
    return [...set].sort((a, b) => Number(b) - Number(a))
  }, [skList])

  const nextSkNomor = useCallback((tahun) => {
    const t = parseInt(tahun, 10)
    const max = skList.filter((sk) => sk.tahun_anggaran === t).reduce((m, sk) => Math.max(m, sk.nomor), 0)
    return max + 1
  }, [skList])

  const nextIkskUrut = useCallback((skId) => {
    const max = ikskList.filter((i) => i.sk_id === skId).reduce((m, i) => Math.max(m, i.nomor_urut), 0)
    return max + 1
  }, [ikskList])

  const ikskNumber = useCallback((iksk) => {
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  // ---- Filter + grouping ----
  const keyword = search.trim().toLowerCase()
  const grouped = useMemo(() => {
    const skFiltered = skList.filter((sk) => {
      const matchTahun = filterTahun === 'Semua' ? true : String(sk.tahun_anggaran) === String(filterTahun)
      if (!matchTahun) return false
      if (!keyword) return true
      const skMatch = sk.uraian.toLowerCase().includes(keyword)
      const childMatch = ikskList.some((i) => i.sk_id === sk.id && i.uraian.toLowerCase().includes(keyword))
      return skMatch || childMatch
    })
    return skFiltered.map((sk) => ({
      sk,
      items: ikskList
        .filter((i) => {
          if (i.sk_id !== sk.id) return false
          if (!keyword) return true
          return i.uraian.toLowerCase().includes(keyword) || sk.uraian.toLowerCase().includes(keyword)
        })
        .sort((a, b) => a.nomor_urut - b.nomor_urut),
    }))
  }, [skList, ikskList, filterTahun, keyword])

  const totalIksk = useMemo(() => grouped.reduce((n, g) => n + g.items.length, 0), [grouped])

  // ---- Modal open/close ----
  const openCreateSk = () => {
    setSkForm({ ...initialSkForm, tahunAnggaran: filterTahun !== 'Semua' ? filterTahun : initialSkForm.tahunAnggaran })
    setSkEditingId(null)
    setSkErrors({})
    setSuccessMessage('')
    setFetchError('')
    setSkModalOpen(true)
  }

  const openCreateIksk = (presetSkId = '') => {
    setIkskForm({ ...initialIkskForm, skId: presetSkId || initialIkskForm.skId })
    setIkskEditingId(null)
    setIkskErrors({})
    setSuccessMessage('')
    setFetchError('')
    setIkskModalOpen(true)
  }

  const closeSkModal = () => {
    if (savingSk) return
    setSkModalOpen(false)
    setSkEditingId(null)
    setSkForm(initialSkForm)
    setSkErrors({})
  }

  const closeIkskModal = () => {
    if (savingIksk) return
    setIkskModalOpen(false)
    setIkskEditingId(null)
    setIkskForm(initialIkskForm)
    setIkskErrors({})
  }

  const updateSkField = (field, value) => {
    setSkForm((c) => ({ ...c, [field]: value }))
    setSuccessMessage('')
    if (skErrors[field]) setSkErrors((c) => ({ ...c, [field]: '' }))
  }

  const updateIkskField = (field, value) => {
    setIkskForm((c) => ({ ...c, [field]: value }))
    setSuccessMessage('')
    if (ikskErrors[field]) setIkskErrors((c) => ({ ...c, [field]: '' }))
  }

  // ---- CREATE + UPDATE: SK ----
  const handleSubmitSk = async (event) => {
    event.preventDefault()
    if (savingSk) return
    const nextErrors = {}
    const tahun = parseInt(skForm.tahunAnggaran, 10)
    if (!skForm.tahunAnggaran.trim()) nextErrors.tahunAnggaran = 'Kolom ini wajib diisi.'
    else if (Number.isNaN(tahun) || tahun < 2000 || tahun > 2100) nextErrors.tahunAnggaran = 'Tahun harus angka 2000-2100.'
    if (!skForm.uraian.trim()) nextErrors.uraian = 'Sasaran Kegiatan wajib diisi.'
    else if (skForm.uraian.trim().length < 10) nextErrors.uraian = 'Uraian minimal 10 karakter.'
    setSkErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan.')
      return
    }
    setSavingSk(true)
    try {
      if (isSkEditing) {
        const current = skList.find((s) => s.id === skEditingId)
        const payload = { tahun_anggaran: tahun, uraian: skForm.uraian.trim() }
        // Jika pindah tahun, beri nomor baru agar tidak konflik
        if (current && current.tahun_anggaran !== tahun) {
          payload.nomor = nextSkNomor(tahun)
        }
        const { data, error } = await supabase.from('perkin_sk').update(payload).eq('id', skEditingId).select().single()
        if (error) throw error
        setSkList((cur) => cur.map((s) => (s.id === skEditingId ? data : s)))
        setSuccessMessage(`SK ${data.nomor} telah diperbarui.`)
      } else {
        const payload = { tahun_anggaran: tahun, nomor: nextSkNomor(tahun), uraian: skForm.uraian.trim() }
        const { data, error } = await supabase.from('perkin_sk').insert(payload).select().single()
        if (error) throw error
        setSkList((cur) => [...cur, data].sort((a, b) => b.tahun_anggaran - a.tahun_anggaran || a.nomor - b.nomor))
        setSuccessMessage(`SK ${data.nomor} otomatis ditambahkan.`)
      }
      setSkForm(initialSkForm)
      setSkEditingId(null)
      setSkErrors({})
      setSkModalOpen(false)
    } catch (error) {
      if (error?.code === '23505') {
        setSkErrors((c) => ({ ...c, uraian: 'Nomor SK untuk tahun ini sudah digunakan. Coba lagi.' }))
      } else {
        setFetchError(`Gagal menyimpan SK: ${error.message}`)
      }
    } finally {
      setSavingSk(false)
    }
  }

  const handleEditSk = (sk) => {
    setSkEditingId(sk.id)
    setSkForm({ tahunAnggaran: String(sk.tahun_anggaran), uraian: sk.uraian })
    setSkErrors({})
    setSuccessMessage('')
    setFetchError('')
    setSkModalOpen(true)
  }

  // ---- CREATE + UPDATE: IKSK ----
  const handleSubmitIksk = async (event) => {
    event.preventDefault()
    if (savingIksk) return
    const nextErrors = {}
    if (!ikskForm.skId) nextErrors.skId = 'Pilih Sasaran Kegiatan induk.'
    if (!ikskForm.uraian.trim()) nextErrors.uraian = 'Indikator (IKSK) wajib diisi.'
    if (!ikskForm.targetTahunan.trim()) nextErrors.targetTahunan = 'Target tahunan wajib diisi.'
    if (!ikskForm.satuan) nextErrors.satuan = 'Pilih satuan.'
    if (!ikskForm.polaritas) nextErrors.polaritas = 'Pilih Positive / Negative.'
    setIkskErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan.')
      return
    }
    setSavingIksk(true)
    try {
      if (isIkskEditing) {
        const current = ikskList.find((i) => i.id === ikskEditingId)
        const moved = current && current.sk_id !== ikskForm.skId
        const payload = {
          sk_id: ikskForm.skId,
          uraian: ikskForm.uraian.trim(),
          target_tahunan: ikskForm.targetTahunan.trim(),
          satuan: ikskForm.satuan,
          polaritas: ikskForm.polaritas,
        }
        if (moved) payload.nomor_urut = nextIkskUrut(ikskForm.skId)
        const { data, error } = await supabase.from('perkin_iksk').update(payload).eq('id', ikskEditingId).select().single()
        if (error) throw error
        setIkskList((cur) => cur.map((i) => (i.id === ikskEditingId ? data : i)))
        setSuccessMessage('IKSK telah diperbarui.')
      } else {
        const payload = {
          sk_id: ikskForm.skId,
          nomor_urut: nextIkskUrut(ikskForm.skId),
          uraian: ikskForm.uraian.trim(),
          target_tahunan: ikskForm.targetTahunan.trim(),
          satuan: ikskForm.satuan,
          polaritas: ikskForm.polaritas,
        }
        const { data, error } = await supabase.from('perkin_iksk').insert(payload).select().single()
        if (error) throw error
        setIkskList((cur) => [...cur, data])
        const sk = skById[data.sk_id]
        setSuccessMessage(sk ? `IKSK ${sk.nomor}.${data.nomor_urut} otomatis ditambahkan di bawah SK ${sk.nomor}.` : 'IKSK telah ditambahkan.')
      }
      setIkskForm(initialIkskForm)
      setIkskEditingId(null)
      setIkskErrors({})
      setIkskModalOpen(false)
    } catch (error) {
      setFetchError(`Gagal menyimpan IKSK: ${error.message}`)
    } finally {
      setSavingIksk(false)
    }
  }

  const handleEditIksk = (iksk) => {
    setIkskEditingId(iksk.id)
    setIkskForm({
      skId: iksk.sk_id,
      uraian: iksk.uraian,
      targetTahunan: iksk.target_tahunan,
      satuan: iksk.satuan,
      polaritas: iksk.polaritas,
    })
    setIkskErrors({})
    setSuccessMessage('')
    setFetchError('')
    setIkskModalOpen(true)
  }

  // ---- DELETE ----
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'sk') {
        const { error } = await supabase.from('perkin_sk').delete().eq('id', deleteTarget.data.id)
        if (error) throw error
        setSkList((cur) => cur.filter((s) => s.id !== deleteTarget.data.id))
        setIkskList((cur) => cur.filter((i) => i.sk_id !== deleteTarget.data.id))
        setSuccessMessage(`SK ${deleteTarget.data.nomor} beserta IKSK-nya telah dihapus.`)
      } else {
        const { error } = await supabase.from('perkin_iksk').delete().eq('id', deleteTarget.data.id)
        if (error) throw error
        setIkskList((cur) => cur.filter((i) => i.id !== deleteTarget.data.id))
        setSuccessMessage('IKSK telah dihapus.')
      }
      setDeleteTarget(null)
    } catch (error) {
      setFetchError(`Gagal menghapus data: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (deleting) return
        if (deleteTarget) setDeleteTarget(null)
        else if (ikskModalOpen) closeIkskModal()
        else if (skModalOpen) closeSkModal()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isModalOpen])

  const inputClass = (hasError) =>
    `h-[44px] rounded-lg border bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-fixed ${
      hasError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
    }`

  const satuanBadge = (satuan) => {
    if (satuan === 'Persen') return 'bg-primary-fixed/25 text-primary'
    if (satuan === 'Nilai') return 'bg-primary-container text-on-primary-container'
    if (satuan === 'Rasio') return 'bg-surface-container-low text-on-surface'
    return 'bg-surface-container text-secondary'
  }

  // Preview nomor otomatis
  const previewSkNomor = isSkEditing
    ? (skList.find((s) => s.id === skEditingId)?.nomor ?? '-')
    : nextSkNomor(parseInt(skForm.tahunAnggaran, 10) || new Date().getFullYear())
  const previewIkskNomor = (() => {
    if (!ikskForm.skId || !skById[ikskForm.skId]) return '-'
    const sk = skById[ikskForm.skId]
    if (isIkskEditing) {
      const cur = ikskList.find((i) => i.id === ikskEditingId)
      if (cur && cur.sk_id === ikskForm.skId) return `${sk.nomor}.${cur.nomor_urut}`
    }
    return `${sk.nomor}.${nextIkskUrut(ikskForm.skId)}`
  })()

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Master Perjanjian Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Master PERKIN</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">history_edu</span>
              {skList.length} SK • {totalIksk} IKSK
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-space-sm">
            <button
              type="button"
              onClick={openCreateSk}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-primary bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-primary hover:bg-primary-fixed/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Tambah SK
            </button>
            <button
              type="button"
              onClick={() => openCreateIksk('')}
              disabled={skList.length === 0}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              Tambah IKSK
            </button>
          </div>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          SK otomatis bernomor 1, 2, 3... Setiap IKSK otomatis mengikuti induknya (1.1, 1.2, 2.1...). Polaritas Positive/Negative menentukan arah capaian untuk perhitungan nilai kinerja.
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

      {successMessage && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-primary-fixed bg-primary-fixed/20 p-space-md text-primary">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <div>
            <h3 className="font-title-sm text-title-sm font-bold">Data PERKIN berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toolbar: filter tahun + search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Daftar Sasaran & Indikator</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${grouped.length} sasaran • ${totalIksk} indikator`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-space-sm w-full lg:w-auto">
          <div className="relative">
            <select
              value={filterTahun}
              onChange={(event) => setFilterTahun(event.target.value)}
              aria-label="Filter tahun anggaran"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
            >
              <option value="Semua">Semua Tahun</option>
              {tahunOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">filter_alt</span>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari SK / IKSK..."
              aria-label="Cari sasaran atau indikator"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Read: daftar SK + tabel IKSK */}
      {loading ? (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-space-xl text-center font-body-sm text-body-sm text-secondary">
          <span className="flex items-center justify-center gap-space-2xs">
            <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
            Memuat data dari Supabase...
          </span>
        </div>
      ) : grouped.length > 0 ? (
        <div className="space-y-space-md">
          {grouped.map(({ sk, items }) => (
            <section key={sk.id} className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
              {/* SK header */}
              <div className="flex flex-col md:flex-row md:items-center gap-space-sm px-space-md py-space-sm bg-surface-container-low/50 border-b border-surface-container">
                <div className="flex items-start gap-space-sm flex-1">
                  <span className="inline-flex items-center justify-center min-w-[40px] h-[40px] px-space-xs rounded-xl bg-primary text-on-primary font-headline-md text-headline-md font-extrabold">
                    {sk.nomor}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-space-2xs">
                      <span className="font-label-sm text-label-sm font-bold text-secondary uppercase">Sasaran Kegiatan • T.A {sk.tahun_anggaran}</span>
                      <span className="inline-flex items-center px-space-xs py-0.5 rounded-full bg-surface-container text-secondary font-label-sm font-bold">
                        {items.length} IKSK
                      </span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface font-bold">{sk.uraian}</p>
                  </div>
                </div>
                <div className="flex items-center gap-space-2xs shrink-0">
                  <button
                    type="button"
                    onClick={() => openCreateIksk(sk.id)}
                    className="inline-flex items-center gap-space-2xs h-[36px] rounded-lg bg-primary px-space-sm font-body-sm text-body-sm font-bold text-on-primary hover:bg-primary-container transition-colors"
                    title={`Tambah IKSK ${sk.nomor}.${items.length + 1}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    IKSK
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditSk(sk)}
                    className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                    title={`Edit SK ${sk.nomor}`}
                    aria-label={`Edit SK ${sk.nomor}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_square</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'sk', data: { ...sk, ikskCount: items.length } })}
                    className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                    title={`Hapus SK ${sk.nomor}`}
                    aria-label={`Hapus SK ${sk.nomor}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
              {/* Tabel IKSK: No | Sasaran | No IKSK | Indikator | Target | Satuan | Polaritas | Aksi */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1020px]">
                  <thead>
                    <tr className="border-b border-surface-container">
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[64px]">No</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary">Sasaran Kegiatan</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary">Indikator (IKSK)</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Target</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Satuan</th>
                      <th className="text-left px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Arah</th>
                      <th className="text-center px-space-md py-space-xs font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? items.map((iksk) => (
                      <tr key={iksk.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                        <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary font-bold">{sk.nomor}</td>
                        <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary max-w-[280px]">
                          <span className="line-clamp-2">{sk.uraian}</span>
                        </td>
                        <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-mono font-bold whitespace-nowrap">
                          {sk.nomor}.{iksk.nomor_urut}
                        </td>
                        <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-medium max-w-[320px]">{iksk.uraian}</td>
                        <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">{iksk.target_tahunan}</td>
                        <td className="px-space-md py-space-sm">
                          <span className={`inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${satuanBadge(iksk.satuan)}`}>
                            {iksk.satuan}
                          </span>
                        </td>
                        <td className="px-space-md py-space-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${
                              iksk.polaritas === 'Positive' ? 'bg-primary-fixed/25 text-primary' : 'bg-error-container text-on-error-container'
                            }`}
                            title={iksk.polaritas === 'Positive' ? 'Semakin tinggi semakin baik' : 'Semakin rendah semakin baik'}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {iksk.polaritas === 'Positive' ? 'trending_up' : 'trending_down'}
                            </span>
                            {iksk.polaritas}
                          </span>
                        </td>
                        <td className="px-space-md py-space-sm">
                          <div className="flex items-center justify-center gap-space-2xs">
                            <button
                              type="button"
                              onClick={() => handleEditIksk(iksk)}
                              className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                              title="Edit IKSK"
                              aria-label={`Edit IKSK ${ikskNumber(iksk)}`}
                            >
                              <span className="material-symbols-outlined text-[16px]">edit_square</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'iksk', data: iksk })}
                              className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                              title="Hapus IKSK"
                              aria-label={`Hapus IKSK ${ikskNumber(iksk)}`}
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="8" className="px-space-md py-space-md text-center font-body-sm text-body-sm text-secondary">
                          Belum ada IKSK pada SK {sk.nomor} — klik tombol IKSK untuk menambah {sk.nomor}.1
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-space-xl text-center font-body-sm text-body-sm text-secondary">
          <span className="flex items-center justify-center gap-space-2xs">
            <span className="material-symbols-outlined text-[24px]">search_off</span>
            {search || filterTahun !== 'Semua' ? 'Tidak ada hasil yang cocok dengan filter' : 'Belum ada data PERKIN — klik Tambah SK untuk mulai (otomatis nomor 1)'}
          </span>
        </div>
      )}

      {/* Modal SK */}
      {skModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeSkModal} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="sk-form-title"
            className="my-8 w-full max-w-[640px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitSk} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="sk-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">
                    {isSkEditing ? 'Edit Sasaran Kegiatan' : 'Tambah Sasaran Kegiatan'}
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Nomor SK <span className="font-bold text-primary font-mono">{previewSkNomor}</span> terisi otomatis
                  </p>
                </div>
                <button type="button" onClick={closeSkModal} disabled={savingSk} aria-label="Tutup formulir SK"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="skTahun">
                    Tahun Anggaran <span className="text-error">*</span>
                  </label>
                  <input id="skTahun" type="number" min="2000" max="2100" value={skForm.tahunAnggaran}
                    onChange={(event) => updateSkField('tahunAnggaran', event.target.value)} className={inputClass(skErrors.tahunAnggaran)} placeholder="2026" />
                  {skErrors.tahunAnggaran && <span className="font-label-sm text-label-sm text-error">{skErrors.tahunAnggaran}</span>}
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="skUraian">
                    Sasaran Kegiatan (SK) <span className="text-error">*</span>
                  </label>
                  <textarea id="skUraian" value={skForm.uraian} onChange={(event) => updateSkField('uraian', event.target.value)} rows="4"
                    className="min-h-[110px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                    placeholder="Contoh: Meningkatnya jaminan beragama, toleransi, dan cinta kemanusiaan umat beragama" />
                  {skErrors.uraian && <span className="font-label-sm text-label-sm text-error">{skErrors.uraian}</span>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
                <button type="button" onClick={closeSkModal} disabled={savingSk}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">close</span> Batal
                </button>
                <button type="submit" disabled={savingSk}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">{savingSk ? 'progress_activity' : isSkEditing ? 'save' : 'add_circle'}</span>
                  {savingSk ? 'Menyimpan...' : isSkEditing ? 'Perbarui SK' : `Simpan SK ${previewSkNomor}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal IKSK */}
      {ikskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeIkskModal} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="iksk-form-title"
            className="my-8 w-full max-w-[760px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitIksk} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="iksk-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">
                    {isIkskEditing ? 'Edit IKSK' : 'Tambah IKSK'}
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Nomor IKSK <span className="font-bold text-primary font-mono">{previewIkskNomor}</span> mengikuti SK induk otomatis
                  </p>
                </div>
                <button type="button" onClick={closeIkskModal} disabled={savingIksk} aria-label="Tutup formulir IKSK"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ikskSk">
                    Sasaran Kegiatan Induk <span className="text-error">*</span>
                  </label>
                  <select id="ikskSk" value={ikskForm.skId} onChange={(event) => updateIkskField('skId', event.target.value)} className={inputClass(ikskErrors.skId)}>
                    <option value="">Pilih SK induk</option>
                    {skList.map((sk) => (
                      <option key={sk.id} value={sk.id}>
                        {sk.nomor} — {sk.uraian.slice(0, 80)}{sk.uraian.length > 80 ? '...' : ''} (T.A {sk.tahun_anggaran})
                      </option>
                    ))}
                  </select>
                  {ikskErrors.skId && <span className="font-label-sm text-label-sm text-error">{ikskErrors.skId}</span>}
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ikskUraian">
                    Indikator Kinerja Sasaran Kegiatan (IKSK) <span className="text-error">*</span>
                  </label>
                  <textarea id="ikskUraian" value={ikskForm.uraian} onChange={(event) => updateIkskField('uraian', event.target.value)} rows="3"
                    className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                    placeholder="Contoh: Persentase peningkatan dialog kerukunan agama Islam yang difasilitasi" />
                  {ikskErrors.uraian && <span className="font-label-sm text-label-sm text-error">{ikskErrors.uraian}</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ikskTarget">
                      Target Tahunan <span className="text-error">*</span>
                    </label>
                    <input id="ikskTarget" type="text" value={ikskForm.targetTahunan}
                      onChange={(event) => updateIkskField('targetTahunan', event.target.value)}
                      className={inputClass(ikskErrors.targetTahunan)} placeholder={targetPlaceholder[ikskForm.satuan] || 'Target'} />
                    {ikskErrors.targetTahunan
                      ? <span className="font-label-sm text-label-sm text-error">{ikskErrors.targetTahunan}</span>
                      : <span className="font-label-sm text-label-sm text-secondary">{targetHint[ikskForm.satuan]}</span>}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ikskSatuan">
                      Satuan <span className="text-error">*</span>
                    </label>
                    <select id="ikskSatuan" value={ikskForm.satuan} onChange={(event) => updateIkskField('satuan', event.target.value)} className={inputClass(ikskErrors.satuan)}>
                      {satuanOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    {ikskErrors.satuan && <span className="font-label-sm text-label-sm text-error">{ikskErrors.satuan}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    Arah Capaian (Polaritas) <span className="text-error">*</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm" role="radiogroup" aria-label="Polaritas capaian">
                    {polaritasOptions.map((p) => {
                      const active = ikskForm.polaritas === p
                      const positive = p === 'Positive'
                      return (
                        <button
                          key={p} type="button" role="radio" aria-checked={active}
                          onClick={() => updateIkskField('polaritas', p)}
                          className={`flex items-center gap-space-sm rounded-xl border p-space-sm text-left transition-all ${
                            active
                              ? positive
                                ? 'border-primary bg-primary-fixed/20 ring-2 ring-primary-fixed'
                                : 'border-error bg-error-container/40 ring-2 ring-error/40'
                              : 'border-outline-variant bg-surface hover:bg-surface-container'
                          }`}
                        >
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                            positive ? 'bg-primary-fixed/25 text-primary' : 'bg-error-container text-on-error-container'
                          }`}>
                            <span className="material-symbols-outlined text-[22px]">{positive ? 'trending_up' : 'trending_down'}</span>
                          </span>
                          <span>
                            <span className="block font-body-md text-body-md font-bold text-on-surface">{p}</span>
                            <span className="block font-body-sm text-body-sm text-secondary">
                              {positive ? 'Semakin tinggi semakin baik' : 'Semakin rendah semakin baik'}
                            </span>
                          </span>
                          <span className={`ml-auto material-symbols-outlined text-[20px] ${active ? 'text-primary' : 'text-secondary/40'}`}>
                            {active ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {ikskErrors.polaritas && <span className="font-label-sm text-label-sm text-error">{ikskErrors.polaritas}</span>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
                <button type="button" onClick={closeIkskModal} disabled={savingIksk}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">close</span> Batal
                </button>
                <button type="submit" disabled={savingIksk}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">{savingIksk ? 'progress_activity' : isIkskEditing ? 'save' : 'add_task'}</span>
                  {savingIksk ? 'Menyimpan...' : isIkskEditing ? 'Perbarui IKSK' : `Simpan IKSK ${previewIkskNomor}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete: modal konfirmasi */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"
            className="rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container p-space-lg max-w-[440px] w-full"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-space-sm text-error mb-space-sm">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 id="delete-modal-title" className="font-headline-md text-headline-md font-bold">Konfirmasi Hapus</h3>
            </div>
            {deleteTarget.type === 'sk' ? (
              <>
                <p className="font-body-md text-body-md text-secondary mb-space-sm">
                  Hapus SK {deleteTarget.data.nomor}? Seluruh IKSK di bawahnya ikut terhapus.
                </p>
                <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
                  <span className="font-bold text-on-surface">SK {deleteTarget.data.nomor}: </span>
                  {deleteTarget.data.uraian}
                  <span className="block mt-1 font-bold text-error">{deleteTarget.data.ikskCount} IKSK ikut terhapus</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-body-md text-body-md text-secondary mb-space-sm">Apakah Anda yakin ingin menghapus IKSK ini?</p>
                <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
                  <span className="font-bold text-on-surface font-mono">{ikskNumber(deleteTarget.data)} — </span>
                  {deleteTarget.data.uraian}
                </p>
              </>
            )}
            <div className="flex justify-end gap-space-sm">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                Batal
              </button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleting}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-error px-space-md font-body-md text-body-md font-bold text-on-error shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">delete</span>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerkinForm
