import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { BuktiViewer } from './RealisasiKinerjaForm'
import { targetTriwulanOf } from '../lib/kinerjaOrganisasi'

// ---------- Helper angka (konsisten dengan Input Realisasi) ----------
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
  if (capaian >= 100) return { label: 'Tercapai', cls: 'bg-primary-container/25 text-primary' }
  if (capaian >= 70) return { label: 'Mendekati target', cls: 'bg-tertiary-fixed text-tertiary' }
  return { label: kendala ? 'Terkendala' : 'Belum tercapai', cls: 'bg-error-container text-on-error-container' }
}

function LaporanKinerjaSeksi({ currentUser }) {
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
  const [viewerRow, setViewerRow] = useState(null)
  const [exporting, setExporting] = useState(false)

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
        setFetchError('Salah satu tabel belum ada. Jalankan seluruh file SQL di folder supabase/ secara berurutan di SQL Editor, kemudian Muat ulang.')
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

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  const userUnit = useMemo(() => {
    const name = (currentUser?.unitKerjaNama ?? '').trim().toLowerCase()
    if (!name || unitList.length === 0) return null
    return (
      unitList.find((u) => (u.nama_unit ?? '').trim().toLowerCase() === name) ??
      unitList.find((u) => (u.nama_unit ?? '').toLowerCase().includes(name) || name.includes((u.nama_unit ?? '').toLowerCase())) ??
      null
    )
  }, [currentUser, unitList])

  const tahunOptions = useMemo(() => {
    const set = new Set([...rencanaRows.map((r) => String(r.tahun_anggaran)), ...realisasiRows.map((r) => String(r.tahun_anggaran))])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [rencanaRows, realisasiRows])

  // Satu baris rekap per rencana aksi milik seksi.
  const recap = useMemo(() => {
    const scoped = rencanaRows
      .map((r) => ({ ...r, cascading: cascadingById[r.cascading_id] || null }))
      .filter((r) => {
        if (filterTahun !== 'Semua' && String(r.tahun_anggaran) !== String(filterTahun)) return false
        if (userUnit && r.cascading?.unit_kerja_id !== userUnit.id) return false
        return true
      })
      .map((r) => {
        const iksk = r.cascading ? ikskById[r.cascading.iksk_id] || null : null
        const sk = iksk ? skById[iksk.sk_id] || null : null
        // Riwayat realisasi rencana ini (ikut filter triwulan + tahun).
        const entries = realisasiRows.filter((e) => {
          if (e.rencana_aksi_id !== r.id) return false
          if (filterTahun !== 'Semua' && String(e.tahun_anggaran) !== String(filterTahun)) return false
          if (filterTriwulan !== 'Semua' && triwulanOf(e.tanggal_kegiatan) !== filterTriwulan) return false
          return true
        })
        // % realisasi target diambil dari pengisian TERAKHIR (waktu input,
        // sama persis dengan 1 baris per rencana di tabel riwayat Input
        // Realisasi Kinerja). Nilai tersimpan sudah akumulasi sehingga
        // JANGAN dijumlah lagi — menjumlah ulang menyebabkan double-count.
        const byInputTerakhir = (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        const latestEntry = [...entries].sort(byInputTerakhir)[0] ?? null
        const total = latestEntry ? parseNum(latestEntry.realisasi_kinerja) : NaN
        const persen = calcRealisasiPersen(total, r.target_kinerja, r.satuan)
        // Total serapan anggaran (abaikan yang kosong).
        const angNums = entries.map((e) => (e.realisasi_anggaran === null ? NaN : Number(e.realisasi_anggaran))).filter((n) => !Number.isNaN(n))
        const totalAnggaran = angNums.length > 0 ? angNums.reduce((a, b) => a + b, 0) : null
        const capaian = calcCapaian(persen, iksk?.target_tahunan, iksk?.polaritas ?? 'Positive')
        const latestKendala = [...entries].sort(byInputTerakhir).map((e) => e.catatan_kendala).find((c) => c && c.trim()) || ''
        const bukti = entries.filter((e) => e.bukti_path)
        return { rencana: r, cascading: r.cascading, iksk, sk, entries, persen, totalAnggaran, capaian, latestKendala, bukti }
      })
      .sort((a, b) => {
        const skA = a.sk?.nomor ?? 999
        const skB = b.sk?.nomor ?? 999
        if (skA !== skB) return skA - skB
        return (a.iksk?.nomor_urut ?? 999) - (b.iksk?.nomor_urut ?? 999)
      })

    const keyword = search.trim().toLowerCase()
    if (!keyword) return scoped
    return scoped.filter((row) =>
      (row.rencana.rencana_aksi ?? '').toLowerCase().includes(keyword) ||
      (row.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
      (row.sk?.uraian ?? '').toLowerCase().includes(keyword),
    )
  }, [rencanaRows, cascadingById, ikskById, skById, realisasiRows, filterTahun, filterTriwulan, userUnit, search])

  const summary = useMemo(() => {
    const capaians = recap.map((r) => r.capaian).filter((c) => c !== null)
    const rataCapaian = capaians.length > 0 ? capaians.reduce((a, b) => a + b, 0) / capaians.length : null
    const totalAnggaranRencana = recap.reduce((s, r) => s + (r.rencana.anggaran === null ? 0 : Number(r.rencana.anggaran) || 0), 0)
    const totalRealisasiAnggaran = recap.reduce((s, r) => s + (r.totalAnggaran ?? 0), 0)
    // Ringkasan kaki dokumen (sama pola dengan Laporan Kinerja Organisasi).
    const targetTw = targetTriwulanOf(filterTriwulan)
    return {
      rencana: recap.length,
      terealisasi: recap.filter((r) => r.entries.length > 0).length,
      rataCapaian,
      totalAnggaranRencana,
      totalRealisasiAnggaran,
      targetTw,
      persenCapaianTw: rataCapaian === null || !targetTw ? null : (rataCapaian / targetTw) * 100,
      persenRealisasiAnggaran: totalAnggaranRencana > 0 ? (totalRealisasiAnggaran / totalAnggaranRencana) * 100 : null,
    }
  }, [recap, filterTriwulan])

  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const seksiNama = userUnit?.nama_unit ?? currentUser?.unitKerjaNama ?? 'Seksi'
  const triwulanLabel = filterTriwulan === 'Semua' ? 'SEMUA TRIWULAN' : filterTriwulan.toUpperCase()
  const tahunLabel = filterTahun === 'Semua'
    ? (() => {
        const set = new Set(recap.map((r) => String(r.rencana.tahun_anggaran)))
        const list = [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
        return list[0] ?? '—'
      })()
    : filterTahun
  const docTitle = 'LAPORAN CAPAIAN KINERJA'
  const docSub1 = `TRIWULAN ${triwulanLabel.replace('TW ', '')} (TARGET ${summary.targetTw}%)`
  const docSub2 = `TAHUN ${tahunLabel}`
  const docSub3 = seksiNama.toUpperCase()

  const persenCellText = (row) => {
    if (row.persen === null) return '-'
    if (row.rencana.satuan === 'Persen') return `${row.persen.toFixed(2)}%`
    return Number.isInteger(row.persen) ? String(row.persen) : row.persen.toFixed(2)
  }

  const keteranganText = (row) => {
    if (row.latestKendala) return row.latestKendala
    return row.entries.length > 0 ? 'Tidak ada kendala dilaporkan seksi.' : 'Belum ada realisasi.'
  }

  // ---------- Unduh Excel (.xls via HTML table, pola Laporan Organisasi) ----------
  const handleExportExcel = useCallback(() => {
    if (exporting) return
    setExporting(true)
    try {
      const head = ['No', 'SK', 'No IKSK', 'IKSK', 'Target Tahunan', 'Anggaran', '% Realisasi Target', 'Realisasi Anggaran', '% Capaian Kinerja', 'Keterangan', 'Bukti Dukung']
      const bodyRows = recap.map((row, idx) => ([
        idx + 1,
        row.sk ? `${row.sk.nomor}. ${row.sk.uraian}` : 'SK terhapus',
        ikskNumber(row.iksk),
        `${row.iksk?.uraian ?? 'IKSK terhapus'} (Rencana: ${row.rencana.rencana_aksi} • Target: ${row.rencana.target_kinerja})`,
        row.iksk?.target_tahunan ?? '-',
        row.rencana.anggaran === null ? '-' : Number(row.rencana.anggaran),
        row.persen === null ? '-' : (row.rencana.satuan === 'Persen' ? Number(row.persen.toFixed(2)) : (Number.isInteger(row.persen) ? row.persen : Number(row.persen.toFixed(2)))),
        row.totalAnggaran === null ? '-' : row.totalAnggaran,
        row.capaian === null ? '-' : Number(row.capaian.toFixed(2)),
        keteranganText(row),
        row.bukti.length > 0 ? `${row.bukti.length} dokumen` : '-',
      ]))
      const tds = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`
      const html = [
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>',
        `<h2 style="text-align:center">${escapeHtml(docTitle)}</h2>`,
        `<h3 style="text-align:center">${escapeHtml(docSub1)}</h3>`,
        `<h3 style="text-align:center">${escapeHtml(docSub2)}</h3>`,
        `<h3 style="text-align:center">${escapeHtml(docSub3)}</h3>`,
        '<table border="1">',
        tds(head, 'th'),
        ...bodyRows.map((cells) => tds(cells, 'td')),
        tds(['', '', '', '', '', '', '', '', '', '', ''], 'td'),
        `<tr><td colspan="11"><b>RINGKASAN SEKSI — ${escapeHtml(docSub1)} • ${escapeHtml(docSub2)}</b></td></tr>`,
        tds(['Jumlah rata-rata capaian kinerja seksi', summary.rataCapaian === null ? '-' : `${summary.rataCapaian.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        tds([`% capaian seksi ((rata-rata / target triwulan ${summary.targetTw}%) * 100)`, summary.persenCapaianTw === null ? '-' : `${summary.persenCapaianTw.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Jumlah anggaran', formatRupiah(summary.totalAnggaranRencana), '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Jumlah realisasi anggaran', formatRupiah(summary.totalRealisasiAnggaran), '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Persentase realisasi anggaran', summary.persenRealisasiAnggaran === null ? '-' : `${summary.persenRealisasiAnggaran.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        '</table></body></html>',
      ].join('')
      const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeTw = filterTriwulan === 'Semua' ? 'Semua' : filterTriwulan.replace(/\s+/g, '')
      const safeSeksi = docSub3.replace(/[^A-Z0-9]+/gi, '_').slice(0, 40)
      a.href = url
      a.download = `Laporan_Capaian_Kinerja_${safeSeksi}_${safeTw}_${tahunLabel}.xls`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [exporting, recap, ikskNumber, docTitle, docSub1, docSub2, docSub3, summary, filterTriwulan, tahunLabel])

  // ---------- Cetak laporan (dokumen print -> simpan sebagai PDF) ----------
  const handlePrintPdf = useCallback(() => {
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return
    const head = ['No', 'SK', 'No IKSK', 'IKSK', 'Target Tahunan', 'Anggaran', '% Realisasi Target', 'Realisasi Anggaran', '% Capaian Kinerja', 'Keterangan', 'Bukti']
    const bodyHtml = recap.map((row, idx) => (
      `<tr>
        <td>${idx + 1}</td>
        <td>${row.sk ? `<b>${escapeHtml(row.sk.nomor)}.</b> ${escapeHtml(row.sk.uraian)}` : 'SK terhapus'}</td>
        <td><b>${escapeHtml(ikskNumber(row.iksk))}</b></td>
        <td>${escapeHtml(row.iksk?.uraian ?? 'IKSK terhapus')}<br><small>Rencana: ${escapeHtml(row.rencana.rencana_aksi)} • Target: ${escapeHtml(row.rencana.target_kinerja)}</small></td>
        <td><b>${escapeHtml(row.iksk?.target_tahunan ?? '-')}</b></td>
        <td>${escapeHtml(formatRupiah(row.rencana.anggaran))}</td>
        <td><b>${escapeHtml(persenCellText(row))}</b></td>
        <td>${escapeHtml(row.totalAnggaran === null ? '-' : formatRupiah(row.totalAnggaran))}</td>
        <td><b>${row.capaian === null ? '-' : `${row.capaian.toFixed(2)}%`}</b></td>
        <td>${escapeHtml(keteranganText(row))}</td>
        <td style="text-align:center">${row.bukti.length > 0 ? `${row.bukti.length} dok` : '-'}</td>
      </tr>`
    )).join('')
    const summaryHtml = `
      <tr><td colspan="11" style="background:#eee"><b>RINGKASAN SEKSI</b></td></tr>
      <tr><td colspan="5"><b>Jumlah rata-rata capaian kinerja seksi</b></td><td colspan="6"><b>${summary.rataCapaian === null ? '-' : `${summary.rataCapaian.toFixed(2)}%`}</b></td></tr>
      <tr><td colspan="5"><b>% capaian seksi ((rata-rata / target triwulan ${summary.targetTw}%) × 100)</b></td><td colspan="6"><b>${summary.persenCapaianTw === null ? '-' : `${summary.persenCapaianTw.toFixed(2)}%`}</b></td></tr>
      <tr><td colspan="5"><b>Jumlah anggaran</b></td><td colspan="6"><b>${escapeHtml(formatRupiah(summary.totalAnggaranRencana))}</b></td></tr>
      <tr><td colspan="5"><b>Jumlah realisasi anggaran</b></td><td colspan="6"><b>${escapeHtml(formatRupiah(summary.totalRealisasiAnggaran))}</b></td></tr>
      <tr><td colspan="5"><b>Persentase realisasi anggaran</b></td><td colspan="6"><b>${summary.persenRealisasiAnggaran === null ? '-' : `${summary.persenRealisasiAnggaran.toFixed(2)}%`}</b></td></tr>`
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(docTitle)} - ${escapeHtml(docSub1)} - ${escapeHtml(docSub2)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
        h1, h2, h3 { text-align: center; margin: 2px 0; }
        h1 { font-size: 20px; } h2 { font-size: 15px; } h3 { font-size: 13px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        th, td { border: 1px solid #333; padding: 6px; vertical-align: top; text-align: left; }
        th { background: #f0f0f0; }
        small { color: #555; }
        .meta { text-align:center; color:#444; font-size:11px; margin-top:8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${escapeHtml(docTitle)}</h1>
      <h2>${escapeHtml(docSub1)}</h2>
      <h2>${escapeHtml(docSub2)}</h2>
      <h3>${escapeHtml(docSub3)}</h3>
      <p class="meta">${recap.length} rencana • ${summary.terealisasi} terealisasi • Rumus sama dengan Laporan Kinerja Organisasi.</p>
      <table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${bodyHtml || `<tr><td colspan="11" style="text-align:center">Belum ada data.</td></tr>`}${summaryHtml}</tbody></table>
      <script>window.onload = () => { window.focus(); window.print(); }${'<'}${'/script>'}
      </body></html>`)
    win.document.close()
  }, [recap, ikskNumber, summary, docTitle, docSub1, docSub2, docSub3])

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
          <span className="hover:text-primary transition-colors cursor-pointer">Kepala Seksi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Laporan Kinerja Seksi</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Laporan Kinerja Seksi</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
              {recap.length} Rencana
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-space-xs">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || loading || recap.length === 0}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg border border-outline-variant bg-surface px-space-md font-body-md text-body-md font-bold text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              {exporting ? 'Mengunduh...' : 'Unduh Excel'}
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={loading || recap.length === 0}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Cetak / PDF
            </button>
          </div>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Rekap otomatis dari Rencana Aksi {userUnit ? <span className="font-bold text-on-surface">{userUnit.nama_unit}</span> : 'seksi Anda'} dan
          riwayat realisasinya — tanpa form isian, siap menjadi bahan laporan triwulan.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        {[
          { label: 'Rencana Terealisasi', value: `${summary.terealisasi} / ${summary.rencana}`, icon: 'checklist' },
          { label: 'Rata-rata Capaian Kinerja', value: summary.rataCapaian === null ? '-' : `${summary.rataCapaian.toFixed(2)}%`, icon: 'analytics' },
          { label: 'Total Anggaran Rencana', value: formatRupiah(summary.totalAnggaranRencana), icon: 'account_balance_wallet' },
          { label: 'Total Realisasi Anggaran', value: formatRupiah(summary.totalRealisasiAnggaran), icon: 'payments' },
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Tabel Rekap Capaian</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${recap.length} baris rekap`}
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
              placeholder="Cari SK / IKSK / rencana..."
              aria-label="Cari rekap"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Tabel rekap */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1680px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">SK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">Target Tahunan</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">% Realisasi Target</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[160px]">Realisasi Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[130px]">% Capaian Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">Keterangan</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[110px]">Bukti Dukung</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                      Memuat data dari Supabase...
                    </span>
                  </td>
                </tr>
              ) : recap.length > 0 ? recap.map((row, idx) => {
                const st = statusKeterangan(row.capaian, row.entries.length > 0, row.latestKendala)
                return (
                  <tr key={row.rencana.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                    <td className="px-space-md py-space-sm max-w-[240px]">
                      {row.sk
                        ? <><span className="font-mono font-bold text-primary">{row.sk.nomor}. </span><span className="font-body-sm text-body-sm text-on-surface">{row.sk.uraian}</span></>
                        : <span className="font-body-sm text-body-sm text-error">SK terhapus</span>}
                    </td>
                    <td className="px-space-md py-space-sm font-mono font-bold text-primary whitespace-nowrap">
                      {row.iksk ? ikskNumber(row.iksk) : '-'}
                    </td>
                    <td className="px-space-md py-space-sm max-w-[260px]">
                      {row.iksk
                        ? <>
                          <span className="font-body-sm text-body-sm text-on-surface">{row.iksk.uraian}</span>
                          <span className="block font-body-sm text-body-sm text-secondary">
                            Rencana: <span className="font-semibold text-on-surface">{row.rencana.rencana_aksi}</span>
                            {' '}• Target: <span className="font-bold">{row.rencana.target_kinerja}</span>
                          </span>
                        </>
                        : <span className="font-body-sm text-body-sm text-error">IKSK terhapus</span>}
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <span className="font-body-sm text-body-sm text-on-surface font-extrabold">{row.iksk?.target_tahunan ?? '-'}</span>
                      {row.iksk && (
                        <span className={`ml-2 inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${satuanBadge(row.iksk.satuan)}`}>
                          {row.iksk.satuan}
                        </span>
                      )}
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">
                      {formatRupiah(row.rencana.anggaran)}
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
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface font-bold whitespace-nowrap">
                      {row.totalAnggaran === null ? '-' : formatRupiah(row.totalAnggaran)}
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
                    </td>
                    <td className="px-space-md py-space-sm max-w-[240px]">
                      <span className={`inline-flex items-center px-space-xs py-0.5 rounded-full font-label-sm font-bold whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                      {row.latestKendala && (
                        <span className="block font-body-sm text-body-sm text-secondary mt-1">{row.latestKendala}</span>
                      )}
                    </td>
                    <td className="px-space-md py-space-sm">
                      {row.bukti.length > 0 ? (
                        <div className="flex items-center justify-center gap-space-2xs flex-wrap">
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
                  <td colSpan="11" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua'
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada rencana aksi — isi Rencana Aksi Kinerja terlebih dahulu'}
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
            <span>% Realisasi diambil dari pengisian terakhir di tabel riwayat (nilai sudah akumulasi). % Capaian Positive = (%realisasi / target tahunan) × 100; Negative = (2 × (target tahunan / %realisasi)) × 100; capping 0–120%.</span>
          </div>
        </div>
      </div>

      {viewerRow && (
        <BuktiViewer row={viewerRow} onClose={() => setViewerRow(null)} />
      )}
    </div>
  )
}

export default LaporanKinerjaSeksi
