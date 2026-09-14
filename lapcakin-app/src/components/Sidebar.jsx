const adminNavigationItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: '#' },
  { id: 'unit-kerja', icon: 'apartment', label: 'Master Unit Kerja', href: '#' },
  { id: 'master-user', icon: 'group', label: 'Master User', href: '#' },
  { id: 'periode-kinerja', icon: 'calendar_month', label: 'Periode Kinerja', href: '#' },
  { id: 'perkin', icon: 'history_edu', label: 'Master Perjanjian Kinerja (PERKIN)', href: '#' },
  { id: 'cascading', icon: 'account_tree', label: 'Cascading Kinerja', href: '#' },
  { id: 'monitoring', icon: 'monitoring', label: 'Monitoring Kinerja', href: '#' },
  { id: 'laporan-kinerja', icon: 'assessment', label: 'Laporan Kinerja Organisasi', href: '#' },
  { id: 'bukti-dukung', icon: 'folder_shared', label: 'Bukti Dukung', href: '#' },
]

const seksiNavigationItems = [
  { id: 'dashboard-seksi', icon: 'dashboard', label: 'Dashboard Seksi', href: '#' },
  { id: 'rencana-aksi-kinerja', icon: 'checklist', label: 'Rencana Aksi Kinerja', href: '#' },
  { id: 'input-realisasi-kinerja', icon: 'edit_note', label: 'Input Realisasi Kinerja', href: '#' },
  { id: 'laporan-kinerja-seksi', icon: 'picture_as_pdf', label: 'Laporan Kinerja Seksi', href: '#' },
  { id: 'bukti-dukung-seksi', icon: 'cloud_upload', label: 'Bukti Dukung Seksi', href: '#' },
]

const bottomItems = [
  { icon: 'public', label: 'Portal Publik', href: '#', path: 'portal-publik' },
  { icon: 'logout', label: 'Keluar', href: '#', path: 'login', danger: true },
]

function Sidebar({ activePage, onNavigate, currentUser, onLogout }) {
  const isKepalaSeksi =
    currentUser?.peran === 'Kepala Satker' ||
    (currentUser?.peran ?? '').toLowerCase().includes('kepala seksi') ||
    seksiNavigationItems.some((item) => item.id === activePage)
  const navigationItems = isKepalaSeksi ? seksiNavigationItems : adminNavigationItems
  const roleGroupLabel = isKepalaSeksi ? 'Kepala Seksi' : 'Admin Organisasi'
  const defaultUnit = isKepalaSeksi ? 'Seksi Pendidikan Madrasah' : 'Biro Ortala Kemenag RI'
  return (
    <aside className="max-lg:relative max-lg:w-full max-lg:h-auto lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-[280px] bg-primary text-on-primary z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="flex flex-col h-auto lg:h-full">
        <div className="p-space-lg flex items-center gap-space-sm bg-primary">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-primary-fixed shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
            <span className="material-symbols-outlined text-[24px]">account_balance</span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-title-sm text-title-sm text-on-primary tracking-tight font-bold truncate">LAPCAKIN</span>
            <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-wider font-semibold truncate">LAPORAN CAPAIAN KINERJA</span>
          </div>
        </div>
        <div className="px-space-md py-space-xs">
          <div className="p-space-sm rounded-xl bg-primary-container/60 flex flex-col gap-space-2xs">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase font-semibold tracking-wider">Peran Aktif</span>
              <span className="flex h-2 w-2 rounded-full bg-primary-fixed animate-pulse"></span>
            </div>
            <span className="font-title-sm text-title-sm text-on-primary font-bold truncate">{currentUser?.peran === 'Kepala Satker' ? 'Kepala Seksi' : (currentUser?.peran ?? 'Admin Organisasi')}</span>
            <span className="font-body-sm text-body-sm text-on-primary/70 truncate">{currentUser?.unitKerjaNama ?? defaultUnit}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-space-md py-space-xs space-y-space-md">
          <div className="space-y-space-2xs pt-space-xs">
            <div className="px-space-sm py-space-2xs font-label-sm text-label-sm text-primary-fixed-dim uppercase tracking-wider font-bold">{roleGroupLabel}</div>
          <nav className="space-y-1 py-space-xs">
            {navigationItems.map((item) => {
              const isActive = item.id === activePage
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigate(item.id)
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                      : 'text-on-primary/80 hover:bg-primary-container/40 hover:text-on-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-body-sm text-body-sm font-medium truncate">{item.label}</span>
                </a>
              )
            })}
          </nav>
          </div>
        </div>
        <div className="p-space-md space-y-space-xs bg-primary">
          {bottomItems.map((item, index) => {
            if (item.danger) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={onLogout}
                  title={currentUser ? `Keluar (${currentUser.username})` : 'Keluar'}
                  className="w-full flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg transition-colors text-on-primary/80 hover:bg-error-container hover:text-on-error-container"
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-body-sm text-body-sm font-medium">{item.label}</span>
                </button>
              )
            }
            return (
              <a
                key={index}
                href={item.href}
                data-path={item.path}
                className="flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg transition-colors text-on-primary/80 hover:bg-primary-container/40 hover:text-on-primary"
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="font-body-sm text-body-sm font-medium">{item.label}</span>
              </a>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar