import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const initialCreateForm = {
  cascadingId: '',
  rencanaAksi: '',
  targetKinerja: '',
  anggaran: '',
}

const initialEditForm = {
  cascadingId: '',
  rencanaAksi: '',
  targetKinerja: '',
  anggaran: '',
}

// Logika auto-isi target kinerja dari cascading induk:
// - satuan SELAIN 'Persen' (Nilai/Rasio/Teks) -> target cascading
//   otomatis masuk ke target kinerja (tetap bisa diedit).
// - satuan 'Persen' -> dikosongkan agar kepala seksi mengisi
//   sendiri (mis. rincian per triwulan).
function autoTargetFor(cascadingRow) {
  if (!cascadingRow) return { target: '', satuan: 'Persen' }
  const satuan = cascadingRow.satuan ?? 'Persen'
  return {
    target: satuan === 'Persen' ? '' : (cascadingRow.target_cascading ?? ''),
    satuan,
  }
}

function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return `Rp ${num.toLocaleString('id-ID')}`
}

function RencanaAksiForm({ currentUser }) {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rows, setRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')

  // Modal tambah
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createErrors, setCreateErrors] = useState({})
  const [savingCreate, setSavingCreate] = useState(false)

  // Modal edit
  const [editOpen, setEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState(initialEditForm)
  const [editErrors, setEditErrors] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isModalOpen = createOpen || editOpen || deleteTarget !== null

  // ---- READ ----
  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes, unitRes, cascRes, rencanaRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('cascading_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('rencana_aksi_kinerja').select('*').order('created_at', { ascending: false }),
    ])
    const firstError = skRes.error || ikskRes.error || unitRes.error || cascRes.error || rencanaRes.error
    if (firstError) {
      if (firstError.code === '42P01') {
        setFetchError('Salah satu tabel belum ada (perkin_sk / perkin_iksk / unit_kerja / cascading_kinerja / rencana_aksi_kinerja). Jalankan supabase/unit_kerja.sql, perkin.sql, cascading_kinerja.sql, lalu rencana_aksi_kinerja.sql di SQL Editor, kemudian Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${firstError.message}`)
      }
    } else {
      setSkList(skRes.data ?? [])
      setIkskList(ikskRes.data ?? [])
      setUnitList(unitRes.data ?? [])
      setCascadingRows(cascRes.data ?? [])
      setRows(rencanaRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Lookup ----
  const skById = useMemo(() => Object.fromEntries(skList.map((s) => [s.id, s])), [skList])
  const ikskById = useMemo(() => Object.fromEntries(ikskList.map((i) => [i.id, i])), [ikskList])
  const unitById = useMemo(() => Object.fromEntries(unitList.map((u) => [u.id, u])), [unitList])
  const cascadingById = useMemo(
    () => Object.fromEntries(cascadingRows.map((c) => [c.id, c])),
    [cascadingRows],
  )

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  // Unit kerja milik user yang login (cocokkan berdasarkan nama).
  const userUnit = useMemo(() => {
    const name = (currentUser?.unitKerjaNama ?? '').trim().toLowerCase()
    if (!name || unitList.length === 0) return null
    return (
      unitList.find((u) => (u.nama_unit ?? '').trim().toLowerCase() === name) ??
      unitList.find((u) => (u.nama_unit ?? '').toLowerCase().includes(name) || name.includes((u.nama_unit ?? '').toLowerCase())) ??
      null
    )
  }, [currentUser, unitList])

  // Dropdown IKSK: hanya cascading milik seksi user.
  // Fallback ke semua cascading bila unit tidak cocok (mode demo/testing).
  const cascadingOfUnit = useMemo(() => {
    if (userUnit) return cascadingRows.filter((c) => c.unit_kerja_id === userUnit.id)
    return cascadingRows
  }, [cascadingRows, userUnit])

  const tahunOptions = useMemo(() => {
    const set = new Set([
      ...cascadingRows.map((c) => String(c.tahun_anggaran)),
      ...rows.map((r) => String(r.tahun_anggaran)),
    ])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [cascadingRows, rows])

  const selectedCascadingCreate = cascadingById[createForm.cascadingId] || null
  const selectedCascadingEdit = cascadingById[editForm.cascadingId] || null

  // ---- Enrich + filter ----
  const enriched = useMemo(() => rows.map((r) => {
    const cascading = cascadingById[r.cascading_id] || null
    const iksk = cascading ? ikskById[cascading.iksk_id] || null : null
    const sk = iksk ? skById[iksk.sk_id] || null : null
    const unit = cascading ? unitById[cascading.unit_kerja_id] || null : null
    return { ...r, cascading, iksk, sk, unit }
  }), [rows, cascadingById, ikskById, skById, unitById])

  // Kepala seksi hanya melihat rencana milik seksinya.
  const ownRows = useMemo(() => {
    if (!userUnit) return enriched
    return enriched.filter((r) => r.cascading?.unit_kerja_id === userUnit.id)
  }, [enriched, userUnit])

  const keyword = search.trim().toLowerCase()
  const filtered = useMemo(() => ownRows
    .filter((r) => {
      if (filterTahun !== 'Semua' && String(r.tahun_anggaran) !== String(filterTahun)) return false
      if (!keyword) return true
      return (
        (r.rencana_aksi ?? '').toLowerCase().includes(keyword) ||
        (r.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (r.sk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (r.target_kinerja ?? '').toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) => {
      const skA = a.sk?.nomor ?? 999
      const skB = b.sk?.nomor ?? 999
      if (skA !== skB) return skA - skB
      return (a.iksk?.nomor_urut ?? 999) - (b.iksk?.nomor_urut ?? 999)
    }), [ownRows, filterTahun, keyword])

  const totalAnggaran = useMemo(
    () => filtered.reduce((sum, r) => sum + (r.anggaran === null ? 0 : Number(r.anggaran) || 0), 0),
    [filtered],
  )

  // ---- Modal tambah ----
  const openCreate = () => {
    setCreateForm(initialCreateForm)
    setCreateErrors({})
    setSuccessMessage('')
    setFetchError('')
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (savingCreate) return
    setCreateOpen(false)
    setCreateForm(initialCreateForm)
    setCreateErrors({})
  }

  const updateCreate = (field, value) => {
    setCreateForm((c) => {
      const next = { ...c, [field]: value }
      // Pilih IKSK -> auto-isi target kinerja + satuan dari cascading.
      if (field === 'cascadingId') {
        const auto = autoTargetFor(cascadingById[value])
        next.targetKinerja = auto.target
      }
      return next
    })
    setSuccessMessage('')
    if (createErrors[field]) setCreateErrors((c) => ({ ...c, [field]: '' }))
  }

  const validateForm = (form) => {
    const nextErrors = {}
    if (!form.cascadingId) nextErrors.cascadingId = 'Pilih IKSK dari cascading seksi Anda.'
    if (!form.rencanaAksi.trim()) nextErrors.rencanaAksi = 'Rencana aksi kinerja wajib diisi.'
    if (!form.targetKinerja.trim()) nextErrors.targetKinerja = 'Target kinerja wajib diisi.'
    if (form.anggaran.trim() !== '') {
      const num = Number(form.anggaran)
      if (Number.isNaN(num) || num < 0) nextErrors.anggaran = 'Anggaran harus berupa angka ≥ 0 (kosongkan bila tidak ada).'
    }
    return nextErrors
  }

  const handleSubmitCreate = async (event) => {
    event.preventDefault()
    if (savingCreate) return
    const nextErrors = validateForm(createForm)
    setCreateErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const cascading = cascadingById[createForm.cascadingId]
    if (!cascading) {
      setCreateErrors((c) => ({ ...c, cascadingId: 'IKSK yang dipilih tidak ditemukan.' }))
      return
    }
    const auto = autoTargetFor(cascading)
    setSavingCreate(true)
    try {
      const payload = {
        cascading_id: createForm.cascadingId,
        rencana_aksi: createForm.rencanaAksi.trim(),
        target_kinerja: createForm.targetKinerja.trim(),
        satuan: auto.satuan,
        anggaran: createForm.anggaran.trim() === '' ? null : Number(createForm.anggaran),
        tahun_anggaran: cascading.tahun_anggaran,
      }
      const { data, error } = await supabase.from('rencana_aksi_kinerja').insert(payload).select().single()
      if (error) throw error
      setRows((cur) => [data, ...cur])
      setSuccessMessage(`Rencana aksi untuk IKSK ${cascading.iksk_id ? ikskNumber(ikskById[cascading.iksk_id]) : ''} berhasil disimpan.`)
      setCreateForm(initialCreateForm)
      setCreateErrors({})
      setCreateOpen(false)
    } catch (error) {
      setFetchError(`Gagal menyimpan rencana aksi: ${error.message}`)
    } finally {
      setSavingCreate(false)
    }
  }

  // ---- Modal edit ----
  const openEdit = (row) => {
    setEditingRow(row)
    setEditForm({
      cascadingId: row.cascading_id,
      rencanaAksi: row.rencana_aksi ?? '',
      targetKinerja: row.target_kinerja ?? '',
      anggaran: row.anggaran === null || row.anggaran === undefined ? '' : String(row.anggaran),
    })
    setEditErrors({})
    setSuccessMessage('')
    setFetchError('')
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (savingEdit) return
    setEditOpen(false)
    setEditingRow(null)
    setEditForm(initialEditForm)
    setEditErrors({})
  }

  const updateEdit = (field, value) => {
    setEditForm((c) => {
      const next = { ...c, [field]: value }
      if (field === 'cascadingId') {
        const auto = autoTargetFor(cascadingById[value])
        next.targetKinerja = auto.target
      }
      return next
    })
    if (editErrors[field]) setEditErrors((c) => ({ ...c, [field]: '' }))
  }

  const handleSubmitEdit = async (event) => {
    event.preventDefault()
    if (savingEdit || !editingRow) return
    const nextErrors = validateForm(editForm)
    setEditErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const cascading = cascadingById[editForm.cascadingId]
    if (!cascading) {
      setEditErrors((c) => ({ ...c, cascadingId: 'IKSK yang dipilih tidak ditemukan.' }))
      return
    }
    const auto = autoTargetFor(cascading)
    setSavingEdit(true)
    try {
      const { data, error } = await supabase
        .from('rencana_aksi_kinerja')
        .update({
          cascading_id: editForm.cascadingId,
          rencana_aksi: editForm.rencanaAksi.trim(),
          target_kinerja: editForm.targetKinerja.trim(),
          satuan: auto.satuan,
          anggaran: editForm.anggaran.trim() === '' ? null : Number(editForm.anggaran),
          tahun_anggaran: cascading.tahun_anggaran,
        })
        .eq('id', editingRow.id)
        .select()
        .single()
      if (error) throw error
      setRows((cur) => cur.map((r) => (r.id === editingRow.id ? data : r)))
      setSuccessMessage('Rencana aksi kinerja telah diperbarui.')
      setEditOpen(false)
      setEditingRow(null)
    } catch (error) {
      setFetchError(`Gagal memperbarui data: ${error.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // ---- DELETE ----
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('rencana_aksi_kinerja').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setRows((cur) => cur.filter((r) => r.id !== deleteTarget.id))
      setSuccessMessage('Rencana aksi kinerja telah dihapus.')
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
        else if (editOpen) closeEdit()
        else if (createOpen) closeCreate()
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

  const cascadingOptionLabel = (c) => {
    const iksk = ikskById[c.iksk_id]
    const sk = iksk ? skById[iksk.sk_id] : null
    const nomor = iksk ? ikskNumber(iksk) : '-'
    const uraian = iksk ? iksk.uraian.slice(0, 70) : 'IKSK terhapus'
    return `${sk ? `SK ${sk.nomor} · ` : ''}IKSK ${nomor} — ${uraian} (target ${c.target_cascading} ${c.satuan})`
  }

  const renderCascadingInfo = (cascading) => {
    if (!cascading) return null
    const iksk = ikskById[cascading.iksk_id]
    const sk = iksk ? skById[iksk.sk_id] : null
    const auto = autoTargetFor(cascading)
    return (
      <div className="rounded-xl bg-surface-container-low px-space-sm py-space-sm font-body-sm text-body-sm text-secondary">
        {sk && <div className="font-bold text-on-surface">SK {sk.nomor} — {sk.uraian}</div>}
        {iksk && (
          <div className="mt-1">
            <span className="font-bold text-on-surface font-mono">IKSK {ikskNumber(iksk)} — </span>
            {iksk.uraian}
          </div>
        )}
        <span className="block mt-1">
          Target cascading: <span className="font-bold text-on-surface">{cascading.target_cascading}</span>
          {' '}({cascading.satuan}) • T.A {cascading.tahun_anggaran}
        </span>
        <span className="block mt-1 text-primary-container font-semibold">
          {auto.satuan === 'Persen'
            ? 'Satuan Persen: target kinerja dikosongkan — silakan isi sendiri (mis. rincian per triwulan).'
            : `Satuan ${auto.satuan}: target kinerja otomatis terisi "${auto.target}" — tetap bisa diedit.`}
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Kepala Seksi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Rencana Aksi Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Rencana Aksi Kinerja</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">checklist</span>
              {filtered.length} Rencana
            </span>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={cascadingOfUnit.length === 0}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            title={cascadingOfUnit.length === 0 ? 'Belum ada cascading untuk seksi Anda' : 'Tambah rencana aksi baru'}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Tambah Rencana
          </button>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Pilih IKSK dari cascading {userUnit ? <span className="font-bold text-on-surface">{userUnit.nama_unit}</span> : 'seksi Anda'}.
          Target kinerja otomatis terisi bila satuan selain Persen, dan tetap bisa diubah. Anggaran bersifat opsional.
        </p>
      </div>

      {!userUnit && !loading && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-md text-secondary">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <p className="font-body-sm text-body-sm">
            Unit kerja akun Anda (<span className="font-bold">{currentUser?.unitKerjaNama || '-'}</span>) tidak cocok
            dengan Master Unit Kerja, sehingga dropdown menampilkan seluruh cascading. Samakan nama unit di Master User
            agar terfilter otomatis per seksi.
          </p>
        </div>
      )}

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
            <h3 className="font-title-sm text-title-sm font-bold">Rencana aksi berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toolbar filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Daftar Rencana Aksi</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${filtered.length} rencana • Total anggaran ${formatRupiah(totalAnggaran)}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-space-sm w-full lg:w-auto">
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
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari IKSK / rencana aksi..."
              aria-label="Cari rencana aksi"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Read: tabel IKSK | Rencana Aksi | Target | Anggaran | Aksi */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[56px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK (Cascading Seksi)</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Rencana Aksi Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[160px]">Target Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[170px]">Anggaran</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Aksi</th>
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
              ) : filtered.length > 0 ? filtered.map((r, idx) => (
                <tr key={r.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                  <td className="px-space-md py-space-sm max-w-[300px]">
                    {r.iksk
                      ? <>
                        <div className="font-mono font-bold text-on-surface text-body-sm">IKSK {ikskNumber(r.iksk)}</div>
                        <div className="font-body-sm text-body-sm text-on-surface">{r.iksk.uraian}</div>
                        <div className="font-body-sm text-body-sm text-secondary">
                          Cascading: <span className="font-bold">{r.cascading?.target_cascading}</span> ({r.cascading?.satuan})
                        </div>
                      </>
                      : <span className="font-body-sm text-body-sm text-error">IKSK terhapus</span>}
                  </td>
                  <td className="px-space-md py-space-sm max-w-[320px] font-body-sm text-body-sm text-on-surface font-semibold">
                    {r.rencana_aksi}
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <span className="font-body-sm text-body-sm text-on-surface font-extrabold">{r.target_kinerja}</span>
                    <span className={`ml-2 inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${satuanBadge(r.satuan)}`}>
                      {r.satuan}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">
                    {formatRupiah(r.anggaran)}
                  </td>
                  <td className="px-space-md py-space-sm">
                    <div className="flex items-center justify-center gap-space-2xs">
                      <button
                        type="button" onClick={() => openEdit(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                        title="Edit rencana" aria-label="Edit rencana"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_square</span>
                      </button>
                      <button
                        type="button" onClick={() => setDeleteTarget(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                        title="Hapus rencana" aria-label="Hapus rencana"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua'
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada rencana aksi — klik Tambah Rencana untuk menginput kegiatan'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeCreate} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="rencana-form-title"
            className="my-8 w-full max-w-[720px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitCreate} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="rencana-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">Tambah Rencana</h2>
                  <p className="font-body-sm text-body-sm text-secondary">IKSK dari cascading {userUnit ? userUnit.nama_unit : 'seksi Anda'} • T.A {new Date().getFullYear()}</p>
                </div>
                <button type="button" onClick={closeCreate} disabled={savingCreate} aria-label="Tutup formulir"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="raIksk">
                    IKSK <span className="text-error">*</span>
                  </label>
                  <select id="raIksk" value={createForm.cascadingId} onChange={(event) => updateCreate('cascadingId', event.target.value)} className={inputClass(createErrors.cascadingId)}>
                    <option value="">Pilih IKSK cascading seksi</option>
                    {cascadingOfUnit.map((c) => (
                      <option key={c.id} value={c.id}>{cascadingOptionLabel(c)}</option>
                    ))}
                  </select>
                  {createErrors.cascadingId && <span className="font-label-sm text-label-sm text-error">{createErrors.cascadingId}</span>}
                </div>

                {renderCascadingInfo(selectedCascadingCreate)}

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="raRencana">
                    Rencana Aksi Kinerja <span className="text-error">*</span>
                  </label>
                  <textarea id="raRencana" value={createForm.rencanaAksi}
                    onChange={(event) => updateCreate('rencanaAksi', event.target.value)} rows="3"
                    className="min-h-[84px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                    placeholder="Contoh: Bimtek peningkatan kompetensi guru madrasah angkatan 1" />
                  {createErrors.rencanaAksi && <span className="font-label-sm text-label-sm text-error">{createErrors.rencanaAksi}</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="raTarget">
                      Target Kinerja <span className="text-error">*</span>
                    </label>
                    <input id="raTarget" type="text" value={createForm.targetKinerja}
                      onChange={(event) => updateCreate('targetKinerja', event.target.value)}
                      className={inputClass(createErrors.targetKinerja)}
                      placeholder={selectedCascadingCreate && selectedCascadingCreate.satuan !== 'Persen' ? 'Terisi otomatis, bisa diubah' : 'Isi target (mis. 30 Orang / 90%)'} />
                    {createErrors.targetKinerja && <span className="font-label-sm text-label-sm text-error">{createErrors.targetKinerja}</span>}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="raAnggaran">
                      Anggaran <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                    </label>
                    <input id="raAnggaran" type="number" min="0" step="any" value={createForm.anggaran}
                      onChange={(event) => updateCreate('anggaran', event.target.value)}
                      className={inputClass(createErrors.anggaran)} placeholder="Rp — kosongkan bila tidak ada" />
                    {createErrors.anggaran && <span className="font-label-sm text-label-sm text-error">{createErrors.anggaran}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
                <button type="button" onClick={closeCreate} disabled={savingCreate}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">close</span> Batal
                </button>
                <button type="submit" disabled={savingCreate}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">{savingCreate ? 'progress_activity' : 'add_circle'}</span>
                  {savingCreate ? 'Menyimpan...' : 'Simpan Rencana'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edit */}
      {editOpen && editingRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeEdit} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="rencana-edit-title"
            className="my-8 w-full max-w-[720px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitEdit} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="rencana-edit-title" className="font-headline-md text-headline-md text-on-surface font-bold">Edit Rencana</h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {editingRow.iksk ? `IKSK ${ikskNumber(editingRow.iksk)} — ${editingRow.iksk.uraian.slice(0, 60)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeEdit} disabled={savingEdit} aria-label="Tutup"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="reIksk">
                    IKSK <span className="text-error">*</span>
                  </label>
                  <select id="reIksk" value={editForm.cascadingId} onChange={(event) => updateEdit('cascadingId', event.target.value)} className={inputClass(editErrors.cascadingId)}>
                    <option value="">Pilih IKSK cascading seksi</option>
                    {cascadingOfUnit.map((c) => (
                      <option key={c.id} value={c.id}>{cascadingOptionLabel(c)}</option>
                    ))}
                  </select>
                  {editErrors.cascadingId && <span className="font-label-sm text-label-sm text-error">{editErrors.cascadingId}</span>}
                </div>

                {renderCascadingInfo(selectedCascadingEdit)}

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="reRencana">
                    Rencana Aksi Kinerja <span className="text-error">*</span>
                  </label>
                  <textarea id="reRencana" value={editForm.rencanaAksi}
                    onChange={(event) => updateEdit('rencanaAksi', event.target.value)} rows="3"
                    className="min-h-[84px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y" />
                  {editErrors.rencanaAksi && <span className="font-label-sm text-label-sm text-error">{editErrors.rencanaAksi}</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="reTarget">
                      Target Kinerja <span className="text-error">*</span>
                    </label>
                    <input id="reTarget" type="text" value={editForm.targetKinerja}
                      onChange={(event) => updateEdit('targetKinerja', event.target.value)}
                      className={inputClass(editErrors.targetKinerja)} />
                    {editErrors.targetKinerja && <span className="font-label-sm text-label-sm text-error">{editErrors.targetKinerja}</span>}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="reAnggaran">
                      Anggaran <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                    </label>
                    <input id="reAnggaran" type="number" min="0" step="any" value={editForm.anggaran}
                      onChange={(event) => updateEdit('anggaran', event.target.value)}
                      className={inputClass(editErrors.anggaran)} placeholder="Rp — kosongkan bila tidak ada" />
                    {editErrors.anggaran && <span className="font-label-sm text-label-sm text-error">{editErrors.anggaran}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
                <button type="button" onClick={closeEdit} disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">close</span> Batal
                </button>
                <button type="submit" disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">{savingEdit ? 'progress_activity' : 'save'}</span>
                  {savingEdit ? 'Menyimpan...' : 'Perbarui'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"
            className="rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container p-space-lg max-w-[440px] w-full"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-space-sm text-error mb-space-sm">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 id="delete-modal-title" className="font-headline-md text-headline-md font-bold">Konfirmasi Hapus</h3>
            </div>
            <p className="font-body-md text-body-md text-secondary mb-space-sm">Hapus rencana aksi ini?</p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.rencana_aksi?.slice(0, 80)}</span>
              {' '}• Target <span className="font-bold">{deleteTarget.target_kinerja}</span>
            </p>
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

export default RencanaAksiForm
