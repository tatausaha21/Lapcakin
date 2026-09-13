import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const initialForm = {
  namaLengkap: '',
  nip: '',
  username: '',
  email: '',
  noHp: '',
  jabatan: '',
  peran: 'Operator Unit',
  unitKerjaId: '',
  unitKerjaNama: '',
  password: '',
  konfirmasiPassword: '',
  status: 'Aktif',
  catatan: '',
}

const peranOptions = ['Admin Organisasi', 'Kepala Satker', 'Operator Unit', 'Viewer / Auditor']
const statusOptions = ['Aktif', 'Nonaktif', 'Blokir']

const requiredFields = ['namaLengkap', 'username', 'email', 'jabatan', 'peran', 'unitKerjaNama']

// Mapping snake_case (Supabase) <-> camelCase (form/UI)
const fromRow = (row) => ({
  id: row.id,
  namaLengkap: row.nama_lengkap ?? '',
  nip: row.nip ?? '',
  username: row.username ?? '',
  email: row.email ?? '',
  noHp: row.no_hp ?? '',
  jabatan: row.jabatan ?? '',
  peran: row.peran ?? 'Operator Unit',
  unitKerjaId: row.unit_kerja_id ?? '',
  unitKerjaNama: row.unit_kerja_nama ?? '',
  status: row.status ?? 'Aktif',
  catatan: row.catatan ?? '',
  lastLoginAt: row.last_login_at ?? null,
})

const toRow = (form, isEditing) => {
  const payload = {
    nama_lengkap: form.namaLengkap.trim(),
    nip: form.nip.trim() || null,
    username: form.username.trim(),
    email: form.email.trim(),
    no_hp: form.noHp.trim() || null,
    jabatan: form.jabatan.trim(),
    peran: form.peran,
    unit_kerja_id: form.unitKerjaId || null,
    unit_kerja_nama: form.unitKerjaNama,
    status: form.status,
    catatan: form.catatan.trim() || null,
  }
  // Password hanya dikirim saat create, atau saat edit jika diisi (reset password).
  // NOTE: ganti dengan hashing (bcrypt / Supabase Auth) untuk produksi.
  if (!isEditing || form.password.trim()) {
    payload.password_hash = form.password.trim() || null
  }
  return payload
}

function MasterUserForm() {
  const [users, setUsers] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [filterPeran, setFilterPeran] = useState('Semua')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const isEditing = editingId !== null
  const isModalOpen = isFormOpen || deleteTarget !== null

  // ---- READ: units untuk dropdown ----
  const fetchUnitOptions = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('unit_kerja')
      .select('id, nama_unit')
      .order('nama_unit', { ascending: true })
    if (data) setUnitOptions(data)
  }, [])

  // ---- READ: users ----
  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('master_users')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') {
        setFetchError('Tabel "master_users" belum ada. Jalankan file supabase/master_users.sql di SQL Editor Supabase, lalu klik Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${error.message}`)
      }
    } else {
      setUsers((data ?? []).map(fromRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchUnitOptions()
  }, [fetchUsers, fetchUnitOptions])

  const updateField = (field, value) => {
    // Jika unit dipilih dari dropdown, sinkronkan nama + id
    if (field === 'unitKerjaId') {
      const selected = unitOptions.find((u) => u.id === value)
      setForm((current) => ({
        ...current,
        unitKerjaId: value,
        unitKerjaNama: selected ? selected.nama_unit : current.unitKerjaNama,
      }))
    } else {
      setForm((current) => ({ ...current, [field]: value }))
    }
    setSuccessMessage('')
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }))
    }
  }

  const handleSearch = (event) => setSearch(event.target.value)

  // Read: pencarian Nama / Username / Email / NIP + filter peran
  const keyword = search.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const matchKeyword = keyword
      ? user.namaLengkap.toLowerCase().includes(keyword) ||
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        (user.nip ?? '').toLowerCase().includes(keyword)
      : true
    const matchPeran = filterPeran === 'Semua' ? true : user.peran === filterPeran
    return matchKeyword && matchPeran
  })

  const validate = () => {
    const nextErrors = {}
    requiredFields.forEach((field) => {
      if (!form[field] || !form[field].toString().trim()) {
        nextErrors[field] = 'Kolom ini wajib diisi.'
      }
    })
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Format email tidak valid.'
    }
    if (form.nip && !/^[0-9]{8,21}$/.test(form.nip.trim())) {
      nextErrors.nip = 'NIP hanya berupa angka (8-21 digit).'
    }
    // Password: wajib saat tambah, opsional saat edit (hanya jika ingin reset)
    if (!isEditing && !form.password.trim()) {
      nextErrors.password = 'Password wajib diisi untuk user baru.'
    }
    if (form.password && form.password.length < 6) {
      nextErrors.password = 'Password minimal 6 karakter.'
    }
    if (form.password && form.konfirmasiPassword !== form.password) {
      nextErrors.konfirmasiPassword = 'Konfirmasi password tidak sama.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // ---- Modal open / close ----
  const openCreate = () => {
    setForm(initialForm)
    setEditingId(null)
    setErrors({})
    setSuccessMessage('')
    setFetchError('')
    setShowPassword(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setIsFormOpen(false)
    setEditingId(null)
    setForm(initialForm)
    setErrors({})
    setShowPassword(false)
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
    const payload = toRow(form, isEditing)

    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('master_users')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()
        if (error) throw error
        const updated = fromRow(data)
        setUsers((current) => current.map((user) => (user.id === editingId ? updated : user)))
        setSuccessMessage(`User ${updated.namaLengkap} telah diperbarui di master data.`)
      } else {
        const { data, error } = await supabase
          .from('master_users')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        const created = fromRow(data)
        setUsers((current) => [created, ...current])
        setSuccessMessage(`User ${created.namaLengkap} telah ditambahkan ke master data.`)
      }
      setForm(initialForm)
      setEditingId(null)
      setErrors({})
      setShowPassword(false)
      setIsFormOpen(false)
    } catch (error) {
      // Unique violation (Postgres 23505): username / email / nip kembar
      if (error?.code === '23505') {
        const message = error.message ?? ''
        const nextErrors = {}
        if (message.includes('username')) nextErrors.username = 'Username sudah digunakan. Gunakan username lain.'
        else if (message.includes('email')) nextErrors.email = 'Email sudah terdaftar. Gunakan email lain.'
        else if (message.includes('nip')) nextErrors.nip = 'NIP sudah terdaftar.'
        else nextErrors.username = 'Username / Email / NIP sudah digunakan.'
        setErrors((current) => ({ ...current, ...nextErrors }))
      } else {
        setFetchError(`Gagal menyimpan data: ${error.message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // Update: pre-fill formulir di modal dari baris yang dipilih
  const handleEdit = (user) => {
    setEditingId(user.id)
    setForm({
      namaLengkap: user.namaLengkap ?? '',
      nip: user.nip ?? '',
      username: user.username ?? '',
      email: user.email ?? '',
      noHp: user.noHp ?? '',
      jabatan: user.jabatan ?? '',
      peran: user.peran ?? 'Operator Unit',
      unitKerjaId: user.unitKerjaId ?? '',
      unitKerjaNama: user.unitKerjaNama ?? '',
      password: '',
      konfirmasiPassword: '',
      status: user.status ?? 'Aktif',
      catatan: user.catatan ?? '',
    })
    setErrors({})
    setSuccessMessage('')
    setFetchError('')
    setShowPassword(false)
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
    const { error } = await supabase.from('master_users').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) {
      setFetchError(`Gagal menghapus data: ${error.message}`)
      return
    }
    setUsers((current) => current.filter((user) => user.id !== deleteTarget.id))
    setSuccessMessage(`User ${deleteTarget.namaLengkap} telah dihapus dari master data.`)
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

  const peranBadge = (peran) => {
    if (peran === 'Admin Organisasi') return 'bg-primary-fixed text-on-primary-fixed'
    if (peran === 'Kepala Satker') return 'bg-primary-container text-on-primary-container'
    if (peran === 'Viewer / Auditor') return 'bg-surface-container text-secondary'
    return 'bg-surface-container-low text-on-surface'
  }

  const statusBadge = (status) => {
    if (status === 'Aktif') return 'bg-primary-fixed/25 text-primary'
    if (status === 'Blokir') return 'bg-error-container text-on-error-container'
    return 'bg-surface-container text-secondary'
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Master User</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Master User
            </h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">group</span>
              {users.length} Akun
            </span>
          </div>
          {/* Tombol Tambah User -> overflow modal form input */}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Tambah User
          </button>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Kelola akun admin, kepala satker, operator, dan auditor SICAKIN. Klik Tambah User untuk membuka formulir input.
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
            onClick={fetchUsers}
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
            <h3 className="font-title-sm text-title-sm font-bold">Data user berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Overflow modal: form input user (tambah / edit) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto"
          onClick={closeForm}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className="my-8 w-full max-w-[880px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
            <div>
              <h2 id="user-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">{isEditing ? 'Edit User' : 'Tambah User'}</h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Kolom bertanda <span className="text-error font-bold">*</span> wajib diisi
                {isEditing && ' • Kosongkan password jika tidak reset'}
              </p>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="hidden sm:inline-flex items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-surface-container text-secondary font-label-sm font-bold">
                <span className="material-symbols-outlined text-[15px]">group</span>
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
            {/* Identitas */}
            <div>
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface mb-space-sm flex items-center gap-space-2xs">
                <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                Identitas Pengguna
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="namaLengkap">
                    Nama Lengkap <span className="text-error">*</span>
                  </label>
                  <input
                    id="namaLengkap"
                    type="text"
                    value={form.namaLengkap}
                    onChange={(event) => updateField('namaLengkap', event.target.value)}
                    className={inputClass(errors.namaLengkap)}
                    placeholder="Contoh: Dr. Ahmad Baswedan, M.Pd."
                  />
                  {errors.namaLengkap && <span className="font-label-sm text-label-sm text-error">{errors.namaLengkap}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="nip">
                    NIP
                  </label>
                  <input
                    id="nip"
                    type="text"
                    inputMode="numeric"
                    value={form.nip}
                    onChange={(event) => updateField('nip', event.target.value)}
                    className={inputClass(errors.nip)}
                    placeholder="NIP 18 digit (opsional)"
                  />
                  {errors.nip ? (
                    <span className="font-label-sm text-label-sm text-error">{errors.nip}</span>
                  ) : (
                    <span className="font-label-sm text-label-sm text-secondary">Kosongkan jika user non-ASN / tamu.</span>
                  )}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="jabatan">
                    Jabatan <span className="text-error">*</span>
                  </label>
                  <input
                    id="jabatan"
                    type="text"
                    value={form.jabatan}
                    onChange={(event) => updateField('jabatan', event.target.value)}
                    className={inputClass(errors.jabatan)}
                    placeholder="Contoh: Kepala Seksi Pendidikan Madrasah"
                  />
                  {errors.jabatan && <span className="font-label-sm text-label-sm text-error">{errors.jabatan}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="noHp">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    id="noHp"
                    type="tel"
                    value={form.noHp}
                    onChange={(event) => updateField('noHp', event.target.value)}
                    className={inputClass(false)}
                    placeholder="08xx-xxxx-xxxx"
                  />
                </div>
              </div>
            </div>

            {/* Akun & Akses */}
            <div>
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface mb-space-sm flex items-center gap-space-2xs">
                <span className="material-symbols-outlined text-[18px] text-primary">key</span>
                Akun & Hak Akses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="username">
                    Username <span className="text-error">*</span>
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    className={inputClass(errors.username)}
                    placeholder="Contoh: ahmad.baswedan"
                  />
                  {errors.username ? (
                    <span className="font-label-sm text-label-sm text-error">{errors.username}</span>
                  ) : (
                    <span className="font-label-sm text-label-sm text-secondary">Huruf kecil tanpa spasi, harus unik.</span>
                  )}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="email">
                    Email <span className="text-error">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className={inputClass(errors.email)}
                    placeholder="nama@kemenag.go.id"
                  />
                  {errors.email && <span className="font-label-sm text-label-sm text-error">{errors.email}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="password">
                    Password {!isEditing && <span className="text-error">*</span>}
                    {isEditing && <span className="font-label-sm font-normal text-secondary">(kosongkan jika tidak reset)</span>}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isEditing ? 'new-password' : 'new-password'}
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      className={`${inputClass(errors.password)} w-full pr-12`}
                      placeholder={isEditing ? 'Isi untuk reset password' : 'Minimal 6 karakter'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                      title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {errors.password && <span className="font-label-sm text-label-sm text-error">{errors.password}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="konfirmasiPassword">
                    Konfirmasi Password {!isEditing && <span className="text-error">*</span>}
                  </label>
                  <input
                    id="konfirmasiPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.konfirmasiPassword}
                    onChange={(event) => updateField('konfirmasiPassword', event.target.value)}
                    className={inputClass(errors.konfirmasiPassword)}
                    placeholder="Ulangi password"
                  />
                  {errors.konfirmasiPassword && (
                    <span className="font-label-sm text-label-sm text-error">{errors.konfirmasiPassword}</span>
                  )}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="peran">
                    Peran / Role <span className="text-error">*</span>
                  </label>
                  <select id="peran" value={form.peran} onChange={(event) => updateField('peran', event.target.value)} className={inputClass(errors.peran)}>
                    {peranOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  {errors.peran && <span className="font-label-sm text-label-sm text-error">{errors.peran}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="status">
                    Status Akun
                  </label>
                  <select id="status" value={form.status} onChange={(event) => updateField('status', event.target.value)} className={inputClass(false)}>
                    {statusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="unitKerjaId">
                    Unit Kerja <span className="text-error">*</span>
                  </label>
                  <select
                    id="unitKerjaId"
                    value={form.unitKerjaId}
                    onChange={(event) => updateField('unitKerjaId', event.target.value)}
                    className={inputClass(errors.unitKerjaNama)}
                  >
                    <option value="">Pilih unit kerja</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.nama_unit}
                      </option>
                    ))}
                  </select>
                  {errors.unitKerjaNama && <span className="font-label-sm text-label-sm text-error">{errors.unitKerjaNama}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="unitKerjaNama">
                    Nama Unit Kerja (manual)
                  </label>
                  <input
                    id="unitKerjaNama"
                    type="text"
                    value={form.unitKerjaNama}
                    onChange={(event) => updateField('unitKerjaNama', event.target.value)}
                    className={inputClass(false)}
                    placeholder="Otomatis terisi dari dropdown, bisa dikoreksi manual"
                  />
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
                    placeholder="Informasi tambahan mengenai user"
                  />
                </div>
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
              <span className="material-symbols-outlined text-[18px]">{saving ? 'progress_activity' : isEditing ? 'save' : 'person_add'}</span>
              {saving ? 'Menyimpan...' : isEditing ? 'Perbarui Data' : 'Simpan User'}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* Read: Tabel Daftar User */}
      <div className="mt-space-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Tabel Daftar User</h2>
            <p className="font-body-sm text-body-sm text-secondary">
              {loading ? 'Memuat data...' : `${filteredUsers.length} akun terdaftar`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-space-sm w-full lg:w-auto">
            <div className="relative">
              <select
                value={filterPeran}
                onChange={(event) => setFilterPeran(event.target.value)}
                aria-label="Filter berdasarkan peran"
                className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
              >
                <option value="Semua">Semua Peran</option>
                {peranOptions.map((option) => (
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
                placeholder="Cari Nama / Username / Email / NIP..."
                aria-label="Cari user"
                className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              />
              <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low/50">
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[56px]">No</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Nama / Username</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Email / NIP</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Jabatan</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Unit Kerja</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Peran</th>
                  <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap">Status</th>
                  <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">Aksi</th>
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
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user, idx) => (
                    <tr key={user.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                      <td className="px-space-md py-space-sm">
                        <div className="font-body-sm text-body-sm text-on-surface font-bold">{user.namaLengkap}</div>
                        <div className="font-body-sm text-body-sm text-secondary font-mono">@{user.username}</div>
                      </td>
                      <td className="px-space-md py-space-sm">
                        <div className="font-body-sm text-body-sm text-on-surface">{user.email}</div>
                        <div className="font-body-sm text-body-sm text-secondary font-mono">{user.nip || '-'}</div>
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">{user.jabatan}</td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">{user.unitKerjaNama || '-'}</td>
                      <td className="px-space-md py-space-sm">
                        <span className={`inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${peranBadge(user.peran)}`}>
                          {user.peran}
                        </span>
                      </td>
                      <td className="px-space-md py-space-sm">
                        <span className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${statusBadge(user.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {user.status}
                        </span>
                      </td>
                      <td className="px-space-md py-space-sm">
                        <div className="flex items-center justify-center gap-space-2xs">
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                            title="Edit"
                            aria-label={`Edit ${user.namaLengkap}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_square</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                            title="Hapus"
                            aria-label={`Hapus ${user.namaLengkap}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                      <span className="flex items-center justify-center gap-space-2xs">
                        <span className="material-symbols-outlined text-[24px]">search_off</span>
                        {search || filterPeran !== 'Semua' ? 'Tidak ada hasil yang cocok dengan filter' : 'Belum ada data user'}
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
            <p className="font-body-md text-body-md text-secondary mb-space-sm">Apakah Anda yakin ingin menghapus akun user ini?</p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.namaLengkap}</span>
              <span className="font-mono"> (@{deleteTarget.username})</span>
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

export default MasterUserForm
