import { useState } from 'react'

const tableData = [
  {
    no: '01',
    unit: 'Seksi Pendidikan Madrasah',
    code: 'KODE: SEKS-PENDIS-01',
    avatar: { initials: 'HM', bg: 'bg-primary-fixed text-on-primary-fixed' },
    nama: 'H. M. Syukri, M.Pd',
    nip: 'NIP. 19800315...',
    target: '92',
    total: '100 Siswa',
    capaian: 92.00,
    anggaran: '88.50%',
    bukti: { status: 'complete', text: 'Lengkap 100%', icon: 'check_circle', bg: 'bg-primary-fixed text-on-primary-fixed' },
    status: { label: 'Disetujui', bg: 'bg-primary-fixed text-on-primary-fixed' },
    actions: [
      { icon: 'visibility', title: 'Detail Kinerja', color: 'text-primary' },
      { icon: 'download', title: 'Unduh Berkas', color: 'text-secondary' },
    ],
  },
  {
    no: '02',
    unit: 'Seksi Bimas Islam',
    code: 'KODE: SEKS-BIMAS-02',
    avatar: { initials: 'KH', bg: 'bg-secondary-fixed text-on-secondary-fixed' },
    nama: 'Drs. K.H. Mansyur, M.Ag',
    nip: 'NIP. 19741120...',
    target: '87',
    total: '100 KUA',
    capaian: 87.00,
    anggaran: '82.10%',
    bukti: { status: 'complete', text: 'Lengkap 100%', icon: 'check_circle', bg: 'bg-primary-fixed text-on-primary-fixed' },
    status: { label: 'Disetujui', bg: 'bg-primary-fixed text-on-primary-fixed' },
    actions: [
      { icon: 'visibility', title: 'Detail Kinerja', color: 'text-primary' },
      { icon: 'download', title: 'Unduh Berkas', color: 'text-secondary' },
    ],
  },
  {
    no: '03',
    unit: 'Seksi Haji & Umrah (PHU)',
    code: 'KODE: SEKS-PHU-03',
    avatar: { initials: 'TR', bg: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    nama: 'H. Taufiqurrahman, SE',
    nip: 'NIP. 19820704...',
    target: '95',
    total: '100 CJH',
    capaian: 95.00,
    anggaran: '91.20%',
    bukti: { status: 'complete', text: 'Lengkap 100%', icon: 'check_circle', bg: 'bg-primary-fixed text-on-primary-fixed' },
    status: { label: 'Disetujui', bg: 'bg-primary-fixed text-on-primary-fixed' },
    actions: [
      { icon: 'visibility', title: 'Detail Kinerja', color: 'text-primary' },
      { icon: 'download', title: 'Unduh Berkas', color: 'text-secondary' },
    ],
  },
  {
    no: '04',
    unit: 'Seksi PAKIS',
    code: 'KODE: SEKS-PAKIS-04',
    avatar: { initials: 'ZA', bg: 'bg-surface-container-high text-on-surface' },
    nama: 'Dra. Hj. Zainab, M.Pd.I',
    nip: 'NIP. 19790101...',
    target: '78',
    total: '100 Santri',
    capaian: 78.00,
    anggaran: '74.15%',
    bukti: { status: 'incomplete', text: 'Belum Lengkap (75%)', icon: 'pending', bg: 'bg-surface-container-highest text-secondary' },
    status: { label: 'Perlu Revisi', bg: 'bg-surface-container-highest text-secondary' },
    actions: [
      { icon: 'rule', title: 'Verifikasi Catatan', color: 'text-on-primary-container', bg: 'bg-primary-container' },
      { icon: 'visibility', title: 'Detail Kinerja', color: 'text-secondary' },
    ],
  },
  {
    no: '05',
    unit: 'Subbagian Tata Usaha',
    code: 'KODE: SUBAG-TU-00',
    avatar: { initials: 'AF', bg: 'bg-primary-container text-on-primary-container' },
    nama: 'Drs. H. Ahmad Fauzi, M.Si',
    nip: 'Kasubag TU Satker',
    target: '96',
    total: '100 Dok',
    capaian: 96.00,
    anggaran: '92.80%',
    bukti: { status: 'complete', text: 'Lengkap 100%', icon: 'check_circle', bg: 'bg-primary-fixed text-on-primary-fixed' },
    status: { label: 'Disetujui', bg: 'bg-primary-fixed text-on-primary-fixed' },
    actions: [
      { icon: 'visibility', title: 'Detail Kinerja', color: 'text-primary' },
      { icon: 'download', title: 'Unduh Berkas', color: 'text-secondary' },
    ],
  },
]

function DataTable() {
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-low/50">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Rekapitulasi Kinerja Seksi & Subbagian</h2>
          <p className="font-body-sm text-body-sm text-secondary">Matriks capaian indikator kinerja serta realisasi anggaran triwulanan</p>
        </div>
        <div className="flex items-center gap-space-xs">
          <div className="relative">
            <input
              type="text"
              className="h-9 pl-8 pr-space-sm rounded-lg bg-surface-container text-on-surface font-body-sm text-[13px] placeholder:text-secondary focus:outline-none focus:bg-surface-container-high w-48 transition-all focus:w-64"
              placeholder="Cari nama seksi / PIC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="material-symbols-outlined absolute left-2 top-2 text-secondary text-[18px]">search</span>
          </div>
          <button className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary" title="Saring Data" type="button">
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider">
              <th className="py-space-sm px-space-md font-semibold">No</th>
              <th className="py-space-sm px-space-md font-semibold">Unit / Seksi</th>
              <th className="py-space-sm px-space-md font-semibold">Kepala Seksi / Penanggung Jawab</th>
              <th className="py-space-sm px-space-md font-semibold text-center">Target / Realisasi</th>
              <th className="py-space-sm px-space-md font-semibold text-center">% Capaian</th>
              <th className="py-space-sm px-space-md font-semibold text-center">% Anggaran</th>
              <th className="py-space-sm px-space-md font-semibold text-center">Bukti Dukung</th>
              <th className="py-space-sm px-space-md font-semibold text-center">Status</th>
              <th className="py-space-sm px-space-md font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-on-surface font-body-sm">
            {tableData.map((row, index) => (
              <tr key={index} className="hover:bg-surface-container-low/40 transition-colors">
                <td className="py-space-sm px-space-md font-bold text-secondary">{row.no}</td>
                <td className="py-space-sm px-space-md">
                  <div className="flex flex-col">
                    <span className="font-title-sm text-[14px] font-bold text-on-surface">{row.unit}</span>
                    <span className="font-label-sm text-secondary">{row.code}</span>
                  </div>
                </td>
                <td className="py-space-sm px-space-md">
                  <div className="flex items-center gap-space-xs">
                    <div className={`w-7 h-7 rounded-full ${row.avatar.bg} flex items-center justify-center font-bold text-[11px]`}>
                      {row.avatar.initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">{row.nama}</span>
                      <span className="font-label-sm text-secondary">{row.nip}</span>
                    </div>
                  </div>
                </td>
                <td className="py-space-sm px-space-md text-center font-semibold">
                  <span className="text-primary">{row.target}</span> / {row.total}
                </td>
                <td className="py-space-sm px-space-md text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className={`font-bold ${row.capaian >= 85 ? 'text-primary' : 'text-on-surface'}`}>{row.capaian.toFixed(2)}%</span>
                    <div className="w-16 bg-surface-container h-1.5 rounded-full overflow-hidden mt-0.5">
                      <div className={`h-full ${row.capaian >= 85 ? 'bg-primary' : 'bg-secondary'}`} style={{ width: `${row.capaian}%` }}></div>
                    </div>
                  </div>
                </td>
                <td className="py-space-sm px-space-md text-center">
                  <span className="font-semibold text-tertiary-container">{row.anggaran}</span>
                </td>
                <td className="py-space-sm px-space-md text-center">
                  <span className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded font-label-sm font-bold ${row.bukti.bg}`}>
                    <span className="material-symbols-outlined text-[13px]">{row.bukti.icon}</span>
                    {row.bukti.text}
                  </span>
                </td>
                <td className="py-space-sm px-space-md text-center">
                  <span className={`px-space-xs py-0.5 rounded-full font-label-sm font-bold ${row.status.bg}`}>
                    {row.status.label}
                  </span>
                </td>
                <td className="py-space-sm px-space-md text-right">
                  <div className="inline-flex items-center gap-space-2xs">
                    {row.actions.map((action, i) => (
                      <button
                        key={i}
                        className={`p-1 rounded hover:bg-surface-container ${action.color} ${action.bg || ''}`}
                        title={action.title}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination & Status Bar Footer */}
      <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-low/30">
        <span className="font-label-sm text-secondary">Menampilkan 5 dari 20 Unit Kerja Terdaftar</span>
        <div className="flex items-center gap-space-2xs">
          <button className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high" disabled>Sebelumnya</button>
          <button className="px-space-sm py-1 rounded bg-primary text-on-primary font-label-sm font-bold">1</button>
          <button className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high">2</button>
          <button className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high">3</button>
          <button className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm font-semibold hover:bg-surface-container-high">Selanjutnya</button>
        </div>
      </div>
    </div>
  )
}

export default DataTable