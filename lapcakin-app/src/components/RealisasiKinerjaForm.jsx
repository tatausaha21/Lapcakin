import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { deleteFromDrive } from '../lib/driveUpload'
import { uploadMultipleBukti, cleanupUploaded, fetchBuktiMap, deleteBuktiRow } from '../lib/buktiFiles'

// ---------- Rumus % realisasi target ----------
// Ambil angka pertama dari teks ("50%" -> 50, "1:5" -> 1, "Baik" -> NaN).
function parseNum(str) {
  if (str === null || str === undefined) return NaN
  const m = String(str).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

// Satuan Persen: (realisasi / target) * 100, capping 0%..120%.
function calcPersen(realisasi, target) {
  const r = parseNum(realisasi)
  const t = parseNum(target)
  if (Number.isNaN(r) || Number.isNaN(t) || t === 0) return null
  return Math.min(120, Math.max(0, (r / t) * 100))
}

// Satuan selain Persen (Nilai/Rasio/Teks): target - realisasi.
function calcSelisih(realisasi, target) {
  const r = parseNum(realisasi)
  const t = parseNum(target)
  if (Number.isNaN(r) || Number.isNaN(t)) return null
  return t - r
}

function formatSelisih(value) {
  if (value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
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

// Triwulan dari tanggal kegiatan (untuk filter + badge).
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

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ACCEPTED_EXT = ['pdf', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']
const ACCEPT_ATTR = '.pdf,.xls,.xlsx,.jpg,.jpeg,.png'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

function validateFile(file) {
  if (!file) return ''
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ACCEPTED_EXT.includes(ext)) return 'Format berkas harus PDF, Excel (xls/xlsx), JPG, atau PNG.'
  if (file.size > MAX_FILE_BYTES) return 'Ukuran berkas maksimal 10 MB.'
  return ''
}

function buktiUrl(path) {
  if (!path) return '#'
  return supabase.storage.from('bukti-dukung').getPublicUrl(path).data.publicUrl
}

const wizardSteps = [
  { id: 0, label: 'Rencana & Realisasi', icon: 'edit_note' },
  { id: 1, label: 'Anggaran & Kendala', icon: 'payments' },
  { id: 2, label: 'Bukti Dukung', icon: 'upload_file' },
]

function buktiKind(nama) {
  const ext = (nama?.split('.').pop() ?? '').toLowerCase()
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx'].includes(ext)) return 'excel'
  return 'other'
}

// ---------- Modal viewer dokumen bukti dukung (dipakai ulang di Laporan) ----------
// Mendukung multi-dokumen: teruskan `files` (array baris lampiran) bila ada,
// fallback ke `row` tunggal untuk kompatibilitas mundur.
export function BuktiViewer({ row, files, onClose }) {
  const [idx, setIdx] = useState(0)
  const list = Array.isArray(files) && files.length > 0 ? files : (row ? [row] : [])
  const active = list[Math.min(idx, Math.max(list.length - 1, 0))] || {}
  const url = buktiUrl(active.bukti_path)
  const kind = buktiKind(active.bukti_nama)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-space-md" onClick={onClose} role="presentation">
      <div
        role="dialog" aria-modal="true" aria-labelledby="bukti-viewer-title"
        className="w-full max-w-[860px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                {kind === 'image' ? 'image' : kind === 'pdf' ? 'picture_as_pdf' : kind === 'excel' ? 'table_chart' : 'description'}
              </span>
            </div>
            <div className="min-w-0">
              <h2 id="bukti-viewer-title" className="font-title-sm text-title-sm font-bold text-on-surface truncate">
                {active.bukti_nama || 'Bukti Dukung'}
              </h2>
              <p className="font-label-sm text-label-sm text-secondary">
                {formatSize(active.bukti_size)}{active.bukti_tipe ? ` • ${active.bukti_tipe}` : ''}
                {list.length > 1 ? ` • Dokumen ${idx + 1} dari ${list.length}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup viewer"
            className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grow overflow-auto bg-surface-container-low/40 min-h-[300px] flex flex-col">
          {kind === 'image' ? (
            <img src={url} alt={active.bukti_nama || 'Bukti dukung'} className="m-auto max-h-[62vh] max-w-full object-contain rounded-lg shadow-sm" />
          ) : kind === 'pdf' ? (
            <iframe src={url} title={active.bukti_nama || 'Bukti PDF'} className="w-full h-[62vh] bg-white" />
          ) : (
            <div className="m-auto flex flex-col items-center text-center p-space-xl gap-space-xs">
              <span className="material-symbols-outlined text-[56px] text-secondary">table_chart</span>
              <p className="font-title-sm text-title-sm font-bold text-on-surface">Pratinjau Excel tidak tersedia</p>
              <p className="font-body-sm text-body-sm text-secondary max-w-md">
                Berkas spreadsheet tidak dapat ditampilkan langsung di peramban. Unduh untuk melihat isi lengkapnya.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
          {list.length > 1 ? (
            <div className="flex items-center gap-space-2xs">
              <button type="button" onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)}
                className="inline-flex items-center justify-center h-[42px] px-space-sm rounded-lg border border-outline-variant font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors"
                aria-label="Dokumen sebelumnya">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="font-label-md text-label-md font-bold text-secondary min-w-[90px] text-center">{idx + 1} / {list.length}</span>
              <button type="button" onClick={() => setIdx((i) => (i + 1) % list.length)}
                className="inline-flex items-center justify-center h-[42px] px-space-sm rounded-lg border border-outline-variant font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors"
                aria-label="Dokumen berikutnya">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          ) : <span />}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-space-sm">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span> Tutup
          </button>
          <a href={url} target="_blank" rel="noreferrer" download
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span> Unduh Dokumen
          </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Modal wizard tambah/edit (navigasi bulir + geser) ----------
function RealisasiWizard({
  title, subtitle, submitLabel, saving, onClose, onSubmit,
  rencanaOptions, rencanaById, ikskById, skById, ikskNumber,
  initial, prevTotals, accumulate = true,
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initial)
  const [newFiles, setNewFiles] = useState([])
  const [removedIds, setRemovedIds] = useState([])
  const [errors, setErrors] = useState({})
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const existingList = useMemo(
    () => (initial.existingBuktiList ?? []).filter((b) => !removedIds.includes(b.id)),
    [initial.existingBuktiList, removedIds],
  )

  const pickFile = () => fileInputRef.current?.click()

  const chooseFiles = (fileList) => {
    const picked = [...fileList].filter(Boolean)
    if (picked.length === 0) return
    setNewFiles((cur) => [...cur, ...picked])
    setDragOver(false)
    if (errors.bukti) setErrors((c) => ({ ...c, bukti: '' }))
  }

  const removeNewFile = (index) => setNewFiles((cur) => cur.filter((_, i) => i !== index))

  const update = (field, value) => {
    setForm((c) => ({ ...c, [field]: value }))
    if (errors[field]) setErrors((c) => ({ ...c, [field]: '' }))
  }

  const selectedRencana = rencanaById[form.rencanaAksiId] || null
  const selectedIksk = selectedRencana ? ikskById[selectedRencana.ikskId] || null : null
  // Pratinjau akumulasi: isian baru ditambahkan ke total sebelumnya.
  const prevTotal = prevTotals?.[form.rencanaAksiId]
  const inputNum = parseNum(form.realisasiKinerja.trim())
  const showAccumHint = accumulate && prevTotal !== undefined && form.realisasiKinerja.trim() !== '' && !Number.isNaN(inputNum)
  const livePersen = selectedRencana?.satuan === 'Persen'
    ? calcPersen(form.realisasiKinerja, selectedRencana.targetKinerja)
    : null
  const liveSelisih = selectedRencana && selectedRencana.satuan !== 'Persen'
    ? calcSelisih(form.realisasiKinerja, selectedRencana.targetKinerja)
    : null

  const validateStep = (s) => {
    const next = {}
    if (s === 0) {
      if (!form.rencanaAksiId) next.rencanaAksiId = 'Pilih rencana aksi kinerja.'
      if (!form.realisasiKinerja.trim()) next.realisasiKinerja = 'Realisasi kinerja wajib diisi.'
      if (!form.tanggalKegiatan) next.tanggalKegiatan = 'Tanggal kegiatan wajib dipilih.'
    }
    if (s === 1) {
      if (form.realisasiAnggaran.trim() !== '') {
        const num = Number(form.realisasiAnggaran)
        if (Number.isNaN(num) || num < 0) next.realisasiAnggaran = 'Realisasi anggaran harus berupa angka ≥ 0 (kosongkan bila tidak ada).'
      }
    }
    if (s === 2) {
      for (const f of newFiles) {
        const msg = validateFile(f)
        if (msg) {
          next.bukti = `${f.name}: ${msg}`
          break
        }
      }
      if (!next.bukti && newFiles.length === 0 && existingList.length === 0) {
        // Bukti dukung wajib: minimal satu dokumen (lama dipertahankan / baru).
        next.bukti = 'Bukti dukung wajib diunggah (PDF / Excel / JPG / PNG) — bisa lebih dari satu dokumen.'
      }
    }
    return next
  }

  const goStep = (target) => {
    if (target > step) {
      // Majukan satu per satu sambil validasi tiap langkah yang dilewati.
      for (let s = step; s < target; s += 1) {
        const errs = validateStep(s)
        if (Object.keys(errs).length > 0) {
          setErrors(errs)
          setStep(s)
          return
        }
      }
    }
    setErrors({})
    setStep(target)
  }

  const handleNext = () => {
    const errs = validateStep(step)
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep((s) => Math.min(s + 1, wizardSteps.length - 1))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const all = { ...validateStep(0), ...validateStep(1), ...validateStep(2) }
    setErrors(all)
    if (Object.keys(all).length > 0) {
      if (all.rencanaAksiId || all.realisasiKinerja || all.tanggalKegiatan) setStep(0)
      else if (all.realisasiAnggaran) setStep(1)
      else setStep(2)
      return
    }
    onSubmit(form, { newFiles, removedIds })
  }

  const inputClass = (hasError) =>
    `h-[44px] rounded-lg border bg-surface px-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary-fixed ${
      hasError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
    }`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md overflow-y-auto" onClick={onClose} role="presentation">
      <div
        role="dialog" aria-modal="true" aria-labelledby="realisasi-wizard-title"
        className="my-8 w-full max-w-[760px] rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col overflow-hidden max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm bg-surface-container-low/50 shrink-0">
            <div>
              <h2 id="realisasi-wizard-title" className="font-headline-md text-headline-md text-on-surface font-bold">{title}</h2>
              <p className="font-body-sm text-body-sm text-secondary">{subtitle}</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup formulir"
              className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Navigasi bulir */}
          <div className="flex items-center justify-center gap-space-sm px-space-md pt-space-md shrink-0" role="tablist" aria-label="Langkah pengisian">
            {wizardSteps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-space-sm">
                <button
                  type="button" role="tab" aria-selected={step === i}
                  onClick={() => !saving && goStep(i)}
                  className="flex items-center gap-space-2xs group"
                  title={s.label}
                >
                  <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${
                    step === i ? 'bg-primary text-on-primary shadow-md scale-110'
                    : i < step ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-surface-container text-secondary group-hover:bg-surface-container-high'
                  }`}>
                    {i < step ? <span className="material-symbols-outlined text-[18px]">check</span> : <span>{i + 1}</span>}
                  </span>
                  <span className={`hidden sm:block font-label-md text-label-md font-bold ${step === i ? 'text-primary' : 'text-secondary'}`}>
                    {s.label}
                  </span>
                </button>
                {i < wizardSteps.length - 1 && <span className={`w-6 sm:w-10 h-0.5 rounded-full ${i < step ? 'bg-primary-fixed' : 'bg-surface-container'}`} />}
              </div>
            ))}
          </div>

          {/* Panel geser */}
          <div className="overflow-hidden grow">
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ width: `${wizardSteps.length * 100}%`, transform: `translateX(-${step * (100 / wizardSteps.length)}%)` }}
            >
              {/* Langkah 1 */}
              <div className="p-space-md space-y-space-md overflow-y-auto" style={{ width: `${100 / wizardSteps.length}%` }}>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="rwRencana">
                    Rencana Aksi Kinerja <span className="text-error">*</span>
                  </label>
                  <select id="rwRencana" value={form.rencanaAksiId} onChange={(e) => update('rencanaAksiId', e.target.value)} className={inputClass(errors.rencanaAksiId)}>
                    <option value="">Pilih rencana aksi dari seksi Anda</option>
                    {rencanaOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  {errors.rencanaAksiId && <span className="font-label-sm text-label-sm text-error">{errors.rencanaAksiId}</span>}
                </div>

                {selectedRencana && (
                  <div className="rounded-xl bg-surface-container-low px-space-sm py-space-sm font-body-sm text-body-sm text-secondary">
                    {selectedIksk && (
                      <div>
                        <span className="font-bold text-on-surface font-mono">IKSK {ikskNumber(selectedIksk)} — </span>
                        {selectedIksk.uraian}
                      </div>
                    )}
                    <span className="block mt-1">
                      Target kinerja: <span className="font-bold text-on-surface">{selectedRencana.targetKinerja}</span>
                      {' '}({selectedRencana.satuan})
                      {selectedRencana.anggaranRencana !== null && (
                        <> • Anggaran rencana: <span className="font-bold text-on-surface">{formatRupiah(selectedRencana.anggaranRencana)}</span></>
                      )}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="rwRealisasi">
                      Realisasi Kinerja <span className="text-error">*</span>
                    </label>
                    <input id="rwRealisasi" type="text" value={form.realisasiKinerja}
                      onChange={(e) => update('realisasiKinerja', e.target.value)}
                      className={inputClass(errors.realisasiKinerja)} placeholder="Mis. 115 / 95% / Baik" />
                    {errors.realisasiKinerja && <span className="font-label-sm text-label-sm text-error">{errors.realisasiKinerja}</span>}
                    {showAccumHint && (
                      <span className="font-label-sm text-label-sm text-tertiary font-semibold">
                        Rencana ini sudah terealisasi {prevTotal} — tersimpan sebagai {prevTotal} + {inputNum} ={' '}
                        {Number.isInteger(prevTotal + inputNum) ? prevTotal + inputNum : Number(((prevTotal + inputNum)).toFixed(2))}
                      </span>
                    )}
                    {(livePersen !== null || liveSelisih !== null) && form.realisasiKinerja.trim() !== '' && (
                      <span className="font-label-sm text-label-sm text-primary-container font-semibold">
                        {livePersen !== null
                          ? `Pratinjau: ${livePersen.toFixed(2)}% (capping 0–120%)`
                          : `Pratinjau selisih: ${formatSelisih(liveSelisih)} (target − realisasi)`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="rwTanggal">
                      Tanggal Kegiatan <span className="text-error">*</span>
                    </label>
                    <input id="rwTanggal" type="date" value={form.tanggalKegiatan}
                      onChange={(e) => update('tanggalKegiatan', e.target.value)}
                      className={inputClass(errors.tanggalKegiatan)} />
                    {errors.tanggalKegiatan && <span className="font-label-sm text-label-sm text-error">{errors.tanggalKegiatan}</span>}
                  </div>
                </div>
              </div>

              {/* Langkah 2 */}
              <div className="p-space-md space-y-space-md overflow-y-auto" style={{ width: `${100 / wizardSteps.length}%` }}>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="rwAnggaran">
                    Realisasi Anggaran <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                  </label>
                  <input id="rwAnggaran" type="number" min="0" step="any" value={form.realisasiAnggaran}
                    onChange={(e) => update('realisasiAnggaran', e.target.value)}
                    className={inputClass(errors.realisasiAnggaran)} placeholder="Rp — kosongkan bila tidak ada" />
                  {errors.realisasiAnggaran && <span className="font-label-sm text-label-sm text-error">{errors.realisasiAnggaran}</span>}
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <label className="font-label-md text-label-md font-bold text-on-surface" htmlFor="rwKendala">
                    Catatan Kendala dan Hambatan <span className="font-label-sm font-semibold text-secondary">(opsional)</span>
                  </label>
                  <textarea id="rwKendala" value={form.catatanKendala}
                    onChange={(e) => update('catatanKendala', e.target.value)} rows="4"
                    className="min-h-[120px] rounded-lg border border-outline-variant bg-surface px-space-sm py-space-sm font-body-md text-body-md text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-y"
                    placeholder="Contoh: 2 madrasah pesisir menunggu perbaikan server proctor..." />
                </div>
              </div>

              {/* Langkah 3 */}
              <div className="p-space-md space-y-space-md overflow-y-auto" style={{ width: `${100 / wizardSteps.length}%` }}>
                <div className="flex flex-col gap-space-2xs">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    Upload Bukti Dukung <span className="text-error">*</span>{' '}
                    <span className="font-label-sm font-semibold text-secondary">(PDF / Excel / JPG / PNG, maks. 10 MB per berkas — boleh lebih dari satu)</span>
                  </span>
                  {existingList.length > 0 && (
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-label-sm text-label-sm font-bold text-secondary">
                        Dokumen tersimpan ({existingList.length}) — tetap dipakai kecuali dihapus:
                      </span>
                      {existingList.map((b) => (
                        <div key={b.id} className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-sm py-space-sm font-body-sm text-body-sm">
                          <span className="material-symbols-outlined text-primary-container text-[22px]">description</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-on-surface truncate">{b.bukti_nama}</div>
                            <div className="text-secondary">{formatSize(b.bukti_size)}</div>
                          </div>
                          <button type="button" onClick={() => setRemovedIds((cur) => [...cur, b.id])}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg text-error hover:bg-error-container transition-colors shrink-0"
                            title={`Hapus ${b.bukti_nama}`} aria-label={`Hapus ${b.bukti_nama}`}>
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    role="button" tabIndex={0}
                    onClick={pickFile}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pickFile() }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (e.dataTransfer.files?.length) chooseFiles(e.dataTransfer.files)
                    }}
                    className={`p-space-lg rounded-xl transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-inner ${
                      dragOver ? 'bg-primary-fixed/25 ring-2 ring-primary' : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary-container mb-space-xs">
                      <span className="material-symbols-outlined text-[28px]">file_upload</span>
                    </div>
                    <span className="font-title-sm text-title-sm font-bold text-on-surface break-all">
                      {newFiles.length > 0 ? `${newFiles.length} berkas baru dipilih` : 'Klik untuk memilih berkas dari perangkat'}
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary mt-1">
                      {newFiles.length > 0 ? 'klik / seret lagi untuk tambah dokumen' : 'atau seret & letakkan berkas di sini — bisa banyak sekaligus'}
                    </span>
                    <span className="mt-space-sm inline-flex items-center gap-space-2xs px-space-md py-space-2xs rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">folder_open</span>
                      {existingList.length > 0 ? 'Tambah Dokumen' : 'Pilih Dokumen'}
                    </span>
                  </div>
                  <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) chooseFiles(e.target.files)
                      e.target.value = ''
                    }} />
                  {newFiles.length > 0 && (
                    <div className="flex flex-col gap-space-2xs">
                      {newFiles.map((f, i) => (
                        <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-space-sm rounded-xl border border-dashed border-primary/40 bg-primary-fixed/10 px-space-sm py-space-2xs font-body-sm text-body-sm">
                          <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-on-surface truncate">{f.name}</div>
                            <div className="text-secondary">{formatSize(f.size)}</div>
                          </div>
                          <button type="button" onClick={() => removeNewFile(i)}
                            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg text-error hover:bg-error-container transition-colors shrink-0"
                            title={`Batalkan ${f.name}`} aria-label={`Batalkan ${f.name}`}>
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.bukti && <span className="font-label-sm text-label-sm text-error">{errors.bukti}</span>}
                  <span className="font-label-sm text-label-sm text-secondary">
                    Berkas baru diunggah ke server hanya setelah tombol Simpan / Perbarui diklik.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer navigasi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-t border-surface-container bg-surface-container-low/40 px-space-md py-space-md shrink-0">
            <div className="flex gap-space-sm">
              <button type="button" onClick={onClose} disabled={saving}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                Batal
              </button>
              {step > 0 && (
                <button type="button" onClick={() => !saving && setStep((s) => s - 1)} disabled={saving}
                  className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span> Kembali
                </button>
              )}
            </div>
            {step < wizardSteps.length - 1 ? (
              <button type="button" onClick={handleNext} disabled={saving}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                Lanjut <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            ) : (
              <button type="submit" disabled={saving}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">{saving ? 'progress_activity' : 'save'}</span>
                {saving ? 'Menyimpan...' : submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function RealisasiKinerjaForm({ currentUser }) {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rencanaRows, setRencanaRows] = useState([])
  const [rows, setRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua')
  const [filterTriwulan, setFilterTriwulan] = useState('Semua')

  const [createOpen, setCreateOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewerRow, setViewerRow] = useState(null)
  const [viewerFiles, setViewerFiles] = useState([])
  const [buktiMap, setBuktiMap] = useState(new Map())
  const [attachRow, setAttachRow] = useState(null)
  const [attachFiles, setAttachFiles] = useState([])
  const [attaching, setAttaching] = useState(false)
  const attachInputRef = useRef(null)

  const openViewer = (row) => {
    setViewerRow(row)
    setViewerFiles(buktiMap.get(row.id) ?? [])
  }

  const isModalOpen = createOpen || editOpen || deleteTarget !== null || viewerRow !== null || attachRow !== null

  // ---- READ ----
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
      setRows(realRes.data ?? [])
      // Lampiran multi-dokumen (fallback map kosong bila tabel belum dimigrasi).
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

  // ---- Lookup ----
  const skById = useMemo(() => Object.fromEntries(skList.map((s) => [s.id, s])), [skList])
  const ikskById = useMemo(() => Object.fromEntries(ikskList.map((i) => [i.id, i])), [ikskList])
  const cascadingById = useMemo(() => Object.fromEntries(cascadingRows.map((c) => [c.id, c])), [cascadingRows])
  const rencanaById = useMemo(() => Object.fromEntries(rencanaRows.map((r) => [r.id, r])), [rencanaRows])

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  // Unit kerja milik user yang login.
  const userUnit = useMemo(() => {
    const name = (currentUser?.unitKerjaNama ?? '').trim().toLowerCase()
    if (!name || unitList.length === 0) return null
    return (
      unitList.find((u) => (u.nama_unit ?? '').trim().toLowerCase() === name) ??
      unitList.find((u) => (u.nama_unit ?? '').toLowerCase().includes(name) || name.includes((u.nama_unit ?? '').toLowerCase())) ??
      null
    )
  }, [currentUser, unitList])

  // Rencana aksi milik seksi user (dropdown + cakupan riwayat).
  const rencanaOfUnit = useMemo(() => {
    const withIksk = rencanaRows.map((r) => ({
      ...r,
      cascading: cascadingById[r.cascading_id] || null,
    }))
    const scoped = userUnit ? withIksk.filter((r) => r.cascading?.unit_kerja_id === userUnit.id) : withIksk
    return scoped.map((r) => {
      const iksk = r.cascading ? ikskById[r.cascading.iksk_id] || null : null
      return {
        ...r,
        ikskId: r.cascading?.iksk_id ?? null,
        iksk,
        targetKinerja: r.target_kinerja,
        satuan: r.satuan,
        anggaranRencana: r.anggaran,
      }
    })
  }, [rencanaRows, cascadingById, ikskById, userUnit])

  const rencanaOptions = useMemo(() => rencanaOfUnit.map((r) => ({
    id: r.id,
    label: `${r.iksk ? `IKSK ${ikskNumber(r.iksk)} · ` : ''}${r.rencana_aksi.slice(0, 60)} (target ${r.target_kinerja} ${r.satuan})`,
  })), [rencanaOfUnit, ikskNumber])

  const tahunOptions = useMemo(() => {
    const set = new Set(rows.map((r) => String(r.tahun_anggaran)))
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [rows])

  // ---- Enrich riwayat ----
  const enriched = useMemo(() => rows.map((row) => {
    const rencana = rencanaById[row.rencana_aksi_id] || null
    const cascading = rencana ? cascadingById[rencana.cascading_id] || null : null
    const iksk = cascading ? ikskById[cascading.iksk_id] || null : null
    const sk = iksk ? skById[iksk.sk_id] || null : null
    const satuan = rencana?.satuan ?? cascading?.satuan ?? 'Persen'
    const target = rencana?.target_kinerja ?? ''
    const pct = satuan === 'Persen' ? calcPersen(row.realisasi_kinerja, target) : null
    const selisih = satuan === 'Persen' ? null : calcSelisih(row.realisasi_kinerja, target)
    return { ...row, rencana, cascading, iksk, sk, satuan, target, pct, selisih }
  }), [rows, rencanaById, cascadingById, ikskById, skById])

  const ownRows = useMemo(() => {
    if (!userUnit) return enriched
    return enriched.filter((r) => r.cascading?.unit_kerja_id === userUnit.id)
  }, [enriched, userUnit])

  const keyword = search.trim().toLowerCase()
  const filtered = useMemo(() => ownRows.filter((r) => {
    if (filterTahun !== 'Semua' && String(r.tahun_anggaran) !== String(filterTahun)) return false
    if (filterTriwulan !== 'Semua' && triwulanOf(r.tanggal_kegiatan) !== filterTriwulan) return false
    if (!keyword) return true
    return (
      (r.rencana?.rencana_aksi ?? '').toLowerCase().includes(keyword) ||
      (r.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
      (r.realisasi_kinerja ?? '').toLowerCase().includes(keyword) ||
      (r.catatan_kendala ?? '').toLowerCase().includes(keyword)
    )
  }), [ownRows, filterTahun, filterTriwulan, keyword])

  // Total realisasi numerik per rencana (untuk akumulasi isian berikutnya).
  const prevTotals = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const n = parseNum(r.realisasi_kinerja)
      if (Number.isNaN(n)) continue
      map[r.rencana_aksi_id] = (map[r.rencana_aksi_id] ?? 0) + n
    }
    return map
  }, [rows])

  // ---- CREATE ----
  const openCreate = () => {
    setSuccessMessage('')
    setFetchError('')
    setCreateOpen(true)
  }

  const handleSubmitCreate = async (form, { newFiles }) => {
    if (savingCreate) return
    const rencana = rencanaById[form.rencanaAksiId]
    const cascading = rencana ? cascadingById[rencana.cascading_id] : null
    if (!rencana || !cascading) {
      setFetchError('Rencana aksi yang dipilih tidak ditemukan. Muat ulang data.')
      return
    }
    if (!newFiles || newFiles.length === 0) {
      setFetchError('Bukti dukung wajib diunggah (minimal satu dokumen).')
      return
    }
    setSavingCreate(true)
    try {
      // Akumulasi: isian baru pada rencana yang sama ditambahkan ke total
      // realisasi sebelumnya (hanya bila keduanya berupa angka).
      const inputNum = parseNum(form.realisasiKinerja.trim())
      const prevTotal = prevTotals[form.rencanaAksiId]
      let realisasiToStore = form.realisasiKinerja.trim()
      let accumNote = ''
      if (prevTotal !== undefined && !Number.isNaN(inputNum)) {
        const acc = prevTotal + inputNum
        realisasiToStore = Number.isInteger(acc) ? String(acc) : String(Number(acc.toFixed(2)))
        accumNote = ` (akumulasi ${prevTotal} + ${inputNum} = ${realisasiToStore})`
      }
      // Upload semua dokumen dulu; gagal unggah = gagal simpan (tidak ada data yatim).
      const uploaded = await uploadMultipleBukti(newFiles, cascading.tahun_anggaran)
      const first = uploaded[0]
      const payload = {
        rencana_aksi_id: form.rencanaAksiId,
        realisasi_kinerja: realisasiToStore,
        tanggal_kegiatan: form.tanggalKegiatan,
        realisasi_anggaran: form.realisasiAnggaran.trim() === '' ? null : Number(form.realisasiAnggaran),
        catatan_kendala: form.catatanKendala.trim() || null,
        bukti_path: first.bukti_path,
        bukti_nama: first.bukti_nama,
        bukti_tipe: first.bukti_tipe,
        bukti_size: first.bukti_size,
        ...(first.bukti_drive_id ? { bukti_drive_id: first.bukti_drive_id, bukti_drive_link: first.bukti_drive_link } : {}),
        tahun_anggaran: cascading.tahun_anggaran,
      }
      const { data, error } = await supabase.from('realisasi_kinerja').insert(payload).select().single()
      if (error) {
        await cleanupUploaded(uploaded)
        throw error
      }
      // Simpan seluruh dokumen ke tabel anak (abaikan bila tabel belum dimigrasi).
      const childRows = uploaded.map((b) => ({ realisasi_id: data.id, ...b }))
      const { data: insertedChildren, error: childError } = await supabase.from('realisasi_bukti').insert(childRows).select()
      if (childError) {
        if (childError.code === '42P01' || childError.code === 'PGRST205') {
          await cleanupUploaded(uploaded)
          await supabase.from('realisasi_kinerja').delete().eq('id', data.id)
          throw new Error('Tabel realisasi_bukti belum ada. Jalankan supabase/realisasi_bukti_multi.sql di SQL Editor dulu.')
        }
        console.warn('[bukti] lampiran tambahan dilewati:', childError.message)
      } else if (insertedChildren) {
        setBuktiMap((cur) => new Map(cur).set(data.id, insertedChildren))
      }
      setRows((cur) => [data, ...cur])
      setSuccessMessage(`Realisasi untuk "${rencana.rencana_aksi.slice(0, 60)}" berhasil disimpan (${uploaded.length} dokumen).${accumNote}`)
      setCreateOpen(false)
    } catch (error) {
      setFetchError(`Gagal menyimpan realisasi: ${error.message} Pastikan supabase/realisasi_kinerja.sql sudah dijalankan (bucket bukti-dukung).`)
    } finally {
      setSavingCreate(false)
    }
  }

  // ---- EDIT ----
  const openEdit = (row) => {
    setEditingRow(row)
    setSuccessMessage('')
    setFetchError('')
    setEditOpen(true)
  }

  const handleSubmitEdit = async (form, { newFiles, removedIds }) => {
    if (savingEdit || !editingRow) return
    const rencana = rencanaById[form.rencanaAksiId]
    const cascading = rencana ? cascadingById[rencana.cascading_id] : null
    if (!rencana || !cascading) {
      setFetchError('Rencana aksi yang dipilih tidak ditemukan. Muat ulang data.')
      return
    }
    setSavingEdit(true)
    try {
      const existingAll = (buktiMap.get(editingRow.id) ?? []).length > 0
        ? buktiMap.get(editingRow.id)
        : (editingRow.bukti_path ? [{
          id: `legacy-${editingRow.id}`,
          bukti_path: editingRow.bukti_path,
          bukti_nama: editingRow.bukti_nama,
          bukti_tipe: editingRow.bukti_tipe,
          bukti_size: editingRow.bukti_size,
          bukti_drive_id: editingRow.bukti_drive_id,
        }] : [])
      const kept = existingAll.filter((b) => !(removedIds ?? []).includes(b.id))
      // Hapus lampiran yang dibuang user (termasuk fallback legacy pra-migrasi).
      for (const b of existingAll.filter((b) => (removedIds ?? []).includes(b.id))) {
        try {
          if (String(b.id).startsWith('legacy-')) {
            if (b.bukti_path) await supabase.storage.from('bukti-dukung').remove([b.bukti_path])
            if (b.bukti_drive_id) await deleteFromDrive(b.bukti_drive_id)
          } else {
            await deleteBuktiRow(b)
          }
        } catch (err) {
          throw new Error(`Gagal menghapus ${b.bukti_nama}: ${err.message}`)
        }
      }
      // Upload dokumen tambahan.
      let uploaded = []
      if (newFiles && newFiles.length > 0) {
        uploaded = await uploadMultipleBukti(newFiles, cascading.tahun_anggaran)
        const childRows = uploaded.map((b) => ({ realisasi_id: editingRow.id, ...b }))
        const { data: inserted, error: childError } = await supabase.from('realisasi_bukti').insert(childRows).select()
        if (childError) {
          await cleanupUploaded(uploaded)
          if (childError.code === '42P01' || childError.code === 'PGRST205') {
            throw new Error('Tabel realisasi_bukti belum ada. Jalankan supabase/realisasi_bukti_multi.sql di SQL Editor dulu.')
          }
          throw childError
        }
        kept.push(...(inserted ?? []))
      }
      if (kept.length === 0) {
        await cleanupUploaded(uploaded)
        throw new Error('Minimal satu dokumen bukti harus dipertahankan.')
      }
      // Sinkronkan kolom legacy parent ke dokumen pertama.
      const first = kept[0]
      const legacy = {
        bukti_path: first.bukti_path,
        bukti_nama: first.bukti_nama,
        bukti_tipe: first.bukti_tipe,
        bukti_size: first.bukti_size,
        bukti_drive_id: first.bukti_drive_id ?? null,
        bukti_drive_link: first.bukti_drive_link ?? null,
      }
      const { data, error } = await supabase
        .from('realisasi_kinerja')
        .update({
          rencana_aksi_id: form.rencanaAksiId,
          realisasi_kinerja: form.realisasiKinerja.trim(),
          tanggal_kegiatan: form.tanggalKegiatan,
          realisasi_anggaran: form.realisasiAnggaran.trim() === '' ? null : Number(form.realisasiAnggaran),
          catatan_kendala: form.catatanKendala.trim() || null,
          ...legacy,
          tahun_anggaran: cascading.tahun_anggaran,
        })
        .eq('id', editingRow.id)
        .select()
        .single()
      if (error) {
        await cleanupUploaded(uploaded)
        throw error
      }
      setBuktiMap((cur) => new Map(cur).set(editingRow.id, kept))
      setRows((cur) => cur.map((r) => (r.id === editingRow.id ? data : r)))
      setSuccessMessage(`Realisasi kinerja telah diperbarui (${kept.length} dokumen).`)
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
      // Hapus seluruh lampiran anak dulu (storage + drive + row).
      for (const b of buktiMap.get(deleteTarget.id) ?? []) {
        try {
          await deleteBuktiRow(b)
        } catch { /* lanjut */ }
      }
      const { error } = await supabase.from('realisasi_kinerja').delete().eq('id', deleteTarget.id)
      if (error) throw error
      // Fallback legacy bila tabel anak belum ada: hapus berkas parent.
      if (deleteTarget.bukti_path) {
        try {
          await supabase.storage.from('bukti-dukung').remove([deleteTarget.bukti_path])
        } catch { /* abaikan */ }
      }
      if (deleteTarget.bukti_drive_id) {
        try {
          await deleteFromDrive(deleteTarget.bukti_drive_id)
        } catch { /* abaikan */ }
      }
      setBuktiMap((cur) => {
        const next = new Map(cur)
        next.delete(deleteTarget.id)
        return next
      })
      setRows((cur) => cur.filter((r) => r.id !== deleteTarget.id))
      setSuccessMessage('Riwayat realisasi telah dihapus.')
      setDeleteTarget(null)
    } catch (error) {
      setFetchError(`Gagal menghapus data: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // ---- TAMBAH DOKUMEN (tanpa edit form) ----
  const openAttach = (row) => {
    setAttachRow(row)
    setAttachFiles([])
    setSuccessMessage('')
    setFetchError('')
  }

  const handleAttachSubmit = async () => {
    if (!attachRow || attaching || attachFiles.length === 0) return
    const rencana = rencanaById[attachRow.rencana_aksi_id]
    const cascading = rencana ? cascadingById[rencana.cascading_id] : null
    const tahun = cascading?.tahun_anggaran ?? attachRow.tahun_anggaran
    setAttaching(true)
    try {
      const uploaded = await uploadMultipleBukti(attachFiles, tahun)
      const childRows = uploaded.map((b) => ({ realisasi_id: attachRow.id, ...b }))
      const { data: inserted, error } = await supabase.from('realisasi_bukti').insert(childRows).select()
      if (error) {
        await cleanupUploaded(uploaded)
        if (error.code === '42P01' || error.code === 'PGRST205') {
          throw new Error('Tabel realisasi_bukti belum ada. Jalankan supabase/realisasi_bukti_multi.sql di SQL Editor dulu.')
        }
        throw error
      }
      setBuktiMap((cur) => {
        const next = new Map(cur)
        next.set(attachRow.id, [...(next.get(attachRow.id) ?? []), ...(inserted ?? [])])
        return next
      })
      setSuccessMessage(`Berhasil menambah ${uploaded.length} dokumen ke realisasi "${attachRow.realisasi_kinerja}".`)
      setAttachRow(null)
      setAttachFiles([])
    } catch (error) {
      setFetchError(`Gagal menambah dokumen: ${error.message}`)
    } finally {
      setAttaching(false)
    }
  }

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (deleting || savingCreate || savingEdit || attaching) return
        if (viewerRow) { setViewerRow(null); setViewerFiles([]) }
        else if (attachRow) { setAttachRow(null); setAttachFiles([]) }
        else if (deleteTarget) setDeleteTarget(null)
        else if (editOpen) { setEditOpen(false); setEditingRow(null) }
        else if (createOpen) setCreateOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isModalOpen])

  const satuanBadge = (satuan) => {
    if (satuan === 'Persen') return 'bg-primary-fixed/25 text-primary'
    if (satuan === 'Nilai') return 'bg-primary-container text-on-primary-container'
    if (satuan === 'Rasio') return 'bg-surface-container-low text-on-surface'
    return 'bg-surface-container text-secondary'
  }

  const renderPersenCell = (r) => {
    if (r.satuan === 'Persen') {
      if (r.pct === null) return <span className="text-secondary">-</span>
      return (
        <div className="flex flex-col gap-1 min-w-[110px]" title={`(${r.realisasi_kinerja} / ${r.target}) × 100, capping 0–120%`}>
          <span className="font-bold text-primary-container">{r.pct.toFixed(2)}%</span>
          <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
            <div className="h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, r.pct)}%` }} />
          </div>
        </div>
      )
    }
    return (
      <span className="font-bold text-tertiary-container" title={`${r.target} − ${r.realisasi_kinerja} (target − realisasi)`}>
        {formatSelisih(r.selisih)}
      </span>
    )
  }

  const createInitial = { rencanaAksiId: '', realisasiKinerja: '', tanggalKegiatan: '', realisasiAnggaran: '', catatanKendala: '', existingBuktiList: [] }
  const editInitial = editingRow ? {
    rencanaAksiId: editingRow.rencana_aksi_id,
    realisasiKinerja: editingRow.realisasi_kinerja ?? '',
    tanggalKegiatan: editingRow.tanggal_kegiatan ?? '',
    realisasiAnggaran: editingRow.realisasi_anggaran === null || editingRow.realisasi_anggaran === undefined ? '' : String(editingRow.realisasi_anggaran),
    catatanKendala: editingRow.catatan_kendala ?? '',
    existingBuktiList: buktiMap.get(editingRow.id) ?? (editingRow.bukti_path ? [{
      id: `legacy-${editingRow.id}`,
      realisasi_id: editingRow.id,
      bukti_path: editingRow.bukti_path,
      bukti_nama: editingRow.bukti_nama,
      bukti_tipe: editingRow.bukti_tipe,
      bukti_size: editingRow.bukti_size,
    }] : []),
  } : createInitial

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Kepala Seksi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Input Realisasi Kinerja</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Input Realisasi Kinerja</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              {filtered.length} Riwayat
            </span>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={rencanaOfUnit.length === 0}
            className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            title={rencanaOfUnit.length === 0 ? 'Isi Rencana Aksi Kinerja dulu' : 'Catat realisasi baru'}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Tambah Realisasi
          </button>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Pilih rencana aksi {userUnit ? <span className="font-bold text-on-surface">{userUnit.nama_unit}</span> : 'seksi Anda'},
          isi capaian, tanggal, serapan anggaran, kendala lapang, dan lampirkan bukti (PDF/Excel/JPG/PNG).
          Kolom % dihitung otomatis dari satuan IKSK.
        </p>
      </div>

      {!userUnit && !loading && (
        <div className="mb-space-lg flex items-start gap-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-md text-secondary">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <p className="font-body-sm text-body-sm">
            Unit kerja akun Anda (<span className="font-bold">{currentUser?.unitKerjaNama || '-'}</span>) tidak cocok
            dengan Master Unit Kerja, sehingga menampilkan seluruh data. Samakan nama unit di Master User agar
            terfilter otomatis per seksi.
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
            <h3 className="font-title-sm text-title-sm font-bold">Realisasi berhasil disimpan</h3>
            <p className="font-body-sm text-body-sm text-primary/80">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Toolbar filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Riwayat Realisasi</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${filtered.length} catatan realisasi`}
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
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari IKSK / rencana / kendala..."
              aria-label="Cari realisasi"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Tabel riwayat */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1560px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Rencana Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Target Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[140px]">Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[140px]">Realisasi Target Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[140px]">% Realisasi Target</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">Realisasi Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Catatan Kendala dan Hambatan</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">Bukti</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : filtered.length > 0 ? filtered.map((r, idx) => (
                <tr key={r.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                  <td className="px-space-md py-space-sm font-mono font-bold text-primary whitespace-nowrap">
                    {r.iksk ? ikskNumber(r.iksk) : '-'}
                  </td>
                  <td className="px-space-md py-space-sm max-w-[260px]">
                    {r.iksk
                      ? <span className="font-body-sm text-body-sm text-on-surface">{r.iksk.uraian}</span>
                      : <span className="font-body-sm text-body-sm text-error">IKSK terhapus</span>}
                    <span className="block font-body-sm text-body-sm text-secondary">
                      {formatTanggal(r.tanggal_kegiatan)}{' '}
                      {triwulanOf(r.tanggal_kegiatan) && (
                        <span className="inline-flex items-center px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-bold">
                          {triwulanOf(r.tanggal_kegiatan)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm max-w-[280px] font-body-sm text-body-sm text-on-surface font-semibold">
                    {r.rencana ? r.rencana.rencana_aksi : <span className="text-error">Rencana terhapus</span>}
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <span className="font-body-sm text-body-sm text-on-surface font-extrabold">{r.target || '-'}</span>
                    <span className={`ml-2 inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${satuanBadge(r.satuan)}`}>
                      {r.satuan}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">
                    {formatRupiah(r.rencana?.anggaran)}
                  </td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-extrabold whitespace-nowrap">
                    {r.realisasi_kinerja}
                  </td>
                  <td className="px-space-md py-space-sm">{renderPersenCell(r)}</td>
                  <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">
                    {formatRupiah(r.realisasi_anggaran)}
                  </td>
                  <td className="px-space-md py-space-sm max-w-[280px] font-body-sm text-body-sm text-secondary">
                    {r.catatan_kendala || <span className="italic">-</span>}
                  </td>
                  <td className="px-space-md py-space-sm text-center">
                    {r.bukti_path ? (
                      <div className="flex items-center justify-center gap-space-2xs">
                        <button
                          type="button" onClick={() => openViewer(r)}
                          className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-primary hover:bg-surface-container transition-colors"
                          title={`Lihat ${r.bukti_nama || 'bukti dukung'}${(buktiMap.get(r.id) ?? []).length > 1 ? ` (${(buktiMap.get(r.id) ?? []).length} dokumen)` : ''}`}
                          aria-label="Lihat bukti dukung"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button
                          type="button" onClick={() => openAttach(r)}
                          className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                          title="Tambah dokumen"
                          aria-label="Tambah dokumen"
                        >
                          <span className="material-symbols-outlined text-[16px]">note_add</span>
                        </button>
                        {(buktiMap.get(r.id) ?? []).length > 1 && (
                          <span className="inline-flex items-center px-space-2xs rounded-full bg-primary-fixed/25 text-primary font-label-sm font-bold whitespace-nowrap">
                            {(buktiMap.get(r.id) ?? []).length} dok
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button" onClick={() => openAttach(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-dashed border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                        title="Tambah dokumen"
                        aria-label="Tambah dokumen"
                      >
                        <span className="material-symbols-outlined text-[16px]">note_add</span>
                      </button>
                    )}
                  </td>
                  <td className="px-space-md py-space-sm">
                    <div className="flex items-center justify-center gap-space-2xs">
                      <button
                        type="button" onClick={() => openEdit(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                        title="Edit realisasi" aria-label="Edit realisasi"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_square</span>
                      </button>
                      <button
                        type="button" onClick={() => setDeleteTarget(r)}
                        className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg border border-outline-variant text-secondary hover:bg-error-container hover:text-on-error-container transition-colors"
                        title="Hapus realisasi" aria-label="Hapus realisasi"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="12" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua'
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada realisasi — klik Tambah Realisasi untuk mencatat capaian'}
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
            <span>% = (realisasi / target) × 100 (capping 0–120%) bila satuan Persen; selain itu = target − realisasi.</span>
          </div>
        </div>
      </div>

      {/* Modal tambah (wizard) */}
      {createOpen && (
        <RealisasiWizard
          key="create"
          title="Tambah Realisasi"
          subtitle={userUnit ? userUnit.nama_unit : 'Input capaian kinerja seksi'}
          submitLabel="Simpan Realisasi"
          saving={savingCreate}
          onClose={() => !savingCreate && setCreateOpen(false)}
          onSubmit={handleSubmitCreate}
          rencanaOptions={rencanaOptions}
          rencanaById={Object.fromEntries(rencanaOfUnit.map((r) => [r.id, r]))}
          ikskById={ikskById}
          skById={skById}
          ikskNumber={ikskNumber}
          initial={createInitial}
          prevTotals={prevTotals}
        />
      )}

      {/* Modal edit (wizard) */}
      {editOpen && editingRow && (
        <RealisasiWizard
          key={editingRow.id}
          title="Edit Realisasi"
          subtitle={editingRow.rencana ? editingRow.rencana.rencana_aksi.slice(0, 70) : 'Perbarui catatan realisasi'}
          submitLabel="Perbarui"
          saving={savingEdit}
          onClose={() => {
            if (savingEdit) return
            setEditOpen(false)
            setEditingRow(null)
          }}
          onSubmit={handleSubmitEdit}
          rencanaOptions={rencanaOptions}
          rencanaById={Object.fromEntries(rencanaOfUnit.map((r) => [r.id, r]))}
          ikskById={ikskById}
          skById={skById}
          ikskNumber={ikskNumber}
          initial={editInitial}
          accumulate={false}
          prevTotals={prevTotals}
        />
      )}

      {/* Viewer dokumen */}
      {viewerRow && (
        <BuktiViewer row={viewerRow} files={viewerFiles} onClose={() => { setViewerRow(null); setViewerFiles([]) }} />
      )}

      {/* Tambah dokumen */}
      {attachRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-space-md" onClick={() => !attaching && setAttachRow(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="attach-modal-title"
            className="rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container p-space-lg max-w-[520px] w-full"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-space-sm text-primary mb-space-sm">
              <span className="material-symbols-outlined text-[28px]">note_add</span>
              <h3 id="attach-modal-title" className="font-headline-md text-headline-md font-bold">Tambah Dokumen</h3>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mb-space-sm">
              Realisasi <span className="font-bold text-on-surface">{attachRow.realisasi_kinerja}</span>
              {' '}• {formatTanggal(attachRow.tanggal_kegiatan)}
              {' '}• sudah ada {(buktiMap.get(attachRow.id) ?? []).length || (attachRow.bukti_path ? 1 : 0)} dokumen.
            </p>
            <input ref={attachInputRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) setAttachFiles((cur) => [...cur, ...[...e.target.files]])
                e.target.value = ''
              }} />
            <button type="button" onClick={() => attachInputRef.current?.click()} disabled={attaching}
              className="w-full p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col items-center justify-center text-center gap-space-2xs disabled:opacity-50">
              <span className="material-symbols-outlined text-[28px] text-primary-container">file_upload</span>
              <span className="font-body-md text-body-md font-bold text-on-surface">
                {attachFiles.length > 0 ? `${attachFiles.length} berkas dipilih — klik untuk tambah lagi` : 'Klik untuk memilih berkas (bisa banyak)'}
              </span>
              <span className="font-label-sm text-label-sm text-secondary">PDF / Excel / JPG / PNG, maks. 10 MB per berkas</span>
            </button>
            {attachFiles.length > 0 && (
              <div className="flex flex-col gap-space-2xs mt-space-sm">
                {attachFiles.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-space-sm rounded-xl border border-dashed border-primary/40 bg-primary-fixed/10 px-space-sm py-space-2xs font-body-sm text-body-sm">
                    <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-on-surface truncate">{f.name}</div>
                      <div className="text-secondary">{formatSize(f.size)}</div>
                    </div>
                    <button type="button" onClick={() => setAttachFiles((cur) => cur.filter((_, j) => j !== i))} disabled={attaching}
                      className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-lg text-error hover:bg-error-container transition-colors shrink-0 disabled:opacity-50"
                      aria-label={`Batalkan ${f.name}`}>
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-space-sm mt-space-md">
              <button type="button" onClick={() => { setAttachRow(null); setAttachFiles([]) }} disabled={attaching}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant px-space-md font-body-md text-body-md font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50">
                Batal
              </button>
              <button type="button" onClick={handleAttachSubmit} disabled={attaching || attachFiles.length === 0}
                className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">{attaching ? 'progress_activity' : 'upload'}</span>
                {attaching ? 'Mengunggah...' : `Unggah ${attachFiles.length} Dokumen`}
              </button>
            </div>
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
            <p className="font-body-md text-body-md text-secondary mb-space-sm">Hapus catatan realisasi ini beserta lampiran buktinya?</p>
            <p className="font-body-sm text-body-sm text-secondary mb-space-md rounded-lg bg-surface-container-low px-space-sm py-space-xs">
              <span className="font-bold text-on-surface">{deleteTarget.realisasi_kinerja}</span>
              {' '}• {formatTanggal(deleteTarget.tanggal_kegiatan)}
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

export default RealisasiKinerjaForm
