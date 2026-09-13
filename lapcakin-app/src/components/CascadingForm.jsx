import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const satuanOptions = ['Persen', 'Nilai', 'Rasio', 'Teks']

const initialCreateForm = {
  skId: '',
  ikskId: '',
  targetCascading: '',
  satuan: 'Persen',
  checkedUnitIds: [],
  catatan: '',
}

const initialEditForm = {
  unitKerjaId: '',
  targetCascading: '',
  satuan: 'Persen',
  catatan: '',
}

function CascadingForm() {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [rows, setRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')
  const [filterUnit, setFilterUnit] = useState('Semua')

  // Modal tambah (multi-unit checklist)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createErrors, setCreateErrors] = useState({})
  const [savingCreate, setSavingCreate] = useState(false)
  const [unitSearch, setUnitSearch] = useState('')

  // Modal edit (satu baris)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState(initialEditForm)
  const [editErrors, setEditErrors] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isModalOpen = createOpen || editOpen || deleteTarget !== null

  // ---- READ: master perkin + master unit kerja + cascading ----
  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes, unitRes, cascRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('cascading_kinerja').select('*').order('created_at', { ascending: false }),
    ])
    const firstError = skRes.error || ikskRes.error || unitRes.error || cascRes.error
    if (firstError) {
      if (firstError.code === '42P01') {
        setFetchError('Salah satu tabel belum ada (perkin_sk / perkin_iksk / unit_kerja / cascading_kinerja). Jalankan supabase/unit_kerja.sql, perkin.sql, lalu cascading_kinerja.sql di SQL Editor, kemudian Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${firstError.message}`)
      }
    } else {
      setSkList(skRes.data ?? [])
      setIkskList(ikskRes.data ?? [])
      setUnitList(unitRes.data ?? [])
      setRows(cascRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---- Join lookup ----
  const skById = useMemo(() => Object.fromEntries(skList.map((s) => [s.id, s])), [skList])
  const ikskById = useMemo(() => Object.fromEntries(ikskList.map((i) => [i.id, i])), [ikskList])
  const unitById = useMemo(() => Object.fromEntries(unitList.map((u) => [u.id, u])), [unitList])

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  const tahunOptions = useMemo(() => {
    const set = new Set([...skList.map((s) => String(s.tahun_anggaran)), ...rows.map((r) => String(r.tahun_anggaran))])
    return [...set].filter(Boolean).sort((a, b) => Number(b) - Number(a))
  }, [skList, rows])

  // IKSK terfilter SK pada form tambah
  const ikskOfSk = useMemo(() => {
    if (!createForm.skId) return ikskList
    return ikskList.filter((i) => i.sk_id === createForm.skId).sort((a, b) => a.nomor_urut - b.nomor_urut)
  }, [ikskList, createForm.skId])

  const selectedIksk = ikskById[createForm.ikskId] || null
  const selectedSk = selectedIksk ? skById[selectedIksk.sk_id] : (skById[createForm.skId] || null)

  // Unit yang sudah terpasang pada IKSK terpilih (agar tidak dobel)
  const assignedUnitIds = useMemo(() => {
    if (!createForm.ikskId) return new Set()
    return new Set(rows.filter((r) => r.iksk_id === createForm.ikskId).map((r) => r.unit_kerja_id))
  }, [rows, createForm.ikskId])

  const filteredUnitsChecklist = useMemo(() => {
    const kw = unitSearch.trim().toLowerCase()
    if (!kw) return unitList
    return unitList.filter(
      (u) =>
        (u.nama_unit ?? '').toLowerCase().includes(kw) ||
        (u.kode_unit ?? '').toLowerCase().includes(kw) ||
        (u.kepala_unit ?? '').toLowerCase().includes(kw),
    )
  }, [unitList, unitSearch])

  // ---- Read: enrich + filter ----
  const enriched = useMemo(() => rows.map((r) => ({
    ...r,
    iksk: ikskById[r.iksk_id] || null,
    sk: ikskById[r.iksk_id] ? skById[ikskById[r.iksk_id].sk_id] || null : null,
    unit: unitById[r.unit_kerja_id] || null,
  })), [rows, ikskById, skById, unitById])

  const keyword = search.trim().toLowerCase()
  const filtered = useMemo(() => enriched
    .filter((r) => {
      if (filterTahun !== 'Semua' && String(r.tahun_anggaran) !== String(filterTahun)) return false
      if (filterUnit !== 'Semua' && r.unit_kerja_id !== filterUnit) return false
      if (!keyword) return true
      return (
        (r.sk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (r.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
        (r.unit?.nama_unit ?? '').toLowerCase().includes(keyword) ||
        (r.unit?.kode_unit ?? '').toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) => {
      const skA = a.sk?.nomor ?? 999
      const skB = b.sk?.nomor ?? 999
      if (skA !== skB) return skA - skB
      const uA = a.iksk?.nomor_urut ?? 999
      const uB = b.iksk?.nomor_urut ?? 999
      if (uA !== uB) return uA - uB
      return (a.unit?.nama_unit ?? '').localeCompare(b.unit?.nama_unit ?? '')
    }), [enriched, filterTahun, filterUnit, keyword])

  // ---- Modal tambah ----
  const openCreate = () => {
    setCreateForm(initialCreateForm)
    setCreateErrors({})
    setUnitSearch('')
    setSuccessMessage('')
    setFetchError('')
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (savingCreate) return
    setCreateOpen(false)
    setCreateForm(initialCreateForm)
    setCreateErrors({})
    setUnitSearch('')
  }

  const updateCreate = (field, value) => {
    setCreateForm((c) => {
      const next = { ...c, [field]: value }
      // Ganti SK -> reset IKSK agar selalu konsisten
      if (field === 'skId') {
        next.ikskId = ''
        next.targetCascading = ''
      }
      // Pilih IKSK -> auto-isi target & satuan dari master perkin
      if (field === 'ikskId') {
        const iksk = ikskById[value]
        if (iksk) {
          next.targetCascading = iksk.target_tahunan
          next.satuan = iksk.satuan
        }
      }
      return next
    })
    setSuccessMessage('')
    if (createErrors[field]) setCreateErrors((c) => ({ ...c, [field]: '' }))
  }

  const toggleUnit = (unitId) => {
    if (assignedUnitIds.has(unitId)) return // sudah terpasang, tidak bisa diceklis lagi
    setCreateForm((c) => {
      const has = c.checkedUnitIds.includes(unitId)
      return { ...c, checkedUnitIds: has ? c.checkedUnitIds.filter((id) => id !== unitId) : [...c.checkedUnitIds, unitId] }
    })
    if (createErrors.checkedUnitIds) setCreateErrors((c) => ({ ...c, checkedUnitIds: '' }))
  }

  const selectAllUnits = () => {
    const available = filteredUnitsChecklist.filter((u) => !assignedUnitIds.has(u.id)).map((u) => u.id)
    setCreateForm((c) => ({ ...c, checkedUnitIds: [...new Set([...c.checkedUnitIds, ...available])] }))
  }

  const clearUnits = () => {
    setCreateForm((c) => ({ ...c, checkedUnitIds: [] }))
  }

  const handleSubmitCreate = async (event) => {
    event.preventDefault()
    if (savingCreate) return
    const nextErrors = {}
    if (!createForm.ikskId) nextErrors.ikskId = 'Pilih IKSK dari master PERKIN.'
    if (!createForm.targetCascading.trim()) nextErrors.targetCascading = 'Target cascading wajib diisi.'
    if (!createForm.satuan) nextErrors.satuan = 'Pilih satuan.'
    if (createForm.checkedUnitIds.length === 0) nextErrors.checkedUnitIds = 'Ceklis minimal satu unit kerja penanggung jawab.'
    setCreateErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // Pisahkan yang sudah ada (hindari konflik unique)
    const fresh = createForm.checkedUnitIds.filter((id) => !assignedUnitIds.has(id))
    if (fresh.length === 0) {
      setCreateErrors((c) => ({ ...c, checkedUnitIds: 'Semua unit yang diceklis sudah terpasang pada IKSK ini.' }))
      return
    }

    setSavingCreate(true)
    try {
      const iksk = ikskById[createForm.ikskId]
      const sk = iksk ? skById[iksk.sk_id] : null
      const payload = fresh.map((unitId) => ({
        iksk_id: createForm.ikskId,
        unit_kerja_id: unitId,
        target_cascading: createForm.targetCascading.trim(),
        satuan: createForm.satuan,
        tahun_anggaran: sk ? sk.tahun_anggaran : new Date().getFullYear(),
        catatan: createForm.catatan.trim() || null,
      }))
      const { data, error } = await supabase.from('cascading_kinerja').insert(payload).select()
      if (error) throw error
      setRows((cur) => [...(data ?? []), ...cur])
      const skipped = createForm.checkedUnitIds.length - fresh.length
      setSuccessMessage(
        `Cascading IKSK ${iksk ? ikskNumber(iksk) : ''} ditugaskan ke ${fresh.length} unit kerja.` +
        (skipped > 0 ? ` ${skipped} unit dilewati (sudah terpasang).` : ''),
      )
      setCreateForm(initialCreateForm)
      setCreateErrors({})
      setUnitSearch('')
      setCreateOpen(false)
    } catch (error) {
      if (error?.code === '23505') {
        setCreateErrors((c) => ({ ...c, checkedUnitIds: 'Sebagian unit sudah terpasang pada IKSK ini dan dilewati.' }))
        fetchAll()
      } else {
        setFetchError(`Gagal menyimpan cascading: ${error.message}`)
      }
    } finally {
      setSavingCreate(false)
    }
  }

  // ---- Modal edit (satu baris) ----
  const openEdit = (row) => {
    setEditingRow(row)
    setEditForm({
      unitKerjaId: row.unit_kerja_id,
      targetCascading: row.target_cascading ?? '',
      satuan: row.satuan ?? 'Persen',
      catatan: row.catatan ?? '',
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

  const handleSubmitEdit = async (event) => {
    event.preventDefault()
    if (savingEdit || !editingRow) return
    const nextErrors = {}
    if (!editForm.unitKerjaId) nextErrors.unitKerjaId = 'Pilih unit kerja.'
    if (!editForm.targetCascading.trim()) nextErrors.targetCascading = 'Target wajib diisi.'
    if (!editForm.satuan) nextErrors.satuan = 'Pilih satuan.'
    setEditErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSavingEdit(true)
    try {
      const { data, error } = await supabase
        .from('cascading_kinerja')
        .update({
          unit_kerja_id: editForm.unitKerjaId,
          target_cascading: editForm.targetCascading.trim(),
          satuan: editForm.satuan,
          catatan: editForm.catatan.trim() || null,
        })
        .eq('id', editingRow.id)
        .select()
        .single()
      if (error) throw error
      setRows((cur) => cur.map((r) => (r.id === editingRow.id ? data : r)))
      setSuccessMessage('Penugasan cascading telah diperbarui.')
      setEditOpen(false)
      setEditingRow(null)
    } catch (error) {
      if (error?.code === '23505') {
        setEditErrors((c) => ({ ...c, unitKerjaId: 'Unit ini sudah terpasang pada IKSK yang sama.' }))
      } else {
        setFetchError(`Gagal memperbarui data: ${error.message}`)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  // ---- DELETE ----
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('cascading_kinerja').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setRows((cur) => cur.filter((r) => r.id !== deleteTarget.id))
      setSuccessMessage('Penugasan cascading telah dihapus.')
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

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Cascading Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Cascading Kinerja</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">account_tree</span>
              {filtered.length} Penugasan
            </span>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={ikskList.length === 0 || unitList.length === 0}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            title={ikskList.length === 0 ? 'Isi Master PERKIN dulu' : unitList.length === 0 ? 'Isi Master Unit Kerja dulu' : 'Tugaskan IKSK ke unit kerja'}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Tambah Cascading
          </button>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Ambil SK / IKSK / Target / Satuan dari Master PERKIN, pilih penanggung jawab dari Master Unit Kerja. Satu IKSK dapat diceklis ke beberapa unit sekaligus.
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
            <h3 className="font-title-sm text-title-sm font-bold">Cascading berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toolbar filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Daftar Cascading</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${filtered.length} penugasan IKSK ke unit kerja`}
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
          <div className="relative">
            <select
              value={filterUnit}
              onChange={(event) => setFilterUnit(event.target.value)}
              aria-label="Filter unit kerja"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none max-w-[260px]"
            >
              <option value="Semua">Semua Unit</option>
              {unitList.map((u) => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">apartment</span>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari SK / IKSK / Unit..."
              aria-label="Cari cascading"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Read: tabel SK | IKSK | Target | Satuan | Penanggung jawab | Aksi */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[56px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">SK (Sasaran Kegiatan)</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK + Target Induk</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">Target Cascading</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[100px]">Satuan</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Penanggung Jawab</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Aksi</th>
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
              ) : filtered.length > 0 ? filtered.map((r, idx) => (
                <tr key={r.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                  <td className="px-space-md py-space-sm max-w-[260px]">
                    {r.sk
                      ? <><span className="font-mono font-bold text-primary">{r.sk.nomor}. </span><span className="font-body-sm text-body-sm text-on-surface">{r.sk.uraian}</span></>
                      : <span className="font-body-sm text-body-sm text-error">SK terhapus</span>}
                  </td>
                  <td className="px-space-md py-space-sm max-w-[300px]">
                    {r.iksk
                      ? <>
                        <div className="font-mono font-bold text-on-surface text-body-sm">{ikskNumber(r.iksk)}</div>
                        <div className="font-body-sm text-body-sm text-on-surface">{r.iksk.uraian}</div>
                        <div className="font-body-sm text-body-sm text-secondary">Induk: <span className="font-bold">{r.iksk.target_tahunan}</span> ({r.iksk.satuan})</div>
                      </>
                      : <span className="font-body-sm text-body-sm text-error">IKSK terhapus</span>}
                  </td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-extrabold whitespace-nowrap">{r.target_cascading}</td>
                  <td className="px-space-md py-space-sm">
                    <span className={`inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${satuanBadge(r.satuan)}`}>
                      {r.satuan}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm max-w-[240px]">
                    {r.unit
                      ? <>
                        <div className="font-body-sm text-body-sm text-on-surface font-bold">{r.unit.nama_unit}</div>
                        <div className="font-body-sm text-body-sm text-secondary font-mono">{r.unit.kode_unit}</div>
                        <div className="font-body-sm text-body-sm text-secondary">PJ: {r.unit.kepala_unit || '-'}</div>
                      </>
                      : <span className="font-body-sm text-body-sm text-error">Unit terhapus</span>}
                  </td>
                  <td className="px-space-md py-space-sm">
                    <div className="flex items-center justify-center gap-space-2xs">
                      <button
                        type="button" onClick={() => openEdit(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                        title="Edit penugasan" aria-label="Edit penugasan"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_square</span>
                      </button>
                      <button
                        type="button" onClick={() => setDeleteTarget(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                        title="Hapus penugasan" aria-label="Hapus penugasan"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterUnit !== 'Semua'
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada cascading — klik Tambah Cascading untuk menugaskan IKSK ke unit kerja'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah: pilih IKSK + ceklis multi unit */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeCreate} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="cascading-form-title"
            className="my-8 w-full max-w-[860px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitCreate} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="cascading-form-title" className="font-headline-md text-headline-md text-on-surface font-bold">Tambah Cascading</h2>
                  <p className="font-body-sm text-body-sm text-secondary">SK / IKSK / Target dari Master PERKIN • PJ dari Master Unit Kerja</p>
                </div>
                <button type="button" onClick={closeCreate} disabled={savingCreate} aria-label="Tutup formulir"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="csSk">Sasaran Kegiatan (SK)</label>
                    <select id="csSk" value={createForm.skId} onChange={(event) => updateCreate('skId', event.target.value)} className={inputClass(false)}>
                      <option value="">Semua SK</option>
                      {skList.map((sk) => (
                        <option key={sk.id} value={sk.id}>{sk.nomor} — {sk.uraian.slice(0, 70)}{sk.uraian.length > 70 ? '...' : ''} (T.A {sk.tahun_anggaran})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="csIksk">
                      IKSK <span className="text-error">*</span>
                    </label>
                    <select id="csIksk" value={createForm.ikskId} onChange={(event) => updateCreate('ikskId', event.target.value)} className={inputClass(createErrors.ikskId)}>
                      <option value="">Pilih IKSK</option>
                      {ikskOfSk.map((i) => {
                        const sk = skById[i.sk_id]
                        return <option key={i.id} value={i.id}>{sk ? `${sk.nomor}.${i.nomor_urut}` : ''} — {i.uraian.slice(0, 70)} (target {i.target_tahunan})</option>
                      })}
                    </select>
                    {createErrors.ikskId && <span className="font-label-sm text-label-sm text-error">{createErrors.ikskId}</span>}
                  </div>
                </div>

                {selectedIksk && (
                  <div className="rounded-xl bg-surface-container-low px-space-sm py-space-sm font-body-sm text-body-sm text-secondary">
                    <span className="font-bold text-on-surface font-mono">{selectedSk ? `${selectedSk.nomor}` : ''}.{selectedIksk.nomor_urut} — </span>
                    {selectedIksk.uraian}
                    <span className="block mt-1">Target induk: <span className="font-bold text-on-surface">{selectedIksk.target_tahunan}</span> ({selectedIksk.satuan}) • Polaritas: <span className="font-bold">{selectedIksk.polaritas}</span></span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="csTarget">
                      Target Cascading <span className="text-error">*</span>
                    </label>
                    <input id="csTarget" type="text" value={createForm.targetCascading}
                      onChange={(event) => updateCreate('targetCascading', event.target.value)}
                      className={inputClass(createErrors.targetCascading)} placeholder="Otomatis dari IKSK, bisa disesuaikan per unit" />
                    {createErrors.targetCascading && <span className="font-label-sm text-label-sm text-error">{createErrors.targetCascading}</span>}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="csSatuan">
                      Satuan <span className="text-error">*</span>
                    </label>
                    <select id="csSatuan" value={createForm.satuan} onChange={(event) => updateCreate('satuan', event.target.value)} className={inputClass(createErrors.satuan)}>
                      {satuanOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-2xs">
                    <span className="font-label-md text-label-md font-bold text-on-surface">
                      Penanggung Jawab — ceklis unit kerja <span className="text-error">*</span>
                      <span className="ml-1 font-label-sm font-bold text-primary">({createForm.checkedUnitIds.length} dipilih)</span>
                    </span>
                    <div className="flex gap-space-2xs">
                      <button type="button" onClick={selectAllUnits} className="font-body-sm text-body-sm font-bold text-primary hover:underline">Pilih tampil</button>
                      <span className="text-secondary">•</span>
                      <button type="button" onClick={clearUnits} className="font-body-sm text-body-sm font-bold text-secondary hover:underline">Bersihkan</button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="search" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)}
                      placeholder="Cari unit / kode / kepala unit..."
                      className="w-full h-[40px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
                    />
                    <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
                  </div>
                  <div className="rounded-xl border border-outline-variant overflow-hidden max-h-[260px] overflow-y-auto">
                    {filteredUnitsChecklist.length > 0 ? filteredUnitsChecklist.map((u) => {
                      const checked = createForm.checkedUnitIds.includes(u.id)
                      const assigned = assignedUnitIds.has(u.id)
                      return (
                        <label
                          key={u.id}
                          className={`flex items-start gap-space-sm px-space-sm py-space-xs border-b border-surface-container last:border-0 transition-colors ${
                            assigned ? 'opacity-50 bg-surface-container-low/50' : checked ? 'bg-primary-fixed/15 hover:bg-primary-fixed/25' : 'hover:bg-surface-container-low/50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={assigned}
                            onChange={() => toggleUnit(u.id)}
                            className="mt-1 w-[18px] h-[18px] accent-primary"
                          />
                          <span className="flex-1">
                            <span className="block font-body-sm text-body-sm font-bold text-on-surface">
                              {u.nama_unit}
                              {assigned && <span className="ml-2 font-label-sm font-bold text-secondary">(sudah terpasang)</span>}
                            </span>
                            <span className="block font-body-sm text-body-sm text-secondary font-mono">{u.kode_unit} • PJ: {u.kepala_unit || '-'}</span>
                          </span>
                        </label>
                      )
                    }) : (
                      <p className="px-space-sm py-space-md text-center font-body-sm text-body-sm text-secondary">Tidak ada unit yang cocok.</p>
                    )}
                  </div>
                  {createErrors.checkedUnitIds && <span className="font-label-sm text-label-sm text-error">{createErrors.checkedUnitIds}</span>}
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="csCatatan">Catatan</label>
                  <textarea id="csCatatan" value={createForm.catatan} onChange={(event) => updateCreate('catatan', event.target.value)} rows="2"
                    className="min-h-[64px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                    placeholder="Contoh: pembagian target per wilayah" />
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
                  {savingCreate ? 'Menyimpan...' : `Tugaskan ke ${createForm.checkedUnitIds.length} Unit`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edit satu baris */}
      {editOpen && editingRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={closeEdit} role="presentation">
          <div
            role="dialog" aria-modal="true" aria-labelledby="cascading-edit-title"
            className="my-8 w-full max-w-[620px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmitEdit} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
                <div>
                  <h2 id="cascading-edit-title" className="font-headline-md text-headline-md text-on-surface font-bold">Edit Penugasan</h2>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {editingRow.iksk ? `${ikskNumber(editingRow.iksk)} — ${editingRow.iksk.uraian.slice(0, 60)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeEdit} disabled={savingEdit} aria-label="Tutup"
                  className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-space-md space-y-space-md overflow-y-auto grow">
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ceUnit">
                    Penanggung Jawab (Unit Kerja) <span className="text-error">*</span>
                  </label>
                  <select id="ceUnit" value={editForm.unitKerjaId}
                    onChange={(event) => { setEditForm((c) => ({ ...c, unitKerjaId: event.target.value })); if (editErrors.unitKerjaId) setEditErrors((c) => ({ ...c, unitKerjaId: '' })) }}
                    className={inputClass(editErrors.unitKerjaId)}>
                    <option value="">Pilih unit kerja</option>
                    {unitList.map((u) => <option key={u.id} value={u.id}>{u.nama_unit} ({u.kode_unit})</option>)}
                  </select>
                  {editErrors.unitKerjaId && <span className="font-label-sm text-label-sm text-error">{editErrors.unitKerjaId}</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ceTarget">
                      Target Cascading <span className="text-error">*</span>
                    </label>
                    <input id="ceTarget" type="text" value={editForm.targetCascading}
                      onChange={(event) => { setEditForm((c) => ({ ...c, targetCascading: event.target.value })); if (editErrors.targetCascading) setEditErrors((c) => ({ ...c, targetCascading: '' })) }}
                      className={inputClass(editErrors.targetCascading)} />
                    {editErrors.targetCascading && <span className="font-label-sm text-label-sm text-error">{editErrors.targetCascading}</span>}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ceSatuan">Satuan <span className="text-error">*</span></label>
                    <select id="ceSatuan" value={editForm.satuan}
                      onChange={(event) => setEditForm((c) => ({ ...c, satuan: event.target.value }))} className={inputClass(false)}>
                      {satuanOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="ceCatatan">Catatan</label>
                  <textarea id="ceCatatan" value={editForm.catatan}
                    onChange={(event) => setEditForm((c) => ({ ...c, catatan: event.target.value }))} rows="2"
                    className="min-h-[64px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y" />
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
            <p className="font-body-md text-body-md text-secondary mb-space-sm">Lepas penugasan IKSK ini dari unit kerja?</p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.unit?.nama_unit ?? 'Unit'}</span>
              {' '}← IKSK <span className="font-mono font-bold">{deleteTarget.iksk ? ikskNumber(deleteTarget.iksk) : ''}</span>
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

export default CascadingForm
