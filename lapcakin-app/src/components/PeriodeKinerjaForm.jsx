import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const initialForm = {
  kodePeriode: '',
  namaPeriode: '',
  tahunAnggaran: new Date().getFullYear().toString(),
  jenisPeriode: 'Triwulan I',
  tanggalMulai: '',
  tanggalSelesai: '',
  status: 'Draft',
  deskripsi: '',
}

const jenisOptions = ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV', 'Semester I', 'Semester II', 'Tahunan']
const statusOptions = ['Draft', 'Aktif', 'Selesai', 'Arsip']

const requiredFields = ['kodePeriode', 'namaPeriode', 'tahunAnggaran', 'jenisPeriode', 'tanggalMulai', 'tanggalSelesai', 'status']

// Mapping snake_case (Supabase) <-> camelCase (form/UI)
const fromRow = (row) => ({
  id: row.id,
  kodePeriode: row.kode_periode ?? '',
  namaPeriode: row.nama_periode ?? '',
  tahunAnggaran: String(row.tahun_anggaran ?? ''),
  jenisPeriode: row.jenis_periode ?? 'Triwulan I',
  tanggalMulai: row.tanggal_mulai ?? '',
  tanggalSelesai: row.tanggal_selesai ?? '',
  status: row.status ?? 'Draft',
  deskripsi: row.deskripsi ?? '',
})

const toRow = (form) => ({
  kode_periode: form.kodePeriode.trim(),
  nama_periode: form.namaPeriode.trim(),
  tahun_anggaran: parseInt(form.tahunAnggaran, 10),
  jenis_periode: form.jenisPeriode,
  tanggal_mulai: form.tanggalMulai,
  tanggal_selesai: form.tanggalSelesai,
  status: form.status,
  deskripsi: form.deskripsi.trim() || null,
})

const formatTanggal = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PeriodeKinerjaForm() {
  const [periodes, setPeriodes] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const isEditing = editingId !== null
  const isModalOpen = isFormOpen || deleteTarget !== null

  // ---- READ ----
  const fetchPeriodes = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('periode_kinerja')
      .select('*')
      .order('tahun_anggaran', { ascending: false })
      .order('tanggal_mulai', { ascending: true })
    if (error) {
      if (error.code === '42P01') {
        setFetchError('Tabel "periode_kinerja" belum ada. Jalankan file supabase/periode_kinerja.sql di SQL Editor Supabase, lalu klik Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${error.message}`)
      }
    } else {
      setPeriodes((data ?? []).map(fromRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPeriodes()
  }, [fetchPeriodes])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSuccessMessage('')
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }))
    }
  }

  // ---- Modal open / close ----
  const openCreate = () => {
    setForm(initialForm)
    setEditingId(null)
    setErrors({})
    setSuccessMessage('')
    setFetchError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setIsFormOpen(false)
    setEditingId(null)
    setForm(initialForm)
    setErrors({})
  }

  const handleSearch = (event) => setSearch(event.target.value)

  // Read: pencarian Kode / Nama + filter status
  const keyword = search.trim().toLowerCase()
  const filteredPeriodes = periodes.filter((periode) => {
    const matchKeyword = keyword
      ? periode.kodePeriode.toLowerCase().includes(keyword) ||
        periode.namaPeriode.toLowerCase().includes(keyword)
      : true
    const matchStatus = filterStatus === 'Semua' ? true : periode.status === filterStatus
    return matchKeyword && matchStatus
  })

  const validate = () => {
    const nextErrors = {}
    requiredFields.forEach((field) => {
      if (!form[field] || !form[field].toString().trim()) {
        nextErrors[field] = 'Kolom ini wajib diisi.'
      }
    })
    const tahun = parseInt(form.tahunAnggaran, 10)
    if (form.tahunAnggaran && (Number.isNaN(tahun) || tahun < 2000 || tahun > 2100)) {
      nextErrors.tahunAnggaran = 'Tahun anggaran harus angka 2000-2100.'
    }
    if (form.tanggalMulai && form.tanggalSelesai && form.tanggalSelesai < form.tanggalMulai) {
      nextErrors.tanggalSelesai = 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // ---- CREATE + UPDATE ----
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!validate()) return
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      return
    }

    setSaving(true)
    const payload = toRow(form)

    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('periode_kinerja')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()
        if (error) throw error
        const updated = fromRow(data)
        setPeriodes((current) => current.map((item) => (item.id === editingId ? updated : item)))
        setSuccessMessage(`Periode ${updated.namaPeriode} telah diperbarui di master data.`)
      } else {
        const { data, error } = await supabase
          .from('periode_kinerja')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        const created = fromRow(data)
        setPeriodes((current) => [created, ...current])
        setSuccessMessage(`Periode ${created.namaPeriode} telah ditambahkan ke master data.`)
      }
      setForm(initialForm)
      setEditingId(null)
      setErrors({})
      setIsFormOpen(false)
    } catch (error) {
      if (error?.code === '23505') {
        setErrors((current) => ({
          ...current,
          kodePeriode: 'Kode periode sudah digunakan. Gunakan kode yang unik.',
        }))
      } else {
        setFetchError(`Gagal menyimpan data: ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // Update: pre-fill formulir di modal dari baris yang dipilih
  const handleEdit = (periode) => {
    setEditingId(periode.id)
    setForm({
      kodePeriode: periode.kodePeriode ?? '',
      namaPeriode: periode.namaPeriode ?? '',
      tahunAnggaran: periode.tahunAnggaran ?? '',
      jenisPeriode: periode.jenisPeriode ?? 'Triwulan I',
      tanggalMulai: periode.tanggalMulai ?? '',
      tanggalSelesai: periode.tanggalSelesai ?? '',
      status: periode.status ?? 'Draft',
      deskripsi: periode.deskripsi ?? '',
    })
    setErrors({})
    setSuccessMessage('')
    setFetchError('')
    setIsFormOpen(true)
  }

  const handleReset = () => {
    setForm(initialForm)
    setErrors({})
    setSuccessMessage('')
    if (isEditing) setEditingId(null)
  }

  // ---- DELETE ----
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    const { error } = await supabase.from('periode_kinerja').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      setFetchError(`Gagal menghapus data: ${error.message}`)
      return
    }
    setPeriodes((current) => current.filter((item) => item.id !== deleteTarget.id))
    setSuccessMessage(`Periode ${deleteTarget.namaPeriode} telah dihapus dari master data.`)
    if (editingId === deleteTarget.id) {
      setForm(initialForm)
      setEditingId(null)
      setErrors({})
    }
    setDeleteTarget(null)
  }

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (deleting) return
        if (deleteTarget) setDeleteTarget(null)
        else if (isFormOpen) closeForm()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [deleteTarget, isFormOpen, deleting])

  // Kunci scroll body saat modal overflow terbuka
  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isModalOpen])

  const inputClass = (hasError) =>
    `h-[44px] rounded-lg border bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-fixed ${
      hasError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
    }`

  const statusBadge = (status) => {
    if (status === 'Aktif') return 'bg-primary-fixed/25 text-primary'
    if (status === 'Selesai') return 'bg-primary-container text-on-primary-container'
    if (status === 'Arsip') return 'bg-surface-container text-secondary'
    return 'bg-surface-container-low text-on-surface'
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Periode Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Periode Kinerja
            </h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              {periodes.length} Periode
            </span>
          </div>
          {/* Tombol Tambah Periode -> overflow modal form input */}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Tambah Periode
          </button>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Kelola triwulan, semester, dan konsolidasi tahunan. Klik Tambah Periode untuk membuka formulir input.
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
            onClick={fetchPeriodes}
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
            <h3 className="font-title-sm text-title-sm font-bold">Data periode berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Overflow modal: form input periode (tambah / edit) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto"
          onClick={closeForm}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="periode-form-title"
            className="my-8 w-full max-w-[880px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="periode-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">
                    {isEditing ? 'Edit Periode' : 'Tambah Periode'}
                  </h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Kolom bertanda <span className="text-error font-bold">*</span> wajib diisi
                  </p>
                </div>
                <div className="flex items-center gap-space-2xs">
                  <span className="hidden sm:inline-flex items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-surface-container text-secondary font-label-sm font-bold">
                    <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                    {isEditing ? 'Formulir Edit' : 'Formulir Baru'}
                  </span>
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    aria-label="Tutup formulir"
                    className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              <div className="p-space-md space-y-space-lg overflow-y-auto grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="kodePeriode">
                      Kode Periode <span className="text-error">*</span>
                    </label>
                    <input
                      id="kodePeriode"
                      type="text"
                      value={form.kodePeriode}
                      onChange={(event) => updateField('kodePeriode', event.target.value)}
                      className={inputClass(errors.kodePeriode)}
                      placeholder="Contoh: 2026-TW1"
                    />
                    {errors.kodePeriode ? (
                      <span className="font-label-sm text-label-sm text-error">{errors.kodePeriode}</span>
                    ) : (
                      <span className="font-label-sm text-label-sm text-secondary">Kode unik, contoh: 2026-TW1 / 2026-TA.</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="namaPeriode">
                      Nama Periode <span className="text-error">*</span>
                    </label>
                    <input
                      id="namaPeriode"
                      type="text"
                      value={form.namaPeriode}
                      onChange={(event) => updateField('namaPeriode', event.target.value)}
                      className={inputClass(errors.namaPeriode)}
                      placeholder="Contoh: Triwulan I 2026"
                    />
                    {errors.namaPeriode && <span className="font-label-sm text-label-sm text-error">{errors.namaPeriode}</span>}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="tahunAnggaran">
                      Tahun Anggaran <span className="text-error">*</span>
                    </label>
                    <input
                      id="tahunAnggaran"
                      type="number"
                      min="2000"
                      max="2100"
                      value={form.tahunAnggaran}
                      onChange={(event) => updateField('tahunAnggaran', event.target.value)}
                      className={inputClass(errors.tahunAnggaran)}
                      placeholder="2026"
                    />
                    {errors.tahunAnggaran && <span className="font-label-sm text-label-sm text-error">{errors.tahunAnggaran}</span>}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="jenisPeriode">
                      Jenis Periode <span className="text-error">*</span>
                    </label>
                    <select
                      id="jenisPeriode"
                      value={form.jenisPeriode}
                      onChange={(event) => updateField('jenisPeriode', event.target.value)}
                      className={inputClass(errors.jenisPeriode)}
                    >
                      {jenisOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    {errors.jenisPeriode && <span className="font-label-sm text-label-sm text-error">{errors.jenisPeriode}</span>}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="tanggalMulai">
                      Tanggal Mulai <span className="text-error">*</span>
                    </label>
                    <input
                      id="tanggalMulai"
                      type="date"
                      value={form.tanggalMulai}
                      onChange={(event) => updateField('tanggalMulai', event.target.value)}
                      className={inputClass(errors.tanggalMulai)}
                    />
                    {errors.tanggalMulai && <span className="font-label-sm text-label-sm text-error">{errors.tanggalMulai}</span>}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="tanggalSelesai">
                      Tanggal Selesai <span className="text-error">*</span>
                    </label>
                    <input
                      id="tanggalSelesai"
                      type="date"
                      value={form.tanggalSelesai}
                      min={form.tanggalMulai || undefined}
                      onChange={(event) => updateField('tanggalSelesai', event.target.value)}
                      className={inputClass(errors.tanggalSelesai)}
                    />
                    {errors.tanggalSelesai && <span className="font-label-sm text-label-sm text-error">{errors.tanggalSelesai}</span>}
                  </div>

                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="status">
                      Status <span className="text-error">*</span>
                    </label>
                    <select
                      id="status"
                      value={form.status}
                      onChange={(event) => updateField('status', event.target.value)}
                      className={inputClass(errors.status)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    {errors.status && <span className="font-label-sm text-label-sm text-error">{errors.status}</span>}
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="deskripsi">
                      Deskripsi / Catatan
                    </label>
                    <textarea
                      id="deskripsi"
                      value={form.deskripsi}
                      onChange={(event) => updateField('deskripsi', event.target.value)}
                      rows="3"
                      className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                      placeholder="Contoh: Periode evaluasi Januari - Maret 2026"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">{saving ? 'progress_activity' : isEditing ? 'save' : 'add_circle'}</span>
                  {saving ? 'Menyimpan...' : isEditing ? 'Perbarui Data' : 'Simpan Periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read: Tabel Daftar Periode */}
      <div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Tabel Daftar Periode</h2>
            <p className="font-body-sm text-body-sm text-secondary">
              {loading ? 'Memuat data...' : `${filteredPeriodes.length} periode terdaftar`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-space-sm w-full lg:w-auto">
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                aria-label="Filter berdasarkan status"
                className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Status</option>
                {statusOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                filter_alt
              </span>
            </div>
            <div className="relative w-full sm:w-80">
              <input
                type="search"
                value={search}
                onChange={handleSearch}
                placeholder="Cari Kode / Nama Periode..."
                aria-label="Cari periode"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              />
              <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low/50">
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[56px]">No</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Kode / Nama</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Tahun</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Jenis</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Rentang Tanggal</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Status</th>
                  <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">Aksi</th>
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
                ) : filteredPeriodes.length > 0 ? (
                  filteredPeriodes.map((periode, idx) => (
                    <tr key={periode.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                      <td className="px-space-md py-space-sm">
                        <div className="font-body-sm text-body-sm text-on-surface font-bold">{periode.namaPeriode}</div>
                        <div className="font-body-sm text-body-sm text-secondary font-mono">{periode.kodePeriode}</div>
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold">{periode.tahunAnggaran}</td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">{periode.jenisPeriode}</td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface whitespace-nowrap">
                        {formatTanggal(periode.tanggalMulai)} — {formatTanggal(periode.tanggalSelesai)}
                      </td>
                      <td className="px-space-md py-space-sm">
                        <span className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${statusBadge(periode.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {periode.status}
                        </span>
                      </td>
                      <td className="px-space-md py-space-sm">
                        <div className="flex items-center justify-center gap-space-2xs">
                          <button
                            type="button"
                            onClick={() => handleEdit(periode)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                            title="Edit"
                            aria-label={`Edit ${periode.namaPeriode}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_square</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(periode)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                            title="Hapus"
                            aria-label={`Hapus ${periode.namaPeriode}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                      <span className="flex items-center justify-center gap-space-2xs">
                        <span className="material-symbols-outlined text-[24px]">search_off</span>
                        {search || filterStatus !== 'Semua' ? 'Tidak ada hasil yang cocok dengan filter' : 'Belum ada data periode'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete: modal konfirmasi */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container p-space-lg max-w-[440px] w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-space-sm text-error mb-space-sm">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 id="delete-modal-title" className="font-headline-md text-headline-md font-bold">
                Konfirmasi Hapus
              </h3>
            </div>
            <p className="font-body-md text-body-md text-secondary mb-space-sm">Apakah Anda yakin ingin menghapus periode ini?</p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.namaPeriode}</span>
              <span className="font-mono"> ({deleteTarget.kodePeriode})</span>
            </p>
            <div className="flex justify-end gap-space-sm">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-error px-space-md font-body-md text-body-md font-bold text-on-error shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
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

export default PeriodeKinerjaForm
