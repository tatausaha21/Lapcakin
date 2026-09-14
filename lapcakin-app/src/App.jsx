import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import PublicPortal from './components/PublicPortal'
import { supabase } from './lib/supabase'
import MetricCards from './components/MetricCards'
import DataTable from './components/DataTable'
import DocumentPanel from './components/DocumentPanel'
import CascadingActions from './components/CascadingActions'
import AuditLog from './components/AuditLog'
import UnitKerjaForm from './components/UnitKerjaForm'
import MasterUserForm from './components/MasterUserForm'
import PeriodeKinerjaForm from './components/PeriodeKinerjaForm'
import PerkinForm from './components/PerkinForm'
import CascadingForm from './components/CascadingForm'
import KepalaSeksiPage from './components/KepalaSeksiPage'
import RencanaAksiForm from './components/RencanaAksiForm'
import RealisasiKinerjaForm from './components/RealisasiKinerjaForm'
import LaporanKinerjaSeksi from './components/LaporanKinerjaSeksi'
import BuktiDukungSeksi from './components/BuktiDukungSeksi'
import DashboardSeksi from './components/DashboardSeksi'
import MonitoringKinerja from './components/MonitoringKinerja'

const seksiPages = [
  'dashboard-seksi',
  'rencana-aksi-kinerja',
  'input-realisasi-kinerja',
  'laporan-kinerja-seksi',
  'bukti-dukung-seksi',
]

function getDemoSession() {
  try {
    const raw = localStorage.getItem('sicakin_session')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Hanya sesi demo yang disimpan di localStorage (Supabase Auth
    // mengelola sesinya sendiri). Abaikan jika bukan demo.
    return parsed?.user?.isDemo ? parsed.user : null
  } catch {
    return null
  }
}

function toProfile(row, authUserId) {
  return {
    id: authUserId ?? row.id,
    namaLengkap: row.nama_lengkap ?? '',
    nip: row.nip ?? '-',
    username: row.username ?? '',
    email: row.email ?? '',
    jabatan: row.jabatan ?? '',
    peran: row.peran ?? '',
    unitKerjaNama: row.unit_kerja_nama ?? '',
  }
}

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Pulihkan sesi: Supabase Auth dulu, fallback ke sesi demo lokal.
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const authUser = data?.session?.user
        if (authUser) {
          let profile = null
          const byId = await supabase
            .from('master_users')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .maybeSingle()
          profile = byId.data ?? null
          // Fallback: profil sudah ada berdasarkan email tapi auth_user_id
          // belum tertaut (mis. user dibuat manual sebelum trigger dipasang).
          // Tautkan otomatis agar login tetap jalan.
          if (!profile && authUser.email) {
            const byEmail = await supabase
              .from('master_users')
              .select('*')
              .ilike('email', authUser.email)
              .maybeSingle()
            if (byEmail.data) {
              await supabase
                .from('master_users')
                .update({ auth_user_id: authUser.id })
                .eq('id', byEmail.data.id)
              profile = { ...byEmail.data, auth_user_id: authUser.id }
            }
          }
          if (!cancelled) {
            if (profile && profile.status === 'Aktif') {
              setCurrentUser(toProfile(profile, authUser.id))
            } else {
              await supabase.auth.signOut()
              setCurrentUser(getDemoSession())
            }
            setAuthChecked(true)
            return
          }
        } else if (!cancelled) {
          setCurrentUser(getDemoSession())
        }
      } catch {
        if (!cancelled) setCurrentUser(getDemoSession())
      }
      if (!cancelled) setAuthChecked(true)
    }
    restore()
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT' || !session?.user) {
        setCurrentUser((current) => (current?.isDemo ? current : null))
        return
      }
    })
    return () => {
      cancelled = true
      listener?.subscription?.unsubscribe()
    }
  }, [])

  // Default halaman mengikuti peran: Kepala Satker langsung ke Input Realisasi Seksi.
  useEffect(() => {
    if (currentUser?.peran === 'Kepala Satker' && activePage === 'dashboard') {
      setActivePage('input-realisasi-kinerja')
    }
  }, [currentUser, activePage])

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sicakin_session')
      await supabase.auth.signOut()
    } catch {
      // abaikan
    }
    setCurrentUser(null)
    setActivePage('dashboard')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#004D40]">
        <p className="text-sm font-semibold text-emerald-100">Memuat sesi…</p>
      </div>
    )
  }

  if (!currentUser) {
    return <PublicPortal onLogin={setCurrentUser} />
  }

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface min-h-screen antialiased">
      <Sidebar activePage={activePage} onNavigate={setActivePage} currentUser={currentUser} onLogout={handleLogout} />
      <div className="pl-0 lg:pl-[280px]">
        <Header currentUser={currentUser} />
        <main className="relative pt-0 lg:pt-16 min-h-screen bg-surface w-full px-container-padding-mobile lg:px-container-padding-desktop py-space-xl">
          <div className="mx-auto w-full max-w-[1720px]">
            {activePage === 'unit-kerja' ? (
              <UnitKerjaForm />
            ) : activePage === 'master-user' ? (
              <MasterUserForm />
            ) : activePage === 'periode-kinerja' ? (
              <PeriodeKinerjaForm />
            ) : activePage === 'perkin' ? (
              <PerkinForm />
            ) : activePage === 'cascading' ? (
              <CascadingForm />
            ) : activePage === 'dashboard-seksi' ? (
              <DashboardSeksi currentUser={currentUser} onNavigate={setActivePage} />
            ) : activePage === 'rencana-aksi-kinerja' ? (
              <RencanaAksiForm currentUser={currentUser} />
            ) : activePage === 'input-realisasi-kinerja' ? (
              <RealisasiKinerjaForm currentUser={currentUser} />
            ) : activePage === 'laporan-kinerja-seksi' ? (
              <LaporanKinerjaSeksi currentUser={currentUser} />
            ) : activePage === 'bukti-dukung-seksi' ? (
              <BuktiDukungSeksi currentUser={currentUser} />
            ) : activePage === 'monitoring' ? (
              <MonitoringKinerja />
            ) : seksiPages.includes(activePage) ? (
              <KepalaSeksiPage activePage={activePage} currentUser={currentUser} />
            ) : (
              <div className="flex flex-col w-full">
            {/* Breadcrumb & Page Command Hub */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center gap-space-xs text-secondary font-label-md">
                  <span className="hover:text-primary transition-colors cursor-pointer">SICAKIN Kemenag</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="hover:text-primary transition-colors cursor-pointer">Admin Organisasi</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-primary font-bold">Laporan Kinerja Organisasi</span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
                    Evaluasi & Akuntabilitas Kinerja Satker
                  </h1>
                  <span className="px-space-xs py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm uppercase font-bold tracking-wider">
                    T.A 2026
                  </span>
                </div>
              </div>

              {/* Quick Export Bar */}
              <div className="flex flex-wrap items-center gap-space-xs bg-surface-container-lowest p-space-2xs rounded-xl shadow-sm">
                <button className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface font-body-sm text-body-sm font-semibold transition-colors" onClick={() => window.print()}>
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Cetak Laporan</span>
                </button>
                <div className="w-px h-5 bg-outline-variant/30"></div>
                <button className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg bg-surface-container-low text-error hover:bg-error-container hover:text-on-error-container font-body-sm text-body-sm font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  <span>Unduh PDF</span>
                </button>
                <button className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg bg-surface-container-low text-primary hover:bg-primary-fixed hover:text-on-primary-fixed font-body-sm text-body-sm font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                  <span>Unduh Excel</span>
                </button>
                <div className="w-px h-5 bg-outline-variant/30"></div>
                <button className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm font-bold shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[18px]">fact_check</span>
                  <span>Approval Massal</span>
                </button>
              </div>
            </div>

            {/* Global Filter Controls Surface */}
            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm mb-space-lg">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">
                <div className="md:col-span-3">
                  <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Tahun Anggaran</label>
                  <div className="relative">
                    <select className="w-full h-[38px] pl-space-sm pr-space-lg rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:bg-surface-container">
                      <option value="2026">2026 (Tahun Berjalan Aktif)</option>
                      <option value="2025">2025 (Arsip Audited)</option>
                      <option value="2024">2024 (Arsip)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-space-xs top-2 text-secondary pointer-events-none text-[18px]">expand_more</span>
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Periode Evaluasi</label>
                  <div className="relative">
                    <select className="w-full h-[38px] pl-space-sm pr-space-lg rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:bg-surface-container">
                      <option value="TW1">Triwulan I (Januari - Maret)</option>
                      <option value="TW2">Triwulan II (April - Juni)</option>
                      <option value="TW3">Triwulan III (Juli - September)</option>
                      <option value="TW4">Triwulan IV (Oktober - Desember)</option>
                      <option value="TA">Konsolidasi Tahunan (Penuh)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-space-xs top-2 text-secondary pointer-events-none text-[18px]">calendar_month</span>
                  </div>
                </div>
                <div className="md:col-span-4">
                  <label className="block font-label-sm text-secondary uppercase font-bold mb-space-2xs">Unit Kerja / Satuan Kerja</label>
                  <div className="relative">
                    <select className="w-full h-[38px] pl-space-sm pr-space-lg rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm appearance-none focus:outline-none focus:bg-surface-container">
                      <option value="all">Semua Unit & Seksi Lingkup Kemenag</option>
                      <option value="madrasah">Seksi Pendidikan Madrasah (Pendis)</option>
                      <option value="bimas">Seksi Bimbingan Masyarakat Islam</option>
                      <option value="phu">Seksi Penyelenggaraan Haji & Umrah</option>
                      <option value="pakis">Seksi Pendidikan Agama & Keagamaan Islam</option>
                      <option value="tu">Subbagian Tata Usaha</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-space-xs top-2 text-secondary pointer-events-none text-[18px]">filter_alt</span>
                  </div>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button className="w-full h-[38px] rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm font-bold flex items-center justify-center gap-space-2xs hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    <span>Terapkan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Executive Summary Metric Cards */}
            <MetricCards />

            {/* Split Grid: Comprehensive Table + Side Control Panels */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-xl">
              {/* Main Table Container (8 Cols) */}
              <div className="xl:col-span-8">
                <DataTable />
              </div>

              {/* Right Side: Matriks Bukti Dukung Induk + Quick Action Cascading (4 Cols) */}
              <div className="xl:col-span-4 flex flex-col gap-space-lg">
                <DocumentPanel />
                <CascadingActions />
              </div>
            </div>

            {/* Operational Audit Trace / Log Visual Minimalist */}
            <AuditLog />
          </div>
        )}
      </div>
    </main>
  </div>
</div>
  )
}

export default App