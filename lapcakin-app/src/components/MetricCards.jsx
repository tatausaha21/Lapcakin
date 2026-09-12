function MetricCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
      {/* Card 1: Nilai Capaian Utama */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
        <div className="flex items-start justify-between mb-space-xs">
          <div>
            <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Indeks Kinerja Utama</span>
            <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Capaian Organisasi</h3>
          </div>
          <div className="p-space-2xs rounded-lg bg-primary-fixed text-on-primary-fixed">
            <span className="material-symbols-outlined text-[20px]">insights</span>
          </div>
        </div>
        <div className="flex items-baseline gap-space-xs my-space-xs">
          <span className="font-display-lg text-display-lg text-primary font-extrabold tracking-tight">88.45%</span>
          <span className="px-space-xs py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-sm font-bold">PREDIKAT BAIK</span>
        </div>
        <div className="space-y-space-2xs pt-space-2xs">
          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: '88.45%' }}></div>
          </div>
          <div className="flex justify-between font-label-sm text-secondary">
            <span>Target Perjanjian: 85.00%</span>
            <span className="text-primary font-bold">+3.45% Surplus</span>
          </div>
        </div>
      </div>

      {/* Card 2: Serapan Anggaran DIPA */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-tertiary-container"></div>
        <div className="flex items-start justify-between mb-space-xs">
          <div>
            <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Keuangan Negara</span>
            <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Realisasi DIPA Satker</h3>
          </div>
          <div className="p-space-2xs rounded-lg bg-tertiary-fixed text-on-tertiary-fixed">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
        </div>
        <div className="flex items-baseline gap-space-xs my-space-xs">
          <span className="font-data-metric text-data-metric text-on-surface font-extrabold tracking-tight">83.33%</span>
          <span className="font-label-md text-secondary">/ Terpenuhi</span>
        </div>
        <div className="space-y-space-2xs pt-space-2xs">
          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
            <div className="bg-tertiary-container h-full rounded-full transition-all duration-700" style={{ width: '83.33%' }}></div>
          </div>
          <div className="flex justify-between font-label-sm text-secondary">
            <span className="font-bold text-on-surface">Rp 4.25 M</span>
            <span>Pagu Rp 5.10 M</span>
          </div>
        </div>
      </div>

      {/* Card 3: Kepatuhan Pelaporan Seksi */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-secondary"></div>
        <div className="flex items-start justify-between mb-space-xs">
          <div>
            <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Disiplin Administrasi</span>
            <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Kepatuhan Seksi</h3>
          </div>
          <div className="p-space-2xs rounded-lg bg-secondary-fixed text-on-secondary-fixed">
            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
          </div>
        </div>
        <div className="flex items-baseline gap-space-xs my-space-xs">
          <span className="font-data-metric text-data-metric text-on-surface font-extrabold tracking-tight">
            18 <span className="text-title-sm text-secondary font-semibold">/ 20</span>
          </span>
          <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-label-sm font-bold">90.0% SUBMIT</span>
        </div>
        <div className="flex items-center gap-space-xs pt-space-2xs">
          <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-ping"></span>
          <span className="font-label-sm text-secondary">2 Seksi dalam proses telaah Kasubag</span>
        </div>
      </div>

      {/* Card 4: Bukti Dukung & Verifikasi */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary-container"></div>
        <div className="flex items-start justify-between mb-space-xs">
          <div>
            <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">Eviden Lapangan</span>
            <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Bukti Dukung IKU</h3>
          </div>
          <div className="p-space-2xs rounded-lg bg-surface-container text-primary">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
        </div>
        <div className="flex items-baseline gap-space-sm my-space-xs">
          <div className="flex flex-col">
            <span className="font-data-metric text-data-metric text-primary font-extrabold">142</span>
            <span className="font-label-sm text-secondary">Valid & Sah</span>
          </div>
          <div className="w-px h-8 bg-outline-variant/30"></div>
          <div className="flex flex-col">
            <span className="font-data-metric text-data-metric text-error font-extrabold">8</span>
            <span className="font-label-sm text-error font-medium">Perlu Revisi</span>
          </div>
        </div>
        <div className="pt-space-2xs flex justify-between font-label-sm text-secondary">
          <span>Total 150 Berkas Terkumpul</span>
          <span className="text-primary font-semibold">94.6% Akurasi</span>
        </div>
      </div>
    </div>
  )
}

export default MetricCards