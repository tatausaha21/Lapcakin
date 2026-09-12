const documents = [
  {
    icon: 'verified',
    iconBg: 'bg-primary-fixed text-on-primary-fixed',
    title: 'SK Perjanjian Kinerja 2026',
    subtitle: 'Nomor: B-102/Kk.13/OT.01/01/2026',
  },
  {
    icon: 'menu_book',
    iconBg: 'bg-primary-fixed text-on-primary-fixed',
    title: 'Renstra Kemenag 2025-2029',
    subtitle: 'Telah Disahkan Sekjen RI',
  },
  {
    icon: 'analytics',
    iconBg: 'bg-primary-fixed text-on-primary-fixed',
    title: 'LAKIP / LKjIP Satker 2025',
    subtitle: 'Audited: Nilai SAKIP "A" (84.12)',
  },
  {
    icon: 'request_quote',
    iconBg: 'bg-primary-fixed text-on-primary-fixed',
    title: 'DIPA RKA-K/L Revisi I',
    subtitle: 'SP-DIPA-025.04.2.418291/2026',
  },
]

function DocumentPanel() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
      <div className="flex items-center justify-between mb-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">folder_special</span>
          <h3 className="font-title-sm text-title-sm text-on-surface font-bold">Dokumen Kinerja Induk</h3>
        </div>
        <span className="font-label-sm text-primary font-bold">4 Terverifikasi</span>
      </div>
      <p className="font-body-sm text-secondary mb-space-md">Kelengkapan regulasi payung hukum dan mandat kinerja kementerian</p>
      <div className="space-y-space-xs">
        {documents.map((doc, index) => (
          <div key={index} className="p-space-sm rounded-xl bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className={`p-2 rounded-lg ${doc.iconBg}`}>
                <span className="material-symbols-outlined text-[18px]">{doc.icon}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-sm text-[13px] font-bold text-on-surface">{doc.title}</span>
                <span className="font-label-sm text-secondary">{doc.subtitle}</span>
              </div>
            </div>
            <button className="p-1 rounded text-primary hover:bg-surface-container" title="Lihat Dokumen" type="button">
              <span className="material-symbols-outlined text-[20px]">open_in_new</span>
            </button>
          </div>
        ))}
      </div>
      <button className="mt-space-md w-full py-space-xs px-space-sm rounded-lg bg-surface-container text-on-surface font-title-sm text-[13px] font-bold hover:bg-surface-container-high transition-colors flex items-center justify-center gap-space-xs" type="button">
        <span className="material-symbols-outlined text-[18px]">upload_file</span>
        <span>Perbarui Berkas Induk</span>
      </button>
    </div>
  )
}

export default DocumentPanel