import { useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import kemenagLogo from '../assets/kemenag.svg'

// Opsi peran persis seperti modal pada mockup portal publik.
const portalRoles = [
  { label: '------------', allowed: ['Operator Unit', 'Viewer / Auditor'] },
  { label: 'Kepala Seksi / Pejabat Penilai', allowed: ['Kepala Satker'] },
  { label: 'Admin Organisasi / Perencana', allowed: ['Admin Organisasi'] },
]

// Akun demo untuk preview tampilan tanpa Supabase Auth.
const demoAccounts = [
  { label: 'Admin', username: 'admin.sicakin', peran: 'Admin Organisasi', nama: 'Administrator SICAKIN' },
  { label: 'Kepala Seksi', username: 'ahmad.baswedan', peran: 'Kepala Satker', nama: 'Dr. Ahmad Baswedan, M.Pd.' },
  { label: 'Pegawai', username: 'rizki.pratama', peran: 'Operator Unit', nama: 'Rizki Pratama, S.E.' },
]

const toProfile = (row) => ({
  id: row.auth_user_id ?? row.id,
  namaLengkap: row.nama_lengkap ?? '',
  nip: row.nip ?? '-',
  username: row.username ?? '',
  email: row.email ?? '',
  jabatan: row.jabatan ?? '',
  peran: row.peran ?? '',
  unitKerjaNama: row.unit_kerja_nama ?? '',
})

function LoginPage({ onLogin }) {
  const [portalRole, setPortalRole] = useState(portalRoles[0].label)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const identifierRef = useRef(null)

  const validate = () => {
    const next = {}
    if (!identifier.trim()) next.identifier = 'NIP / Username / Email wajib diisi.'
    if (!password) next.password = 'Kata sandi wajib diisi.'
    else if (password.length < 6) next.password = 'Kata sandi minimal 6 karakter.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const fetchProfile = async (authUserId, email) => {
    // 1) Coba berdasarkan auth_user_id dulu (jalur utama).
    if (authUserId) {
      const { data, error: profileError } = await supabase
        .from('master_users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()
      if (profileError) throw profileError
      if (data) return data
    }
    // 2) Fallback berdasarkan email + auto-link auth_user_id bila cocok.
    //    Menangani kasus user Auth dibuat manual sebelum trigger
    //    handle_new_user() dipasang / sebelum profil ditautkan.
    if (email) {
      const { data, error: emailError } = await supabase
        .from('master_users')
        .select('*')
        .ilike('email', email)
        .maybeSingle()
      if (emailError) throw emailError
      if (data && authUserId && !data.auth_user_id) {
        await supabase.from('master_users').update({ auth_user_id: authUserId }).eq('id', data.id)
        return { ...data, auth_user_id: authUserId }
      }
      return data
    }
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    if (!validate()) return
    if (!isSupabaseConfigured) {
      setError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env, atau gunakan masuk demo di bawah.')
      return
    }
    setLoading(true)
    try {
      const key = identifier.trim()
      // 1) Petakan identifier -> email Auth (mendukung NIP / username / email).
      let email = key.includes('@') ? key : null
      if (!email) {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc('resolve_login_email', { p_identifier: key })
        if (rpcError) throw rpcError
        email = resolvedEmail
      }
      if (!email) {
        setError('Akun tidak ditemukan atau berstatus tidak aktif. Periksa kembali NIP / Username / Email Anda.')
        return
      }

      // 2) Verifikasi password via Supabase Auth.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Kata sandi salah atau akun belum terdaftar di Authentication. Hubungi Admin Organisasi.')
        } else {
          setError(`Gagal masuk: ${signInError.message}`)
        }
        return
      }

      // 3) Ambil profil master_users yang tertaut.
      const profile = await fetchProfile(signInData.user?.id, email)
      if (!profile) {
        await supabase.auth.signOut()
        setError('Login berhasil tetapi profil pegawai belum terdaftar di Master User. Hubungi Admin Organisasi.')
        return
      }
      if (profile.status !== 'Aktif') {
        await supabase.auth.signOut()
        setError(`Akun berstatus "${profile.status}" dan tidak dapat masuk. Hubungi Admin Organisasi.`)
        return
      }
      const allowed = portalRoles.find((r) => r.label === portalRole)?.allowed ?? []
      if (!allowed.includes(profile.peran)) {
        await supabase.auth.signOut()
        setError(`Akun ini terdaftar sebagai "${profile.peran}". Silakan pilih peran yang sesuai.`)
        return
      }

      // 4) Catat waktu login (best-effort).
      supabase.rpc('record_login', { p_auth_user_id: signInData.user.id }).then(() => {})

      onLogin(toProfile(profile))
    } catch (err) {
      setError(`Gagal masuk: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')
    const key = identifier.trim()
    if (!key.includes('@')) {
      setError('Untuk reset kata sandi, isi kolom dengan alamat Email akun, lalu klik "Lupa sandi?" lagi.')
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(key)
      if (resetError) throw resetError
      setInfo('Tautan reset kata sandi telah dikirim ke email Anda. Periksa kotak masuk / spam.')
    } catch (err) {
      setError(`Gagal mengirim reset: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = (demo) => {
    setError('')
    setInfo('')
    try {
      localStorage.setItem(
        'sicakin_session',
        JSON.stringify({ user: { ...demo, namaLengkap: demo.nama, isDemo: true }, loginAt: new Date().toISOString() }),
      )
    } catch {
      // abaikan
    }
    onLogin({
      id: `demo-${demo.username}`,
      namaLengkap: demo.nama,
      nip: demo.username === 'admin.sicakin' ? '196701011990031001' : '-',
      username: demo.username,
      email: `${demo.username}@kemenag.go.id`,
      jabatan: demo.peran,
      peran: demo.peran,
      unitKerjaNama: 'Subbagian Tata Usaha',
      isDemo: true,
    })
  }

  const focusForm = (roleLabel) => {
    if (roleLabel) setPortalRole(roleLabel)
    requestAnimationFrame(() => identifierRef.current?.focus())
  }

  return (
    <div
      className="min-h-screen text-slate-800 antialiased selection:bg-emerald-500 selection:text-white pb-16"
      style={{
        fontFamily: "Inter, system-ui, -apple-system, 'BlinkMacSystemFont', 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#004D40',
        backgroundImage:
          'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(135deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%), linear-gradient(225deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%), linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%), linear-gradient(315deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%)',
        backgroundPosition: '0 0, 24px 0, 24px 0, 0 0, 0 0',
        backgroundSize: '48px 48px',
      }}
    >
      {/* TopNavigationBar — sama seperti portal publik */}
      <header className="w-full px-4 sm:px-8 lg:px-12 pt-6 pb-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-white/20 flex items-center justify-center shadow-inner shrink-0 p-1">
              <img src={kemenagLogo} alt="Logo Kementerian Agama" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-emerald-200 uppercase block">Portal Kinerja Terbuka</span>
              <span className="text-sm font-bold text-white tracking-wide">Sistem Pengukuran Kinerja Kemenag 2026</span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => focusForm('------------')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs md:text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md transition-all duration-200 shadow-sm hover:shadow active:scale-95"
            >
              <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="2" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" strokeWidth="2" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" strokeWidth="2" />
              </svg>
              <span>Masuk Untuk Mengisi Laporan</span>
            </button>
            <button
              type="button"
              onClick={() => focusForm()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs md:text-sm font-bold text-emerald-900 bg-white hover:bg-slate-100 shadow-lg shadow-black/15 transition-all duration-200 active:scale-95 border border-white"
            >
              <svg className="w-4 h-4 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
              <span>Masuk</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        {/* Hero — sama seperti portal publik */}
        <section className="mb-7 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#014438]/80 border border-emerald-500/30 text-emerald-100 text-xs font-medium backdrop-blur shadow-sm mb-3">
            <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
            <span>Rekapitulasi Capaian Kinerja Terbuka — Tahun 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Transparansi &amp; Akuntabilitas Kinerja Berjenjang
          </h1>
          <p className="mt-2 text-emerald-100/90 text-sm sm:text-base max-w-3xl leading-relaxed font-normal mx-auto sm:mx-0">
            Perhitungan kinerja pegawai terakumulasi otomatis ke tingkat Seksi/Satker hingga Capaian Kinerja Organisasi, sesuai KMA Nomor 1807 Tahun 2025.
          </p>
        </section>

        {/* Kartu login — mengadopsi gaya modal login portal */}
        <section className="flex justify-center">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-[#004D40] p-6 text-white">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-700/60 text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-2 border border-emerald-500/30">
                Akses Terbatas
              </span>
              <h3 className="text-xl font-bold">Masuk ke Sistem Kinerja</h3>
              <p className="text-xs text-emerald-200/90 mt-1">Gunakan akun NIP &amp; sandi resmi Kementerian Agama</p>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700" role="alert">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <p className="text-xs font-medium leading-relaxed">{error}</p>
                </div>
              )}
              {info && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800" role="status">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <p className="text-xs font-medium leading-relaxed">{info}</p>
                </div>
              )}

              <div>
                <label htmlFor="login-peran" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Peran / Role Pengguna
                </label>
                <select
                  id="login-peran"
                  value={portalRole}
                  onChange={(e) => setPortalRole(e.target.value)}
                  className="w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5"
                >
                  {portalRoles.map((role) => (
                    <option key={role.label} value={role.label}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="login-identifier" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  id="login-identifier"
                  ref={identifierRef}
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setFieldErrors((c) => ({ ...c, identifier: '' }))
                  }}
                  placeholder="19XXXXXXXXXXXXXX / username / email"
                  className={`w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5 ${fieldErrors.identifier ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : ''}`}
                />
                {fieldErrors.identifier && <p className="mt-1 text-xs text-rose-600">{fieldErrors.identifier}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Kata Sandi
                  </label>
                  <button type="button" onClick={handleForgotPassword} className="text-xs text-emerald-700 hover:underline">
                    Lupa sandi?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setFieldErrors((c) => ({ ...c, password: '' }))
                    }}
                    placeholder="••••••••"
                    className={`w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5 pr-11 ${fieldErrors.password ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.948 9.948 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      ) : (
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      )}
                    </svg>
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-[#004D40] hover:bg-[#00382E] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? 'Memverifikasi otentikasi…' : 'Masuk ke Dashboard'}
              </button>

              <div className="pt-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">atau masuk demo</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {demoAccounts.map((demo) => (
                    <button
                      key={demo.username}
                      type="button"
                      onClick={() => handleDemoLogin(demo)}
                      className="h-10 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-emerald-800 transition-colors"
                    >
                      {demo.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-emerald-200/80">
          <p>© 2026 Portal Akuntabilitas Kinerja Berjenjang Terbuka. Dioptimalkan sesuai KMA Nomor 1807 Tahun 2025.</p>
        </footer>
      </main>
    </div>
  )
}

export default LoginPage
