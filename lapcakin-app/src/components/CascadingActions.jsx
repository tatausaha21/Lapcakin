const actions = [
  {
    icon: 'share',
    iconColor: 'text-primary-fixed',
    label: 'Sinkronkan Cascading IKU',
    badge: null,
    showArrow: true,
  },
  {
    icon: 'published_with_changes',
    iconColor: 'text-primary-fixed',
    label: 'Kunci Pelaporan TW I',
    badge: { label: 'Siaga', color: 'bg-error text-on-error' },
    showArrow: false,
  },
]

function CascadingActions() {
  return (
    <div className="bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-2xl p-space-md shadow-sm relative overflow-hidden">
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-on-primary/10 rounded-full blur-xl pointer-events-none"></div>
      <div className="flex items-center gap-space-xs mb-space-2xs">
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">account_tree</span>
        <span className="font-label-sm text-primary-fixed uppercase tracking-wider font-bold">Manajemen Cascading</span>
      </div>
      <h4 className="font-headline-md text-headline-md font-bold mb-space-xs">Distribusi Kinerja Berjenjang</h4>
      <p className="font-body-sm text-on-primary/80 mb-space-md">Pastikan seluruh target indikator utama telah terdistribusi ke seksi terkait sebelum penutupan rekonsiliasi Triwulan I.</p>
      <div className="space-y-space-xs">
        {actions.map((action, index) => (
          <a key={index} href="#" className="flex items-center justify-between p-space-sm rounded-xl bg-on-primary/10 hover:bg-on-primary/20 transition-colors">
            <div className="flex items-center gap-space-xs">
              <span className={`material-symbols-outlined text-[18px] ${action.iconColor}`}>{action.icon}</span>
              <span className="font-body-sm text-body-sm font-bold">{action.label}</span>
            </div>
            {action.badge ? (
              <span className={`px-space-xs py-0.5 rounded font-label-sm font-bold ${action.badge.color}`}>
                {action.badge.label}
              </span>
            ) : action.showArrow ? (
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  )
}

export default CascadingActions