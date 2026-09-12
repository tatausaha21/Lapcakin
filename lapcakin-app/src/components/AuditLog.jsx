function AuditLog() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
      <div className="flex items-center gap-space-sm">
        <div className="p-space-xs rounded-xl bg-surface-container text-secondary">
          <span className="material-symbols-outlined text-[24px]">history</span>
        </div>
        <div>
          <h5 className="font-title-sm text-title-sm font-bold text-on-surface">Jejak Audit & Sinkronisasi Realtime</h5>
          <p className="font-body-sm text-secondary">Data rekapitulasi terakhir disinkronkan dari Biro Keuangan & BKN pada 27 Maret 2026 pukul 09:41 WIB</p>
        </div>
      </div>
      <div className="flex items-center gap-space-xs">
        <span className="font-label-sm text-secondary">ID Verifikasi Digital:</span>
        <code className="px-space-xs py-1 rounded bg-surface-container text-on-surface font-label-sm font-mono font-bold">KMN-SAKIP-2026-TW1-998F</code>
      </div>
    </div>
  )
}

export default AuditLog