import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { BuktiViewer } from './RealisasiKinerjaForm'
import {
  TW_OPTIONS,
  TW_TARGET_PERSEN,
  computeOrganisasi,
  formatRupiah,
  ikskNumberOf,
} from '../lib/kinerjaOrganisasi'

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatPersen(v) {
  if (v === null || v === undefined) return '-'
  return `${v.toFixed(2)}%`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function LaporanKinerjaOrganisasi() {
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

  const tahunOptions = useMemo(() => {
    const set = new Set([
      ...rencanaRows.map((r) => String(r.tahun_anggaran)),
      ...realisasiRows.map((r) => String(r.tahun_anggaran)),
    ])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [rencanaRows, realisasiRows])

  const { rows: orgRows, footer } = useMemo(() => computeOrganisasi({
    skList, ikskList, unitList, cascadingRows, rencanaRows, realisasiRows,
    filterTahun, filterTriwulan,
  }), [skList, ikskList, unitList, cascadingRows, rencanaRows, realisasiRows, filterTahun, filterTriwulan])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return orgRows
    return orgRows.filter((row) =>
      (row.iksk?.uraian ?? '').toLowerCase().includes(keyword) ||
      (row.sk?.uraian ?? '').toLowerCase().includes(keyword) ||
      String(row.iksk?.target_tahunan ?? '').toLowerCase().includes(keyword) ||
      row.seksiNames.some((n) => n.toLowerCase().includes(keyword)) ||
      row.kendalaList.some((k) => k.teks.toLowerCase().includes(keyword)),
    )
  }, [orgRows, search])

  const triwulanLabel = filterTriwulan === 'Semua' ? 'SEMUA TRIWULAN' : filterTriwulan.toUpperCase()
  const tahunLabel = filterTahun === 'Semua' ? (tahunOptions[0] ?? '—') : filterTahun
  const docTitle = `LAPORAN CAPAIAN KINERJA`
  const docSub1 = `TRIWULAN ${triwulanLabel.replace('TW ', '')} (TARGET ${footer.targetTriwulan}%)`
  const docSub2 = `TAHUN ${tahunLabel}`

  // ---------- Unduh Excel (.xls via HTML table, kompatibel Excel) ----------
  const handleExportExcel = useCallback(() => {
    if (exporting) return
    setExporting(true)
    try {
      const head = ['No', 'SK', 'No IKSK', 'IKSK', 'Target Tahunan', 'Anggaran', '% Realisasi Target', 'Realisasi Anggaran', '% Capaian Kinerja', 'Keterangan', 'Bukti Dukung']
      const bodyRows = filtered.map((row, idx) => {
        const keterangan = row.kendalaList.length > 0
          ? row.kendalaList.map((k) => `[${k.seksi} • ${formatTanggal(k.tanggal)}] ${k.teks}`).join(' | ')
          : (row.entriesCount > 0 ? 'Tidak ada kendala dilaporkan seksi.' : 'Belum ada realisasi dari seksi.')
        return [
          idx + 1,
          row.sk ? `${row.sk.nomor}. ${row.sk.uraian}` : 'SK terhapus',
          ikskNumberOf(row.iksk, skById),
          `${row.iksk?.uraian ?? 'IKSK terhapus'} (dipegang ${row.rencanaCount} rencana • ${row.seksiNames.join(', ')})`,
          row.iksk?.target_tahunan ?? '-',
          row.anggaran,
          row.persenOrg === null ? '-' : Number(row.persenOrg.toFixed(2)),
          row.realisasiAnggaran,
          row.capaian === null ? '-' : Number(row.capaian.toFixed(2)),
          keterangan,
          row.bukti.length > 0 ? `${row.bukti.length} dokumen` : '-',
        ]
      })
      const tds = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`
      const html = [
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>',
        `<h2 style="text-align:center">${escapeHtml(docTitle)}</h2>`,
        `<h3 style="text-align:center">${escapeHtml(docSub1)}</h3>`,
        `<h3 style="text-align:center">${escapeHtml(docSub2)}</h3>`,
        '<table border="1">',
        tds(head, 'th'),
        ...bodyRows.map((cells) => tds(cells, 'td')),
        // Row ringkasan paling bawah (dipakai juga untuk statistik public portal).
        tds(['', '', '', '', '', '', '', '', '', '', ''], 'td'),
        `<tr><td colspan="11"><b>RINGKASAN ORGANISASI — ${escapeHtml(docSub1)} • ${escapeHtml(docSub2)}</b></td></tr>`,
        tds(['Jumlah rata-rata capaian kinerja organisasi', footer.rataCapaian === null ? '-' : `${footer.rataCapaian.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        tds([`% capaian kinerja organisasi ((rata-rata / target triwulan ${footer.targetTriwulan}%) * 100)`, footer.persenCapaianOrg === null ? '-' : `${footer.persenCapaianOrg.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Jumlah anggaran', formatRupiah(footer.jumlahAnggaran), '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Jumlah realisasi anggaran', formatRupiah(footer.jumlahRealisasi), '', '', '', '', '', '', '', '', ''], 'td'),
        tds(['Persentase realisasi anggaran', footer.persenRealisasiAnggaran === null ? '-' : `${footer.persenRealisasiAnggaran.toFixed(2)}%`, '', '', '', '', '', '', '', '', ''], 'td'),
        '</table></body></html>',
      ].join('')
      const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeTw = filterTriwulan === 'Semua' ? 'Semua' : filterTriwulan.replace(/\s+/g, '')
      a.href = url
      a.download = `Laporan_Capaian_Kinerja_${safeTw}_${tahunLabel}.xls`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [exporting, filtered, skById, docTitle, docSub1, docSub2, footer, filterTriwulan, tahunLabel])

  // ---------- Cetak laporan (dokumen print -> simpan sebagai PDF) ----------
  const handlePrintPdf = useCallback(() => {
    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) return
    const head = ['No', 'SK', 'No IKSK', 'IKSK', 'Target Tahunan', 'Anggaran', '% Realisasi Target', 'Realisasi Anggaran', '% Capaian Kinerja', 'Keterangan', 'Bukti']
    const bodyHtml = filtered.map((row, idx) => {
      const keterangan = row.kendalaList.length > 0
        ? row.kendalaList.map((k) => `<div style="margin-bottom:4px"><b>[${escapeHtml(k.seksi)} • ${escapeHtml(formatTanggal(k.tanggal))}]</b> ${escapeHtml(k.teks)}</div>`).join('')
        : (row.entriesCount > 0 ? 'Tidak ada kendala dilaporkan seksi.' : 'Belum ada realisasi dari seksi.')
      return `<tr>
        <td>${idx + 1}</td>
        <td>${row.sk ? `<b>${escapeHtml(row.sk.nomor)}.</b> ${escapeHtml(row.sk.uraian)}` : 'SK terhapus'}</td>
        <td><b>${escapeHtml(ikskNumberOf(row.iksk, skById))}</b></td>
        <td>${escapeHtml(row.iksk?.uraian ?? 'IKSK terhapus')}<br><small>Diampu: ${escapeHtml(row.seksiNames.join(', '))} • ${row.rencanaCount} rencana</small></td>
        <td><b>${escapeHtml(row.iksk?.target_tahunan ?? '-')}</b></td>
        <td>${escapeHtml(formatRupiah(row.anggaran))}</td>
        <td><b>${row.persenOrg === null ? '-' : `${row.persenOrg.toFixed(2)}%`}</b></td>
        <td>${escapeHtml(formatRupiah(row.realisasiAnggaran))}</td>
        <td><b>${row.capaian === null ? '-' : `${row.capaian.toFixed(2)}%`}</b></td>
        <td>${keterangan}</td>
        <td style="text-align:center">${row.bukti.length > 0 ? `${row.bukti.length} dok` : '-'}</td>
      </tr>`
    }).join('')
    const summaryHtml = `
      <tr><td colspan="11" style="background:#eee"><b>RINGKASAN ORGANISASI</b></td></tr>
      <tr><td colspan="5"><b>Jumlah rata-rata capaian kinerja organisasi</b></td><td colspan="6"><b>${footer.rataCapaian === null ? '-' : `${footer.rataCapaian.toFixed(2)}%`}</b></td></tr>
      <tr><td colspan="5"><b>% capaian kinerja organisasi ((rata-rata / target triwulan ${footer.targetTriwulan}%) × 100)</b></td><td colspan="6"><b>${footer.persenCapaianOrg === null ? '-' : `${footer.persenCapaianOrg.toFixed(2)}%`}</b></td></tr>
      <tr><td colspan="5"><b>Jumlah anggaran</b></td><td colspan="6"><b>${escapeHtml(formatRupiah(footer.jumlahAnggaran))}</b></td></tr>
      <tr><td colspan="5"><b>Jumlah realisasi anggaran</b></td><td colspan="6"><b>${escapeHtml(formatRupiah(footer.jumlahRealisasi))}</b></td></tr>
      <tr><td colspan="5"><b>Persentase realisasi anggaran</b></td><td colspan="6"><b>${footer.persenRealisasiAnggaran === null ? '-' : `${footer.persenRealisasiAnggaran.toFixed(2)}%`}</b></td></tr>`
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
      <p class="meta">${filtered.length} IKSK • ${footer.rencanaCount} rencana • ${footer.seksiCount} seksi • Rumus sama dengan Laporan Kinerja Seksi; % Realisasi Target per IKSK = rata-rata seluruh seksi.</p>
      <table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${bodyHtml || `<tr><td colspan="11" style="text-align:center">Belum ada data.</td></tr>`}${summaryHtml}</tbody></table>
      <script>window.onload = () => { window.focus(); window.print(); }${'<'}${'/script>'}
      </body></html>`)
    win.document.close()
  }, [filtered, skById, footer, docTitle, docSub1, docSub2])

  return (
    <div className="max-w-[1720px] mx-auto">
      <div className="flex flex-col gap-space-2xs mb-space-lg">
        <div className="flex items-center gap-space-xs text-secondary font-label-md">
          <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Laporan Kinerja Organisasi</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Laporan Kinerja Organisasi</h1>
            <span className="inline-flex w-fit items-center gap-space-2xs px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
              <span className="material-symbols-outlined text-[14px]">assessment</span>
              {filtered.length} IKSK • {footer.seksiCount} Seksi
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
              onClick={handleExportExcel}
              disabled={exporting || loading || filtered.length === 0}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-surface-container-low px-space-md font-body-md text-body-md font-bold text-primary hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              {exporting ? 'Mengunduh...' : 'Unduh Excel'}
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={loading || filtered.length === 0}
              className="inline-flex items-center justify-center gap-space-2xs h-[42px] rounded-lg bg-primary px-space-md font-body-md text-body-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Cetak / PDF
            </button>
          </div>
        </div>
        <p className="font-body-md text-body-md text-secondary max-w-3xl">
          Agregat seluruh seksi per IKSK. Rumus capaian sama dengan Laporan Kinerja Seksi;{' '}
          <span className="font-bold text-on-surface">% Realisasi Target</span> per IKSK adalah{' '}
          <span className="font-bold text-on-surface">rata-rata isian seluruh seksi</span> yang memegang IKSK tersebut.
          Kolom <span className="font-bold text-on-surface">Keterangan</span> menggabungkan isian Kendala & Hambatan seluruh seksi.
        </p>
      </div>

      {/* Ringkasan organisasi (row paling bawah — juga dipakai statistik public portal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md mb-space-lg">
        {[
          { label: 'Rata-rata capaian kinerja', value: footer.rataCapaian === null ? '-' : `${footer.rataCapaian.toFixed(2)}%`, icon: 'analytics', hint: `${footer.ikskCount} IKSK` },
          { label: `% capaian kinerja org (÷ ${footer.targetTriwulan}%)`, value: footer.persenCapaianOrg === null ? '-' : `${footer.persenCapaianOrg.toFixed(2)}%`, icon: 'military_tech', hint: `Target ${filterTriwulan === 'Semua' ? 'tahunan 100%' : `${filterTriwulan} = ${footer.targetTriwulan}%`}` },
          { label: 'Jumlah anggaran', value: formatRupiah(footer.jumlahAnggaran), icon: 'account_balance_wallet', hint: `${footer.rencanaCount} rencana` },
          { label: 'Jumlah realisasi anggaran', value: formatRupiah(footer.jumlahRealisasi), icon: 'payments', hint: 'akumulasi seksi' },
          { label: 'Persentase realisasi anggaran', value: footer.persenRealisasiAnggaran === null ? '-' : `${footer.persenRealisasiAnggaran.toFixed(2)}%`, icon: 'savings', hint: 'realisasi ÷ anggaran × 100' },
        ].map((c) => (
          <div key={c.label} className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="font-label-sm text-label-sm text-secondary uppercase font-bold truncate" title={c.label}>{c.label}</div>
              <div className="font-data-metric text-data-metric text-on-surface truncate" title={c.value}>{c.value}</div>
              <div className="font-label-sm text-label-sm text-secondary truncate">{c.hint}</div>
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
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-space-sm mb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Tabel Capaian Organisasi per IKSK</h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {loading ? 'Memuat data...' : `${filtered.length} baris IKSK`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-space-sm w-full xl:w-auto">
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
              {TW_OPTIONS.map((t) => <option key={t} value={t}>{t} — target {TW_TARGET_PERSEN[t]}%</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</span>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari SK / IKSK / seksi / kendala..."
              aria-label="Cari laporan"
              className="w-full h-[42px] rounded-lg border border-outline-variant bg-surface ps-10 pe-space-sm font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            />
            <span className="material-symbols-outlined text-[18px] text-secondary absolute left-3 top-1/2 -translate-y-1/2">search</span>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1820px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[52px]">No</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">SK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[120px]">Target Tahunan</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">% Realisasi Target</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[160px]">Realisasi Anggaran</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">% Capaian Kinerja</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary min-w-[280px]">Keterangan</th>
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
              ) : filtered.length > 0 ? (
                <>
                  {filtered.map((row, idx) => (
                    <tr key={row.iksk.id} className="border-b border-surface-container hover:bg-surface-container-low/30 transition-colors align-top">
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm text-secondary">{idx + 1}</td>
                      <td className="px-space-md py-space-sm max-w-[240px]">
                        {row.sk
                          ? <><span className="font-mono font-bold text-primary">{row.sk.nomor}. </span><span className="font-body-sm text-body-sm text-on-surface">{row.sk.uraian}</span></>
                          : <span className="font-body-sm text-body-sm text-error">SK terhapus</span>}
                      </td>
                      <td className="px-space-md py-space-sm font-mono font-bold text-primary whitespace-nowrap">
                        {ikskNumberOf(row.iksk, skById)}
                      </td>
                      <td className="px-space-md py-space-sm max-w-[300px]">
                        <span className="font-body-sm text-body-sm text-on-surface">{row.iksk?.uraian ?? 'IKSK terhapus'}</span>
                        <span className="block font-label-sm text-label-sm text-secondary mt-1">
                          Diampu: <span className="font-semibold">{row.seksiNames.join(', ')}</span> • {row.rencanaCount} rencana • {row.entriesCount} realisasi
                        </span>
                      </td>
                      <td className="px-space-md py-space-sm whitespace-nowrap">
                        <span className="font-body-sm text-body-sm text-on-surface font-extrabold">{row.iksk?.target_tahunan ?? '-'}</span>
                        {row.iksk?.satuan && (
                          <span className="ml-1 font-label-sm text-label-sm text-secondary">({row.iksk.satuan})</span>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm font-bold whitespace-nowrap">
                        {formatRupiah(row.anggaran)}
                      </td>
                      <td className="px-space-md py-space-sm whitespace-nowrap">
                        {row.persenOrg === null ? (
                          <span className="text-secondary">-</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-[110px]" title="Rata-rata % realisasi target seluruh seksi pemegang IKSK ini">
                            <span className="font-bold text-primary-container">{row.persenOrg.toFixed(2)}%</span>
                            <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                              <div className="h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, row.persenOrg)}%` }} />
                            </div>
                            <span className="font-label-sm text-label-sm text-secondary">rata-rata {row.rencanaCount} rencana</span>
                          </div>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm font-body-sm text-body-sm font-bold whitespace-nowrap">
                        {formatRupiah(row.realisasiAnggaran)}
                      </td>
                      <td className="px-space-md py-space-sm whitespace-nowrap">
                        {row.capaian === null ? (
                          <span className="text-secondary">-</span>
                        ) : (
                          <span className="font-bold text-primary">{row.capaian.toFixed(2)}%</span>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm max-w-[360px] min-w-[280px]">
                        {row.kendalaList.length > 0 ? (
                          <ul className="flex flex-col gap-space-2xs">
                            {row.kendalaList.map((k) => (
                              <li key={k.id} className="rounded-lg bg-surface-container-low px-space-sm py-space-2xs border border-outline-variant/50">
                                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{k.teks}</p>
                                <p className="font-label-sm text-label-sm text-secondary mt-1">
                                  {k.seksi} • {formatTanggal(k.tanggal)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="font-body-sm text-body-sm text-secondary italic">
                            {row.entriesCount > 0 ? 'Tidak ada kendala dilaporkan seksi.' : 'Belum ada realisasi dari seksi.'}
                          </span>
                        )}
                      </td>
                      <td className="px-space-md py-space-sm">
                        {row.bukti.length > 0 ? (
                          <div className="flex items-center justify-center gap-space-2xs flex-wrap">
                            <span className="w-full text-center font-label-sm text-label-sm font-bold text-secondary">{row.bukti.length} dok</span>
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
                  ))}
                  {/* Row paling bawah: ringkasan organisasi */}
                  <tr className="bg-surface-container-low/70 font-bold">
                    <td colSpan="5" className="px-space-md py-space-sm font-body-sm text-body-sm text-on-surface">
                      RINGKASAN ORGANISASI — {docSub1} • {docSub2}
                      <span className="block font-label-sm text-label-sm text-secondary font-normal">
                        % capaian org = (rata-rata capaian ÷ target triwulan {footer.targetTriwulan}%) × 100 • % anggaran = (realisasi ÷ anggaran) × 100
                      </span>
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm whitespace-nowrap">{formatRupiah(footer.jumlahAnggaran)}</td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm whitespace-nowrap">
                      {formatPersen(footer.avgRealisasiTarget)}
                      <span className="block font-label-sm text-label-sm text-secondary font-normal">rata-rata % realisasi</span>
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm whitespace-nowrap">{formatRupiah(footer.jumlahRealisasi)}</td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm whitespace-nowrap">
                      {formatPersen(footer.rataCapaian)}
                      <span className="block font-label-sm text-label-sm text-secondary font-normal">rata-rata capaian</span>
                    </td>
                    <td className="px-space-md py-space-sm font-body-sm text-body-sm">
                      % capaian org: <span className="text-primary">{formatPersen(footer.persenCapaianOrg)}</span>
                      <span className="block font-label-sm text-label-sm text-secondary font-normal">% anggaran: {formatPersen(footer.persenRealisasiAnggaran)}</span>
                    </td>
                    <td className="px-space-md py-space-sm text-center font-body-sm text-body-sm text-secondary">—</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="11" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    <span className="flex items-center justify-center gap-space-2xs">
                      <span className="material-symbols-outlined text-[24px]">search_off</span>
                      {search || filterTahun !== 'Semua' || filterTriwulan !== 'Semua'
                        ? 'Tidak ada hasil yang cocok dengan filter'
                        : 'Belum ada rencana aksi — seksi belum mengisi Rencana Aksi Kinerja'}
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
            <span>% Capaian Positive = (%realisasi / target tahunan) × 100; Negative = (2 × (target tahunan / %realisasi)) × 100; capping 0–120%.</span>
          </div>
          <span>Ringkasan bawah dipakai untuk statistik Public Portal.</span>
        </div>
      </div>

      {viewerRow && (
        <BuktiViewer row={viewerRow} onClose={() => setViewerRow(null)} />
      )}
    </div>
  )
}

export default LaporanKinerjaOrganisasi
