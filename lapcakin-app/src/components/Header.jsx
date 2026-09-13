function Header({ currentUser }) {
  return (
    <header className="max-lg:relative max-lg:left-auto max-lg:right-auto max-lg:h-auto lg:fixed lg:top-0 lg:left-[280px] lg:right-0 lg:h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex flex-wrap items-center justify-between gap-2 px-container-padding-mobile lg:px-container-padding-desktop py-3 lg:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-space-md">
        <div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-secondary-container text-on-secondary-fixed">
          <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
          <span className="font-label-md text-label-md font-semibold tracking-wide">Tahun Anggaran 2026 - Triwulan I</span>
        </div>
        <div className="hidden xl:inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container text-secondary">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span className="font-label-sm text-label-sm font-medium">Status: Input Realisasi Dibuka</span>
        </div>
      </div>
      <div className="flex items-center gap-space-md">
        <div className="flex items-center gap-space-xs">
          <button className="p-space-xs rounded-lg text-secondary hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Pemberitahuan Kemenag" type="button">
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-error ring-2 ring-surface"></span>
            </div>
          </button>
          <button className="p-space-xs rounded-lg text-secondary hover:bg-surface-container-high hover:text-on-surface transition-colors" title="Pusat Bantuan Simpeg / Ortala" type="button">
            <span className="material-symbols-outlined text-[22px]">help_outline</span>
          </button>
        </div>
        <div className="h-6 w-[1px] bg-outline-variant/40"></div>
        <div className="flex items-center gap-space-sm">
          <div className="text-right hidden sm:block">
            <div className="font-label-md text-label-md font-bold text-on-surface">{currentUser?.namaLengkap ?? 'Drs. H. Ahmad Fauzi, M.Si'}</div>
            <div className="font-label-sm text-label-sm text-secondary">NIP. {currentUser?.nip ?? '197805122002121003'}{currentUser?.isDemo ? ' · Demo' : ''}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header