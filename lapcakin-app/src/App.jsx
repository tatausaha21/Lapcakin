import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import PublicPortal from './components/PublicPortal'
import { supabase } from './lib/supabase'
import DashboardAdmin from './components/DashboardAdmin'
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
import LaporanKinerjaOrganisasi from './components/LaporanKinerjaOrganisasi'
import BuktiDukungOrganisasi from './components/BuktiDukungOrganisasi'
import GaleriPortalModal from './components/GaleriPortalModal'

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
  const [galeriOpen, setGaleriOpen] = useState(false)

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
      <Sidebar activePage={activePage} onNavigate={setActivePage} currentUser={currentUser} onLogout={handleLogout} onPortalGallery={() => setGaleriOpen(true)} />
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
            ) : activePage === 'laporan-kinerja' ? (
              <LaporanKinerjaOrganisasi />
            ) : activePage === 'bukti-dukung' ? (
              <BuktiDukungOrganisasi />
            ) : seksiPages.includes(activePage) ? (
              <KepalaSeksiPage activePage={activePage} currentUser={currentUser} />
            ) : (
              <DashboardAdmin onNavigate={setActivePage} />
            )}
      </div>
    </main>
  </div>
  {galeriOpen && (
    <GaleriPortalModal currentUser={currentUser} onClose={() => setGaleriOpen(false)} />
  )}
</div>
  )
}

export default App