import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const ACCEPT_ATTR = '.jpg,.jpeg,.png'
const ACCEPTED_EXT = ['jpg', 'jpeg', 'png']
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function galeriUrl(path) {
  if (!path) return ''
  return supabase.storage.from('galeri-portal').getPublicUrl(path).data.publicUrl
}

function isSeksiRole(peran) {
  if (peran === 'Kepala Satker') return true
  return (peran ?? '').toLowerCase().includes('kepala seksi')
}

// Modal Galeri Portal Publik — dibuka dari ikon "Portal Publik" di menu.
// Peran seksi: upload foto dokumentasi + kelola foto unitnya sendiri.
// Peran admin: kurasi tayang (toggle tampil) seluruh foto, tanpa form upload.
function GaleriPortalModal({ currentUser, onClose }) {
  const seksi = isSeksiRole(currentUser?.peran)
  const [unitList, setUnitList] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [tanggal, setTanggal] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const fileInputRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [unitRes, galeriRes] = await Promise.all([
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('galeri_kegiatan').select('*').order('tanggal_kegiatan', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    ])
    const firstError = unitRes.error || galeriRes.error
    if (firstError) {
      if (firstError.code === '42P01') {
        setFetchError('Tabel galeri_kegiatan belum ada. Jalankan supabase/galeri_kegiatan.sql di SQL Editor, kemudian Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${firstError.message}`)
      }
    } else {
      setUnitList(unitRes.data ?? [])
      setRows(galeriRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && !saving && !busyId) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const userUnit = useMemo(() => {
    const name = (currentUser?.unitKerjaNama ?? '').trim().toLowerCase()
    if (!name || unitList.length === 0) return null
    return (
      unitList.find((u) => (u.nama_unit ?? '').trim().toLowerCase() === name) ??
      unitList.find((u) => (u.nama_unit ?? '').toLowerCase().includes(name) || name.includes((u.nama_unit ?? '').toLowerCase())) ??
      null
    )
  }, [currentUser, unitList])

  const visibleRows = useMemo(() => {
    if (!seksi) return rows
    if (!userUnit) return rows
    return rows.filter((r) => r.unit_kerja_id === userUnit.id)
  }, [rows, seksi, userUnit])

  const chooseFile = (f) => {
    setFormError('')
    if (!f) return
    const ext = (f.name.split('.').pop() ?? '').toLowerCase()
    if (!ACCEPTED_EXT.includes(ext)) {
      setFormError('Format foto harus JPG, JPEG, atau PNG.')
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      setFormError('Ukuran foto maksimal 5 MB.')
      return
    }
    setFile(f)
  }

  const resetForm = () => {
    setFile(null)
    setJudul('')
    setDeskripsi('')
    setLokasi('')
    setTanggal(todayISO())
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (saving) return
    setFormError('')
    setSuccessMessage('')
    if (!file) {
      setFormError('Pilih foto terlebih dahulu (JPG / PNG, maks. 5 MB).')
      return
    }
    if (!judul.trim()) {
      setFormError('Judul foto wajib diisi.')
      return
    }
    if (!userUnit) {
      setFormError('Unit kerja akun Anda tidak cocok dengan Master Unit Kerja sehingga foto tidak bisa dikaitkan ke seksi. Samakan nama unit di Master User.')
      return
    }
    setSaving(true)
    try {
      const year = (tanggal || todayISO()).slice(0, 4)
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${year}/${userUnit.id}/${Date.now()}_${safe}`
      const { error: upError } = await supabase.storage.from('galeri-portal').upload(path, file)
      if (upError) throw upError
      const payload = {
        unit_kerja_id: userUnit.id,
        unit_kerja_nama: userUnit.nama_unit,
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || null,
        lokasi: lokasi.trim() || null,
        status_label: 'Dokumentasi Lapangan',
        tanggal_kegiatan: tanggal || null,
        image_path: path,
        image_nama: file.name,
        image_tipe: file.type || null,
        image_size: file.size,
        tampil: true,
        created_by: currentUser?.username ?? null,
      }
      const { data, error: insError } = await supabase.from('galeri_kegiatan').insert(payload).select().single()
      if (insError) {
        await supabase.storage.from('galeri-portal').remove([path])
        throw insError
      }
      setRows((cur) => [data, ...cur])
      setSuccessMessage(`Foto "${data.judul}" berhasil diunggah dan langsung tayang di Portal Publik.`)
      resetForm()
    } catch (err) {
      setFormError(`Gagal mengunggah foto: ${err.message ?? err} Pastikan supabase/galeri_kegiatan.sql sudah dijalankan (bucket galeri-portal).`)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTampil = async (row) => {
    if (busyId) return
    if (seksi && userUnit && row.unit_kerja_id !== userUnit.id) return
    setBusyId(row.id)
    try {
      const { data, error } = await supabase
        .from('galeri_kegiatan')
        .update({ tampil: !row.tampil })
        .eq('id', row.id)
        .select()
        .single()
      if (error) throw error
      setRows((cur) => cur.map((r) => (r.id === row.id ? data : r)))
    } catch (err) {
      setFetchError(`Gagal mengubah status tayang: ${err.message ?? err}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (row) => {
    if (busyId || !seksi) return
    if (!window.confirm(`Hapus foto "${row.judul}" dari galeri portal? Berkas ikut terhapus dari penyimpanan.`)) return
    setBusyId(row.id)
    try {
      const { error } = await supabase.from('galeri_kegiatan').delete().eq('id', row.id)
      if (error) throw error
      if (row.image_path) {
        await supabase.storage.from('galeri-portal').remove([row.image_path])
      }
      setRows((cur) => cur.filter((r) => r.id !== row.id))
      setSuccessMessage(`Foto "${row.judul}" telah dihapus dari galeri.`)
    } catch (err) {
      setFetchError(`Gagal menghapus foto: ${err.message ?? err}`)
    } finally {
      setBusyId(null)
    }
  }

  const inputClass = 'h-[44px] rounded-lg border border-outline-variant bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-space-md" onClick={onClose} role="presentation">
      <div
        role="dialog" aria-modal="true" aria-labelledby="galeri-portal-title"
        className="w-full max-w-[920px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
          <div className="min-w-0">
            <h2 id="galeri-portal-title" className="font-headline-md text-headline-md text-on-surface font-bold flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary">public</span>
              Galeri Portal Publik
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              {seksi
                ? <>Foto dokumentasi {userUnit ? <span className="font-bold text-on-surface">{userUnit.nama_unit}</span> : 'seksi Anda'} yang tayang di halaman publik.</>
                : 'Kurasi tayang foto seluruh seksi (tanpa upload — upload dilakukan akun seksi).'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup galeri"
            className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grow overflow-y-auto p-space-md space-y-space-md">
          {fetchError && (
            <div className="flex items-start gap-space-sm rounded-xl border border-error bg-error-container/40 p-space-md text-error">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <div className="flex-1">
                <h3 className="font-title-sm text-title-sm font-bold">Terjadi kesalahan</h3>
                <p className="font-body-sm text-body-sm">{fetchError}</p>
              </div>
              <button
                type="button" onClick={fetchAll}
                className="inline-flex items-center gap-space-2xs rounded-lg border border-error/30 px-space-sm py-space-2xs font-body-sm text-body-sm font-bold hover:bg-error-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Muat ulang
              </button>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-space-sm rounded-xl border border-primary-fixed bg-primary-fixed/20 p-space-md text-primary">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <p className="font-body-sm text-body-sm">{successMessage}</p>
            </div>
          )}

          {/* Form upload — khusus seksi */}
          {seksi && (
            <form onSubmit={handleUpload} noValidate className="rounded-2xl border border-outline-variant bg-surface p-space-md space-y-space-md">
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary">cloud_upload</span>
                Unggah Foto Baru
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md">
                <div className="md:col-span-5">
                  <div
                    role="button" tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0] ?? null; if (f) chooseFile(f) }}
                    className="rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] p-space-md overflow-hidden"
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Pratinjau foto" className="max-h-[220px] max-w-full object-contain rounded-lg shadow-sm" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[40px] text-primary-container">add_a_photo</span>
                        <span className="font-title-sm text-title-sm font-bold text-on-surface mt-space-xs">Klik / seret foto ke sini</span>
                        <span className="font-body-sm text-body-sm text-secondary mt-1">JPG, JPEG, PNG • maks. 5 MB</span>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) chooseFile(f) }} />
                  {file && (
                    <div className="flex items-center justify-between mt-space-2xs">
                      <span className="font-label-sm text-label-sm text-secondary truncate">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} className="font-body-sm text-body-sm font-bold text-error hover:underline shrink-0 ml-space-xs">
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
                <div className="md:col-span-7 space-y-space-sm">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="galeriJudul">
                      Judul Foto <span className="text-error">*</span>
                    </label>
                    <input id="galeriJudul" type="text" value={judul} onChange={(e) => setJudul(e.target.value)}
                      className={inputClass} placeholder="Mis. Bimtek Akreditasi Madrasah" maxLength={160} />
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="galeriDeskripsi">
                      Deskripsi <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                    </label>
                    <textarea id="galeriDeskripsi" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows="2"
                      className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                      placeholder="Ceritakan kegiatan pada foto..." maxLength={500} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    <div className="flex flex-col gap-space-2xs">
                      <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="galeriTanggal">
                        Tanggal Kegiatan
                      </label>
                      <input id="galeriTanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex flex-col gap-space-2xs">
                      <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="galeriLokasi">
                        Lokasi <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                      </label>
                      <input id="galeriLokasi" type="text" value={lokasi} onChange={(e) => setLokasi(e.target.value)}
                        className={inputClass} placeholder="Mis. Aula Utama" maxLength={120} />
                    </div>
                  </div>
                  {formError && <span className="font-label-sm text-label-sm text-error">{formError}</span>}
                  <button type="submit" disabled={saving}
                    className="inline-flex items-center justify-center gap-space-2xs h-[44px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60 w-full sm:w-auto">
                    <span className="material-symbols-outlined text-[18px]">{saving ? 'progress_activity' : 'cloud_upload'}</span>
                    {saving ? 'Mengunggah...' : 'Unggah ke Portal Publik'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Daftar foto */}
          <div>
            <h3 className="font-title-sm text-title-sm font-bold text-on-surface mb-space-sm">
              {seksi ? `Foto ${userUnit?.nama_unit ?? 'Seksi Anda'}` : 'Semua Foto Seksi'}
              <span className="ml-space-xs font-label-sm text-label-sm text-secondary font-semibold">
                {loading ? 'memuat...' : `${visibleRows.length} foto`}
              </span>
            </h3>
            {loading ? (
              <p className="py-space-xl text-center font-body-sm text-body-sm text-secondary">
                <span className="inline-flex items-center gap-space-2xs">
                  <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                  Memuat foto...
                </span>
              </p>
            ) : visibleRows.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                {visibleRows.map((row) => (
                  <article key={row.id} className="rounded-xl overflow-hidden border border-surface-container bg-surface shadow-sm flex flex-col">
                    <div className="relative h-44 bg-surface-container-low overflow-hidden">
                      <img src={galeriUrl(row.image_path)} alt={row.judul} loading="lazy" className="w-full h-full object-cover" />
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-sm ${row.tampil ? 'bg-primary text-on-primary' : 'bg-black/60 text-white'}`}>
                        {row.tampil ? 'Tayang' : 'Disembunyikan'}
                      </span>
                      {!seksi && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-bold">
                          {row.unit_kerja_nama || '-'}
                        </span>
                      )}
                    </div>
                    <div className="p-space-sm flex-1 flex flex-col">
                      <h4 className="font-body-sm text-body-sm font-bold text-on-surface leading-snug">{row.judul}</h4>
                      {row.deskripsi && (
                        <p className="font-body-sm text-body-sm text-secondary mt-1 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {row.deskripsi}
                        </p>
                      )}
                      <p className="font-label-sm text-label-sm text-secondary mt-1">
                        {formatTanggal(row.tanggal_kegiatan)}{row.lokasi ? ` • ${row.lokasi}` : ''}
                      </p>
                      <div className="flex items-center gap-space-xs mt-space-sm pt-space-sm border-t border-surface-container">
                        <button
                          type="button" onClick={() => handleToggleTampil(row)} disabled={busyId === row.id}
                          className="inline-flex flex-1 items-center justify-center gap-space-2xs h-[36px] rounded-lg border border-outline-variant font-body-sm text-body-sm font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">{row.tampil ? 'visibility_off' : 'visibility'}</span>
                          {busyId === row.id ? '...' : row.tampil ? 'Sembunyikan' : 'Tayangkan'}
                        </button>
                        {seksi && (
                          <button
                            type="button" onClick={() => handleDelete(row)} disabled={busyId === row.id}
                            className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg border border-outline-variant text-error hover:bg-error-container transition-colors disabled:opacity-50"
                            title="Hapus foto" aria-label="Hapus foto"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-outline-variant p-space-xl text-center font-body-sm text-body-sm text-secondary">
                <span className="inline-flex items-center gap-space-2xs">
                  <span className="material-symbols-outlined text-[24px]">add_a_photo</span>
                  {seksi ? 'Belum ada foto — unggah foto pertama melalui form di atas.' : 'Belum ada foto dari seksi mana pun.'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-sm shrink-0">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span> Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default GaleriPortalModal
