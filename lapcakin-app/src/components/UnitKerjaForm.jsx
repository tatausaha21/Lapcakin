import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const initialForm = {
  namaUnit: '',
  kodeUnit: '',
  jenisUnit: 'Seksi',
  indukOrganisasi: '',
  kepalaUnit: '',
  nipKepalaUnit: '',
  email: '',
  telepon: '',
  alamat: '',
  status: 'Aktif',
  catatan: '',
}

const indukOptions = [
  'Kantor Kementerian Agama Kabupaten Lebak',
  'Satuan Kerja Langsung',
]

const jenisUnitOptions = ['Seksi', 'Subbagian', 'Bagian', 'Bidang', 'Satuan Kerja']

const statusOptions = ['Aktif', 'Nonaktif', 'Dalam Verifikasi']

const requiredFields = ['namaUnit', 'kodeUnit', 'jenisUnit', 'indukOrganisasi', 'kepalaUnit']

// Mapping snake_case (Supabase) <-> camelCase (form/UI)
const fromRow = (row) => ({
  id: row.id,
  namaUnit: row.nama_unit ?? '',
  kodeUnit: row.kode_unit ?? '',
  jenisUnit: row.jenis_unit ?? 'Seksi',
  indukOrganisasi: row.induk_organisasi ?? '',
  kepalaUnit: row.kepala_unit ?? '',
  nipKepalaUnit: row.nip_kepala_unit ?? '',
  email: row.email ?? '',
  telepon: row.telepon ?? '',
  alamat: row.alamat ?? '',
  status: row.status ?? 'Aktif',
  catatan: row.catatan ?? '',
})

const toRow = (form) => ({
  nama_unit: form.namaUnit.trim(),
  kode_unit: form.kodeUnit.trim(),
  jenis_unit: form.jenisUnit,
  induk_organisasi: form.indukOrganisasi,
  kepala_unit: form.kepalaUnit.trim(),
  nip_kepala_unit: form.nipKepalaUnit.trim() || null,
  email: form.email.trim() || null,
  telepon: form.telepon.trim() || null,
  alamat: form.alamat.trim() || null,
  status: form.status,
  catatan: form.catatan.trim() || null,
})

function UnitKerjaForm() {
  const [units, setUnits] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const formRef = useRef(null)

  const isEditing = editingId !== null

  // ---- READ ----
  const fetchUnits = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('unit_kerja')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setFetchError(`Gagal memuat data: ${error.message}`)
    } else {
      setUnits((data ?? []).map(fromRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSuccessMessage('')
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }))
    }
  }

  const handleSearch = (event) => {
    setSearch(event.target.value)
  }

  // Read: pencarian berdasarkan Kode / Nama Unit Kerja
  const keyword = search.trim().toLowerCase()
  const filteredUnits = keyword
    ? units.filter(
        (unit) =>
          unit.namaUnit.toLowerCase().includes(keyword) ||
          unit.kodeUnit.toLowerCase().includes(keyword),
      )
    : units

  const validate = () => {
    const nextErrors = {}
    requiredFields.forEach((field) => {
      if (!form[field] || !form[field].toString().trim()) {
        nextErrors[field] = 'Kolom ini wajib diisi.'
      }
    })
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
          .from('unit_kerja')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()
        if (error) throw error
        const updated = fromRow(data)
        setUnits((current) => current.map((unit) => (unit.id === editingId ? updated : unit)))
        setSuccessMessage(`Unit kerja ${updated.namaUnit} telah diperbarui di master data.`)
      } else {
        const { data, error } = await supabase
          .from('unit_kerja')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        const created = fromRow(data)
        setUnits((current) => [created, ...current])
        setSuccessMessage(`Unit kerja ${created.namaUnit} telah ditambahkan ke master data.`)
      }
      setForm(initialForm)
      setEditingId(null)
      setErrors({})
    } catch (error) {
      // Unique violation kode_unit (Postgres 23505)
      if (error?.code === '23505') {
        setErrors((current) => ({
          ...current,
          kodeUnit: 'Kode Unit sudah digunakan. Gunakan kode yang unik.',
        }))
      } else {
        setFetchError(`Gagal menyimpan data: ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // Update: pre-fill formulir dari baris yang dipilih
  const handleEdit = (unit) => {
    setEditingId(unit.id)
    setForm({
      namaUnit: unit.namaUnit ?? '',
      kodeUnit: unit.kodeUnit ?? '',
      jenisUnit: unit.jenisUnit ?? 'Seksi',
      indukOrganisasi: unit.indukOrganisasi ?? '',
      kepalaUnit: unit.kepalaUnit ?? '',
      nipKepalaUnit: unit.nipKepalaUnit ?? '',
      email: unit.email ?? '',
      telepon: unit.telepon ?? '',
      alamat: unit.alamat ?? '',
      status: unit.status ?? 'Aktif',
      catatan: unit.catatan ?? '',
    })
    setErrors({})
    setSuccessMessage('')
    setFetchError('')
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleCancelEdit = () => {
    setForm(initialForm)
    setEditingId(null)
    setErrors({})
    setSuccessMessage('')
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
    const { error } = await supabase.from('unit_kerja').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      setFetchError(`Gagal menghapus data: ${error.message}`)
      return
    }
    setUnits((current) => current.filter((unit) => unit.id !== deleteTarget.id))
    setSuccessMessage(`Unit kerja ${deleteTarget.namaUnit} telah dihapus dari master data.`)
    if (editingId === deleteTarget.id) {
      setForm(initialForm)
      setEditingId(null)
      setErrors({})
    }
    setDeleteTarget(null)
  }

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setDeleteTarget(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const inputClass = (hasError) =>
    `h-[44px] rounded-lg border bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-fixed ${
      hasError
        ? 'border-error focus:border-error'
        : 'border-outline-variant focus:border-primary'
    }`

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Master Unit Kerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
            {isEditing ? 'Edit Unit Kerja' : 'Tambah Unit Kerja'}
          </h1>
          {/* Badge status/indikator halaman, bukan tombol */}
          <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
            <span className="material-symbols-outlined text-[14px]">
              {isEditing ? 'edit' : 'add_circle'}
            </span>
            {isEditing ? 'Form Edit' : 'Form Registrasi'}
          </span>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          {isEditing
            ? 'Perbarui informasi unit kerja yang dipilih. Formulir di bawah sudah terisi otomatis sesuai data yang dipilih dari tabel.'
            : 'Lengkapi informasi unit kerja baru untuk mendaftarkan seksi, subbagian, atau satuan kerja ke dalam sistem SICAKIN.'}
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
            onClick={fetchUnits}
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
            <h3 className="font-title-sm text-title-sm font-bold">Data unit kerja berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      <div ref={formRef} className="scroll-mt-24">
        <form onSubmit={handleSubmit} noValidate className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Informasi Unit Kerja</h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Kolom bertanda <span className="text-error font-bold">*</span> wajib diisi
              </p>
            </div>
            <span className="inline-flex items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-surface-container text-secondary font-label-sm font-bold">
              <span className="material-symbols-outlined text-[15px]">description</span>
              {isEditing ? 'Formulir Edit' : 'Formulir Baru'}
            </span>
          </div>

          <div className="p-space-md space-y-space-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="namaUnit">
                  Nama Unit Kerja <span className="text-error">*</span>
                </label>
                <input
                  id="namaUnit"
                  type="text"
                  value={form.namaUnit}
                  onChange={(event) => updateField('namaUnit', event.target.value)}
                  className={inputClass(errors.namaUnit)}
                  placeholder="Contoh: Seksi Pendidikan Madrasah"
                />
                {errors.namaUnit && (
                  <span className="font-label-sm text-label-sm text-error">{errors.namaUnit}</span>
                )}
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="kodeUnit">
                  Kode Unit Kerja <span className="text-error">*</span>
                </label>
                <input
                  id="kodeUnit"
                  type="text"
                  value={form.kodeUnit}
                  onChange={(event) => updateField('kodeUnit', event.target.value)}
                  className={inputClass(errors.kodeUnit)}
                  placeholder="Contoh: SEKS-PENDIS-01"
                />
                {errors.kodeUnit ? (
                  <span className="font-label-sm text-label-sm text-error">{errors.kodeUnit}</span>
                ) : (
                  <span className="font-label-sm text-label-sm text-secondary">
                    Gunakan format kode unik untuk setiap unit kerja.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="jenisUnit">
                  Jenis Unit <span className="text-error">*</span>
                </label>
                <select
                  id="jenisUnit"
                  value={form.jenisUnit}
                  onChange={(event) => updateField('jenisUnit', event.target.value)}
                  className={inputClass(errors.jenisUnit)}
                >
                  {jenisUnitOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                {errors.jenisUnit && (
                  <span className="font-label-sm text-label-sm text-error">{errors.jenisUnit}</span>
                )}
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="indukOrganisasi">
                  Induk Organisasi <span className="text-error">*</span>
                </label>
                <select
                  id="indukOrganisasi"
                  value={form.indukOrganisasi}
                  onChange={(event) => updateField('indukOrganisasi', event.target.value)}
                  className={inputClass(errors.indukOrganisasi)}
                >
                  <option value="">Pilih induk organisasi</option>
                  {indukOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                {errors.indukOrganisasi && (
                  <span className="font-label-sm text-label-sm text-error">
                    {errors.indukOrganisasi}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="kepalaUnit">
                  Kepala Unit / Penanggung Jawab <span className="text-error">*</span>
                </label>
                <input
                  id="kepalaUnit"
                  type="text"
                  value={form.kepalaUnit}
                  onChange={(event) => updateField('kepalaUnit', event.target.value)}
                  className={inputClass(errors.kepalaUnit)}
                  placeholder="Nama lengkap beserta gelar"
                />
                {errors.kepalaUnit && (
                  <span className="font-label-sm text-label-sm text-error">{errors.kepalaUnit}</span>
                )}
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="nipKepalaUnit">
                  NIP Kepala Unit
                </label>
                <input
                  id="nipKepalaUnit"
                  type="text"
                  value={form.nipKepalaUnit}
                  onChange={(event) => updateField('nipKepalaUnit', event.target.value)}
                  className={inputClass(false)}
                  placeholder="NIP 18 digit"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="email">
                  Email Unit
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className={inputClass(false)}
                  placeholder="unitkerja@kemenag.go.id"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="telepon">
                  Nomor Telepon
                </label>
                <input
                  id="telepon"
                  type="tel"
                  value={form.telepon}
                  onChange={(event) => updateField('telepon', event.target.value)}
                  className={inputClass(false)}
                  placeholder="021-1234567"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="alamat">
                  Alamat Unit Kerja
                </label>
                <textarea
                  id="alamat"
                  value={form.alamat}
                  onChange={(event) => updateField('alamat', event.target.value)}
                  rows="3"
                  className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                  placeholder="Alamat lengkap kantor unit kerja"
                />
              </div>

              <div className="flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="status">
                  Status Unit
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  className={inputClass(false)}
                >
                  {statusOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex flex-col gap-space-2xs">
                <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="catatan">
                  Catatan Tambahan
                </label>
                <textarea
                  id="catatan"
                  value={form.catatan}
                  onChange={(event) => updateField('catatan', event.target.value)}
                  rows="3"
                  className="min-h-[88px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                  placeholder="Informasi tambahan mengenai unit kerja"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md">
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Batal Edit
              </button>
            )}
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
              <span className="material-symbols-outlined text-[18px]">
                {saving ? 'progress_activity' : isEditing ? 'save' : 'add'}
              </span>
              {saving ? 'Menyimpan...' : isEditing ? 'Perbarui Data' : 'Simpan Unit Kerja'}
            </button>
          </div>
        </form>
      </div>

      {/* Read: Tabel Daftar Unit Kerja */}
      <div className="mt-space-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm mb-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
              Tabel Daftar Unit Kerja
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              {loading ? 'Memuat data...' : `${filteredUnits.length} data unit kerja terdaftar`}
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={handleSearch}
              placeholder="Cari berdasarkan Kode / Nama Unit Kerja..."
              aria-label="Cari berdasarkan Kode atau Nama Unit Kerja"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low/50">
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[56px]">
                    No
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    Kode Unit
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    Nama Unit Kerja
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    Jenis Unit
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    Induk Organisasi
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    Kepala Unit
                  </th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">
                    NIP
                  </th>
                  <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                      <span className="flex items-center justify-center gap-space-2xs">
                        <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                        Memuat data dari Supabase...
                      </span>
                    </td>
                  </tr>
                ) : filteredUnits.length > 0 ? (
                  filteredUnits.map((unit, idx) => (
                    <tr
                      key={unit.id}
                      className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">
                        {idx + 1}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-mono">
                        {unit.kodeUnit}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-medium">
                        {unit.namaUnit}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">
                        {unit.jenisUnit}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">
                        {unit.indukOrganisasi}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">
                        {unit.kepalaUnit}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-mono">
                        {unit.nipKepalaUnit || '-'}
                      </td>
                      <td className="px-space-md py-space-sm">
                        <div className="flex items-center justify-center gap-space-2xs">
                          <button
                            type="button"
                            onClick={() => handleEdit(unit)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                            title="Edit"
                            aria-label={`Edit ${unit.namaUnit}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_square</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(unit)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                            title="Hapus"
                            aria-label={`Hapus ${unit.namaUnit}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary"
                    >
                      <span className="flex items-center justify-center gap-space-2xs">
                        <span className="material-symbols-outlined text-[24px]">search_off</span>
                        {search
                          ? `Tidak ada hasil untuk "${search}"`
                          : 'Belum ada data unit kerja'}
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md"
          onClick={() => !deleting && setDeleteTarget(null)}
          role="presentation"
        >
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
            <p className="font-body-md text-body-md text-secondary mb-space-sm">
              Apakah Anda yakin ingin menghapus data Unit Kerja ini?
            </p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.namaUnit}</span>
              <span className="font-mono"> ({deleteTarget.kodeUnit})</span>
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

export default UnitKerjaForm
