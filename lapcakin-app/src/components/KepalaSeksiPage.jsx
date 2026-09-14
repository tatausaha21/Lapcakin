import { useEffect, useMemo, useRef, useState } from 'react'

const initialRows = [
  {
    id: 1,
    sasaran: 'Peningkatan Kualifikasi dan Kompetensi Guru Madrasah',
    iksk: 'IKSK.01: Jumlah guru MA/MTs tersertifikasi pedagogik digital',
    evidenLabel: 'Eviden: 2 Berkas Valid',
    evidenOk: true,
    target: 120,
    satuan: 'Orang',
    realisasi: 115,
    anggaranRealisasi: 'Rp 45.000.000',
    anggaranAlokasi: 'Rp 48.000.000',
    hambatan:
      '5 guru wilayah 3T berhalangan mengikuti modul luring; dijadwalkan sesi tutorial daring asinkron di awal TW II.',
    status: 'Disetujui',
  },
  {
    id: 2,
    sasaran: 'Penyaluran Bantuan Operasional Sekolah (BOS) Madrasah Tahap 1',
    iksk: 'IKSK.02: Persentase lembaga madrasah penerima BOS tepat waktu',
    evidenLabel: 'Eviden: BAST & KPPN Valid',
    evidenOk: true,
    target: 48,
    satuan: 'Madrasah',
    realisasi: 48,
    anggaranRealisasi: 'Rp 350.000.000',
    anggaranAlokasi: 'Rp 350.000.000',
    hambatan: 'Penyaluran 100% tuntas via Rekening Penyalur Bank Syariah Indonesia tanpa retur per 20 Maret 2026.',
    status: 'Disetujui',
  },
  {
    id: 3,
    sasaran: 'Pengawasan Asesmen Nasional Berbasis Komputer (ANBK)',
    iksk: 'IKSK.03: Lembaga madrasah yang terakreditasi dan siap infrastruktur ANBK',
    evidenLabel: 'Eviden: 1 Berkas Diperlukan',
    evidenOk: false,
    target: 32,
    satuan: 'Lembaga',
    realisasi: 30,
    anggaranRealisasi: 'Rp 92.500.000',
    anggaranAlokasi: 'Rp 122.000.000',
    hambatan: '2 madrasah swasta di pesisir masih menunggu perbaikan proctor server & genset cadangan.',
    status: 'Menunggu Verifikasi',
  },
]

const dokumenList = [
  {
    nama: 'SK_Penetapan_Penerima_BOS_TW1_2026.pdf',
    meta: 'No: SK-412/Kemenag/2026 • 15 Maret 2026 • 3.4 MB',
    kegiatan: 'Kegiatan: Penyaluran BOS Madrasah Tahap 1',
    status: 'Terverifikasi',
    icon: 'picture_as_pdf',
    iconBox: 'bg-error-container text-on-error-container',
  },
  {
    nama: 'BAST_Penyaluran_Komprehensif_48Madrasah.pdf',
    meta: 'No: BAST-09/Pendis/TW1/2026 • 20 Maret 2026 • 8.1 MB',
    kegiatan: 'Kegiatan: Penyaluran BOS Madrasah Tahap 1',
    status: 'Terverifikasi',
    icon: 'picture_as_pdf',
    iconBox: 'bg-error-container text-on-error-container',
  },
  {
    nama: 'Dokumentasi_Bimtek_Guru_Madrasah_Angkatan1.jpg',
    meta: 'Ref: Sesi Pembelajaran Digital Lab • 18 Maret 2026 • 4.6 MB',
    kegiatan: 'Kegiatan: Peningkatan Kualifikasi & Kompetensi Guru',
    status: 'Terverifikasi',
    icon: 'image',
    iconBox: 'bg-tertiary-fixed text-tertiary',
  },
  {
    nama: 'LPJ_Keuangan_DIPA_Diklat_Guru_TW1.zip',
    meta: 'No: LPJ-01/Bend/Madrasah/2026 • 22 Maret 2026 • 14.2 MB',
    kegiatan: 'Kegiatan: Peningkatan Kualifikasi & Kompetensi Guru',
    status: 'Menunggu Validasi',
    icon: 'folder_zip',
    iconBox: 'bg-surface-container text-secondary',
  },
]

const galeriList = [
  {
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9vYp-7gS3uUsFdQ3Q1ocFRhiX-5xjNhFC3OwcpjBQe5wvX1YubHC3r-SWWS-ncgUkqKcFUQrCD2eL1VDV5-fFgv2D7-s9i670bDJc3z_nJVGpNrStMzoYS1uc8a_Ow9FxbjbpNVXSA1EO4oqfl-Ve3WrsTNr2GF1q4t_7EBWzJ2-p9knj4ZeEe6WFprkXYhCjFSNPQkhvB7F1cXW6cTpqtsdfmYn0IfWu83XEEm4FCB8BWpieWFE',
    alt: 'Guru madrasah mengajar di kelas modern dengan komputer.',
    label: 'Pelatihan Pedagogik Digital',
    title: 'Sesi Pelatihan Mandiri Guru MA',
    lokasi: 'Laboratorium Komputer MAN 1 Kota',
  },
  {
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBFasfFg8Y4_1JZzoEtW5Gc7zP5j-ujNqgZNsKSxmrtVDdXMQTK6zsnlpK47rB3Jx2MMtv0iuROw-1dWuex2FsWR56U2jnsIVTePEcwTMCyZUiLbudDDz8OXXBfQYE-HY4gxSmUNgPDh5a-9ImZqQo__OULlu1WBZmGO8Sl5QawwDvzRHKtndZjAIKZFn23rR7MK8_EdbhhY21qUfJTM6GQ1OvGzmsuIHQZ0nlw1DDuX5YNnsjwmU8',
    alt: 'Rapat penyaluran BOS madrasah di aula kantor Kemenag.',
    label: 'Penyaluran BOS TW I',
    title: 'Sosialisasi & Penandatanganan BAST BOS',
    lokasi: 'Aula Pusat Layanan Haji & Umrah',
  },
  {
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARQLzGXQb5BG_fTnZ49QplOaO8Vo5HzKa8yzBkj3JqIcNw-xCI4kf4hD5ANM8CIaZm05ogaNyCOfadKwsqGODIbt4TwzdNVOC-ifK2FAju7FVBZboO6bR2CZV5XlDmXZNJEk_ZZlMkn0ckTo5127aJCgmoV-dYxnRCWExG27vVnMQtM-Vza4YfdJ9aY69Wt8Gp5f4FyPlPZVpC4TwPCpkR603BCnhRHKxqyM6hzXdcNJ6Wlb3JGJg',
    alt: 'Siswa madrasah mengerjakan ANBK di lab komputer.',
    label: 'Simulasi ANBK 2026',
    title: 'Kesiapan Infrastruktur Ujian Daring',
    lokasi: 'MTs Swasta Darul Hikmah',
  },
]

function calcCapaian(realisasi, target) {
  if (!target) return 0
  return (Number(realisasi) / Number(target)) * 100
}

function KepalaSeksiPage({ activePage, currentUser }) {
  const unitName = currentUser?.unitKerjaNama?.trim() || 'Seksi Pendidikan Madrasah'
  const defaultTab = activePage === 'bukti-dukung-seksi' ? 'eviden' : 'realisasi'
  const [tab, setTab] = useState(defaultTab)
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [exportOpen, setExportOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const exportRef = useRef(null)

  useEffect(() => {
    setTab(activePage === 'bukti-dukung-seksi' ? 'eviden' : 'realisasi')
  }, [activePage])

  useEffect(() => {
    const close = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const triggerToast = (message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q || r.sasaran.toLowerCase().includes(q) || r.iksk.toLowerCase().includes(q)
      const matchS =
        statusFilter === 'all' ||
        (statusFilter === 'approved' && r.status === 'Disetujui') ||
        (statusFilter === 'pending' && r.status === 'Menunggu Verifikasi') ||
        (statusFilter === 'revision' && r.status === 'Perlu Revisi')
      return matchQ && matchS
    })
  }, [rows, search, statusFilter])

  const rataCapaian =
    rows.length === 0 ? 0 : rows.reduce((s, r) => s + calcCapaian(r.realisasi, r.target), 0) / rows.length

  const tabBtnActive =
    'inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-lowest text-primary font-title-sm text-title-sm font-bold shadow-sm transition-all'
  const tabBtnIdle =
    'inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg text-secondary hover:text-on-surface font-title-sm text-title-sm transition-all'

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-space-lg w-full">
        {/* Top Context & Action Header */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">school</span>
                {unitName}
              </span>
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-container-high text-secondary font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_clock</span>
                Triwulan I - TA 2026
              </span>
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-error-container text-on-error-container font-label-md text-label-md animate-pulse">
                <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                Batas Pengisian: Tersisa 4 Hari (31 Maret 2026)
              </span>
            </div>
            <div className="flex items-center gap-space-xs mt-space-2xs flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">
                Input Realisasi Kinerja &amp; Rencana Aksi
              </h1>
              <span className="text-secondary font-body-sm text-body-sm hidden md:inline">
                | IKU Kemenag Berjenjang
              </span>
            </div>
            <p className="font-body-md text-body-md text-secondary max-w-3xl">
              Laporkan capaian volume output fisik, serapan anggaran riil DIPA, kendala lapang, dan lampirkan bukti
              verifikasi yuridis untuk penelaahan Tim Ortala Kemenag.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-xs shrink-0">
            <button
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-title-sm text-title-sm shadow-sm transition-all"
              type="button"
              onClick={() => triggerToast('Draf Realisasi TW I berhasil disimpan secara lokal pada server')}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Simpan Draf</span>
            </button>
            <div className="relative inline-block text-left" ref={exportRef}>
              <button
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-title-sm text-title-sm shadow-sm transition-all"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExportOpen((v) => !v)
                }}
              >
                <span className="material-symbols-outlined text-[18px] text-tertiary">download</span>
                <span>Cetak / Unduh Form</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
              {!exportOpen ? null : (
                <div className="absolute right-0 mt-space-2xs w-48 rounded-lg bg-surface-container-lowest shadow-xl py-space-2xs z-30">
                  <button
                    className="flex items-center gap-space-xs w-full px-space-md py-space-xs text-left text-on-surface hover:bg-surface-container font-body-sm text-body-sm"
                    type="button"
                    onClick={() => {
                      setExportOpen(false)
                      triggerToast('Mengekspor Dokumen PDF PK & Realisasi TW I...')
                    }}
                  >
                    <span className="material-symbols-outlined text-error text-[18px]">picture_as_pdf</span>
                    Format Cetak PDF (LAKIP)
                  </button>
                  <button
                    className="flex items-center gap-space-xs w-full px-space-md py-space-xs text-left text-on-surface hover:bg-surface-container font-body-sm text-body-sm"
                    type="button"
                    onClick={() => {
                      setExportOpen(false)
                      triggerToast('Mengunduh Kertas Kerja Excel...')
                    }}
                  >
                    <span className="material-symbols-outlined text-primary-container text-[18px]">table_chart</span>
                    Format Excel Matrix (XLSX)
                  </button>
                </div>
              )}
            </div>
            <button
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-primary-container hover:bg-primary text-on-primary font-title-sm text-title-sm shadow-md transition-all"
              type="button"
              onClick={() => triggerToast(`Laporan Kinerja ${unitName} berhasil dikirim ke Admin Organisasi (Biro Ortala)!`)}
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Kirim Laporan ke Admin</span>
            </button>
          </div>
        </div>

        {/* Overview Performance Banner & Metric Mosaic */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-space-md">
          <div className="md:col-span-2 lg:col-span-2 p-space-lg rounded-xl bg-gradient-to-br from-primary-container via-primary to-surface-tint text-on-primary shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-8 translate-y-8 pointer-events-none">
              <span className="material-symbols-outlined text-[200px]">verified</span>
            </div>
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-space-2xs">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed-dim">
                  Indeks Kinerja Triwulan I
                </span>
                <div className="flex items-baseline gap-space-xs flex-wrap">
                  <span className="font-display-lg text-display-lg font-extrabold text-on-primary">92.50%</span>
                  <span className="font-title-sm text-title-sm text-primary-fixed font-bold bg-primary/40 px-space-xs py-space-2xs rounded-lg">
                    Sangat Baik
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-on-primary/10 shadow-inner">
                <span className="material-symbols-outlined text-[32px] text-primary-fixed">analytics</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-md">
              <div className="flex items-center justify-between font-label-md text-label-md mb-space-2xs text-primary-fixed">
                <span>Kemajuan Pelaporan Target Kinerja</span>
                <span className="font-bold text-on-primary">5 dari 6 Indikator Terpenuhi</span>
              </div>
              <div className="w-full h-3 rounded-full bg-on-primary/20 overflow-hidden">
                <div className="h-full rounded-full bg-primary-fixed transition-all duration-500" style={{ width: '83.33%' }} />
              </div>
              <div className="flex justify-between items-center mt-space-xs text-primary-fixed-dim font-label-sm text-label-sm">
                <span>Sisa 1 Indikator menunggu kelengkapan BAST DIPA</span>
                <span className="text-on-primary font-semibold">Tingkat Akurasi: 98.2%</span>
              </div>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                  Total Realisasi Anggaran
                </span>
                <span className="font-data-metric text-data-metric text-on-surface mt-space-2xs">
                  Rp 487.500.000
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
            </div>
            <div className="space-y-space-2xs mt-space-md">
              <div className="flex items-center justify-between font-body-sm text-body-sm">
                <span className="text-secondary">Pagu DIPA TW I</span>
                <span className="font-bold text-on-surface">Rp 520.000.000</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full rounded-full bg-primary-container" style={{ width: '93.75%' }} />
              </div>
              <span className="font-label-sm text-label-sm text-primary-container font-semibold">
                93.75% terserap optimal
              </span>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">
                  Kelengkapan Eviden
                </span>
                <span className="font-data-metric text-data-metric text-on-surface mt-space-2xs">
                  14 / 16 Berkas
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
            </div>
            <div className="flex flex-col gap-space-2xs mt-space-md">
              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-secondary">Status Verifikasi Tim Ortala</span>
                <span className="font-bold text-tertiary">87.5% Terunggah</span>
              </div>
              <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary">
                <span className="w-2 h-2 rounded-full bg-primary-container" />
                <span>12 Lolos Uji Petik</span>
                <span className="w-2 h-2 rounded-full bg-error ml-space-xs" />
                <span>2 Perlu Revisi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-space-xs p-space-2xs rounded-xl bg-surface-container-low shadow-inner w-full sm:w-fit flex-wrap">
          <button className={tab === 'realisasi' ? tabBtnActive : tabBtnIdle} type="button" onClick={() => setTab('realisasi')}>
            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            <span>Rencana Aksi &amp; Input Realisasi</span>
            <span className="px-space-xs py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">
              3 Kegiatan
            </span>
          </button>
          <button className={tab === 'eviden' ? tabBtnActive : tabBtnIdle} type="button" onClick={() => setTab('eviden')}>
            <span className="material-symbols-outlined text-[20px]">attach_file</span>
            <span>Unggah Bukti Dukung Seksi</span>
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
              4 Terhubung
            </span>
          </button>
        </div>

        {/* TAB 1: Rencana Aksi & Formulir Realisasi */}
        {tab === 'realisasi' ? (
          <div className="flex flex-col gap-space-md w-full">
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md">
              <div className="flex flex-wrap items-center gap-space-sm">
                <div className="relative min-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">
                    search
                  </span>
                  <input
                    className="w-full pl-9 pr-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container transition-all"
                    placeholder="Cari sasaran program atau IKSK..."
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Semua Status Persetujuan</option>
                  <option value="approved">Disetujui Admin</option>
                  <option value="pending">Menunggu Review</option>
                  <option value="revision">Perlu Revisi</option>
                </select>
              </div>
              <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[18px] text-primary-container">info</span>
                <span>Perubahan data otomatis dikalkulasi terhadap agregat IKU Kementerian. Simpan draf berkala.</span>
              </div>
            </div>

            <div className="w-full rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-md text-body-md min-w-[1100px]">
                  <thead>
                    <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-md px-space-md w-12 text-center">No</th>
                      <th className="py-space-md px-space-md min-w-[220px]">Sasaran Program &amp; IKSK</th>
                      <th className="py-space-md px-space-md w-28 text-center">Target TW I</th>
                      <th className="py-space-md px-space-md min-w-[200px]">Realisasi Fisik</th>
                      <th className="py-space-md px-space-md w-28 text-center">% Capaian</th>
                      <th className="py-space-md px-space-md min-w-[180px]">Serapan DIPA</th>
                      <th className="py-space-md px-space-md min-w-[240px]">Analisis Hambatan &amp; Tindak Lanjut</th>
                      <th className="py-space-md px-space-md w-36 text-center">Approval Admin</th>
                      <th className="py-space-md px-space-md w-20 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {filteredRows.map((row, idx) => {
                      const capaian = calcCapaian(row.realisasi, row.target)
                      return (
                        <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-space-md px-space-md text-center font-bold text-secondary">{idx + 1}</td>
                          <td className="py-space-md px-space-md">
                            <div className="flex flex-col gap-space-2xs">
                              <span className="font-title-sm text-title-sm font-bold text-on-surface">{row.sasaran}</span>
                              <span className="font-body-sm text-body-sm text-secondary">{row.iksk}</span>
                              <span
                                className={`inline-flex items-center gap-1 font-label-sm text-label-sm font-semibold ${
                                  row.evidenOk ? 'text-primary-container' : 'text-error'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {row.evidenOk ? 'link' : 'pending_actions'}
                                </span>
                                {row.evidenLabel}
                              </span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-center font-bold text-on-surface">
                            {row.target} <span className="text-secondary font-normal font-label-sm text-label-sm">{row.satuan}</span>
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex items-center gap-space-xs">
                              <input
                                className="w-20 px-space-xs py-space-2xs rounded-lg bg-surface-container-low font-bold text-on-surface text-center focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container"
                                type="number"
                                value={row.realisasi}
                                onChange={(e) => updateRow(row.id, 'realisasi', Number(e.target.value))}
                              />
                              <span className="text-secondary font-body-sm text-body-sm">{row.satuan}</span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-primary-container font-title-sm text-title-sm">
                                {capaian.toFixed(2)}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-surface-container mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-primary-container rounded-full"
                                  style={{ width: `${Math.min(100, capaian)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md">
                            <div className="flex flex-col">
                              <input
                                className="px-space-xs py-space-2xs rounded-lg bg-surface-container-low font-semibold text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                                type="text"
                                value={row.anggaranRealisasi}
                                onChange={(e) => updateRow(row.id, 'anggaranRealisasi', e.target.value)}
                              />
                              <span className="font-label-sm text-label-sm text-secondary mt-0.5">
                                Alokasi: {row.anggaranAlokasi}
                              </span>
                            </div>
                          </td>
                          <td className="py-space-md px-space-md">
                            <textarea
                              className="w-full px-space-xs py-space-2xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container"
                              rows="2"
                              value={row.hambatan}
                              onChange={(e) => updateRow(row.id, 'hambatan', e.target.value)}
                            />
                          </td>
                          <td className="py-space-md px-space-md text-center">
                            {row.status === 'Disetujui' ? (
                              <span className="inline-flex items-center gap-1 px-space-xs py-1 rounded-full bg-primary-container/20 text-primary font-label-sm text-label-sm font-bold">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Disetujui
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-space-xs py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                                <span className="material-symbols-outlined text-[14px]">sync</span>
                                Menunggu Verifikasi
                              </span>
                            )}
                          </td>
                          <td className="py-space-md px-space-md text-center">
                            <button
                              className="p-space-2xs rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                              title="Simpan Baris Ini"
                              type="button"
                              onClick={() => triggerToast(`Menyimpan perubahan Kegiatan ${row.id}`)}
                            >
                              <span className="material-symbols-outlined text-[18px]">done</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-secondary font-label-sm text-label-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary-container">check_circle</span>
                  <span>Menampilkan {filteredRows.length} dari {rows.length} Sasaran Strategis {unitName} TW I 2026</span>
                </div>
                <div className="flex items-center gap-space-md flex-wrap">
                  <span>
                    Rata-rata Capaian Kinerja:{' '}
                    <strong className="text-on-surface font-title-sm text-title-sm">{rataCapaian.toFixed(2)}%</strong>
                  </span>
                  <span>
                    Total Realisasi Pagu:{' '}
                    <strong className="text-on-surface font-title-sm text-title-sm">Rp 487.500.000</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-space-lg w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              <div className="lg:col-span-5 flex flex-col gap-space-md">
                <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                      </div>
                      <h3 className="font-title-sm text-title-sm font-bold text-on-surface">Unggah Bukti Baru</h3>
                    </div>
                    <span className="font-label-sm text-label-sm text-secondary">PDF / JPG / ZIP maks. 25MB</span>
                  </div>
                  <div className="flex flex-col gap-space-sm">
                    <div>
                      <label className="font-label-md text-label-md text-on-surface font-semibold mb-space-2xs block">
                        Pilih Kegiatan Terkait
                      </label>
                      <select className="w-full px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
                        <option>Peningkatan Kualifikasi &amp; Kompetensi Guru</option>
                        <option>Penyaluran BOS Madrasah Tahap 1</option>
                        <option selected="">Pengawasan Asesmen Nasional Berbasis Komputer</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-space-xs">
                      <div>
                        <label className="font-label-md text-label-md text-on-surface font-semibold mb-space-2xs block">
                          Nomor Surat / Naskah
                        </label>
                        <input
                          className="w-full px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                          placeholder="Mis. B-104/Kk.13/PP.00/03/2026"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="font-label-md text-label-md text-on-surface font-semibold mb-space-2xs block">
                          Tanggal Dokumen
                        </label>
                        <input
                          className="w-full px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                          type="date"
                          defaultValue="2026-03-24"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface font-semibold mb-space-2xs block">
                        Kategori Eviden
                      </label>
                      <select className="w-full px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container">
                        <option>SK Penetapan Penerima / Penugasan (PDF)</option>
                        <option>Berita Acara Serah Terima / BAST (PDF)</option>
                        <option>Laporan Pertanggungjawaban Keuangan (LPJ)</option>
                        <option selected="">Dokumentasi Foto / Monitoring Fisik</option>
                      </select>
                    </div>
                    <div className="mt-space-2xs p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-inner">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary-container mb-space-xs">
                        <span className="material-symbols-outlined text-[28px]">file_upload</span>
                      </div>
                      <span className="font-title-sm text-title-sm font-bold text-on-surface">
                        Tarik &amp; Lepaskan berkas di sini
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary mt-1">
                        atau klik untuk meramban berkas lokal dari perangkat
                      </span>
                      <button
                        className="mt-space-sm px-space-md py-space-2xs rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold shadow-sm"
                        type="button"
                      >
                        Pilih Dokumen
                      </button>
                    </div>
                    <button
                      className="w-full mt-space-xs py-space-xs rounded-lg bg-primary-container hover:bg-primary text-on-primary font-title-sm text-title-sm font-bold shadow-md transition-all flex items-center justify-center gap-space-xs"
                      type="button"
                      onClick={() => triggerToast('Berkas berhasil disimpan ke repositori eviden Seksi')}
                    >
                      <span className="material-symbols-outlined text-[20px]">upload_file</span>
                      <span>Konfirmasi Simpan Eviden</span>
                    </button>
                  </div>
                </div>
                <div className="p-space-md rounded-xl bg-surface-container text-on-surface shadow-sm flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-primary-container text-[24px]">verified</span>
                  <div className="flex flex-col font-body-sm text-body-sm gap-1">
                    <span className="font-bold text-on-surface">Standar Pengujian Tim Ortala:</span>
                    <span className="text-secondary leading-relaxed">
                      Seluruh scan SK dan BAST harus memiliki stempel basah atau barcode TTE BSrE yang sah agar tidak
                      ditolak saat audit triwulanan.
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 flex flex-col gap-space-md">
                <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">folder_copy</span>
                      </div>
                      <h3 className="font-title-sm text-title-sm font-bold text-on-surface">
                        Daftar Bukti Dukung Terverifikasi
                      </h3>
                    </div>
                    <span className="px-space-xs py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold">
                      4 Dokumen Siap
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-surface-container-low">
                    {dokumenList.map((doc) => (
                      <div key={doc.nama} className="py-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                        <div className="flex items-start gap-space-sm">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${doc.iconBox}`}>
                            <span className="material-symbols-outlined text-[22px]">{doc.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-title-sm text-title-sm font-bold text-on-surface">{doc.nama}</span>
                            <div className="flex flex-wrap items-center gap-x-space-sm gap-y-1 font-label-sm text-label-sm text-secondary mt-0.5">
                              <span>{doc.meta}</span>
                            </div>
                            <span className="font-body-sm text-body-sm text-primary-container font-medium mt-1">
                              {doc.kegiatan}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-space-xs shrink-0 self-end sm:self-center">
                          <span
                            className={`px-space-xs py-1 rounded-full font-label-sm text-label-sm font-bold ${
                              doc.status === 'Terverifikasi'
                                ? 'bg-primary-container/20 text-primary'
                                : 'bg-secondary-container text-secondary'
                            }`}
                          >
                            {doc.status}
                          </span>
                          <button className="p-space-2xs rounded-lg text-secondary hover:bg-surface-container" title="Lihat Berkas" type="button">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          <button className="p-space-2xs rounded-lg text-secondary hover:bg-surface-container" title="Unduh" type="button">
                            <span className="material-symbols-outlined text-[20px]">download</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Galeri Monitoring */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
                Galeri Monitoring Lapang Terpadu
              </span>
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface">
                Potret Pelaksanaan Rencana Aksi {unitName}
              </h3>
            </div>
            <span className="font-label-sm text-label-sm text-primary-container font-bold">Terintegrasi E-Kemenag</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {galeriList.map((g) => (
              <div key={g.title} className="group relative rounded-xl overflow-hidden shadow-sm bg-surface-container flex flex-col h-64">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  alt={g.alt}
                  src={g.img}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-on-surface/90 via-on-surface/20 to-transparent flex flex-col justify-end p-space-md text-surface">
                  <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider font-bold">
                    {g.label}
                  </span>
                  <span className="font-title-sm text-title-sm font-bold">{g.title}</span>
                  <span className="font-label-sm text-label-sm text-surface/80">{g.lokasi}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 transition-all duration-300 z-50 flex items-center gap-space-sm px-space-md py-space-sm rounded-xl bg-primary text-on-primary shadow-xl ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">info</span>
        <span className="font-body-sm text-body-sm font-semibold">{toast || 'Perubahan disimpan'}</span>
      </div>
    </div>
  )
}

export default KepalaSeksiPage
