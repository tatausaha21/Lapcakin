import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Peran sesuai mockup portal; allowed = nilai `peran` di master_users.
const portalRoles = [
  { label: '------------', allowed: ['Operator Unit', 'Viewer / Auditor'] },
  { label: 'Kepala Seksi / Unit Kerja', allowed: ['Kepala Satker'] },
  { label: 'Admin Organisasi', allowed: ['Admin Organisasi'] },
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

function LoginModal({ mode = 'otentikasi', onClose, onLogin }) {
  const defaultRole = mode === 'laporan' ? portalRoles[0].label : portalRoles[0].label
  const [portalRole, setPortalRole] = useState(defaultRole)
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')

  const title = mode === 'laporan' ? 'Akses: Laporan Pegawai' : 'Masuk ke Portal Kinerja'

  // Ambil daftar username aktif yang dibuat admin di Master User.
  useEffect(() => {
    let cancelled = false
    const fetchUsers = async () => {
      setLoadingUsers(true)
      try {
        if (!isSupabaseConfigured) return
        const { data, error: queryError } = await supabase
          .from('master_users')
          .select('username, nama_lengkap, peran, status')
          .eq('status', 'Aktif')
          .order('username', { ascending: true })
        if (queryError) throw queryError
        if (!cancelled) setUsers(data ?? [])
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [])

  // Tutup dengan Escape + kunci scroll body.
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const allowed = portalRoles.find((r) => r.label === portalRole)?.allowed ?? []
  const filteredUsers = users.filter((u) => allowed.includes(u.peran))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!username) {
      setError('Pilih username terlebih dahulu.')
      return
    }
    if (!password) {
      setError('Kata sandi wajib diisi.')
      return
    }
    if (!isSupabaseConfigured) {
      setError('Konfigurasi Supabase belum ditemukan.')
      return
    }
    setLoading(true)
    try {
      // 1) Username -> email Auth (mendukung NIP/username/email).
      const { data: email, error: rpcError } = await supabase.rpc('resolve_login_email', { p_identifier: username })
      if (rpcError) throw rpcError
      if (!email) {
        setError('Akun tidak ditemukan atau berstatus tidak aktif.')
        return
      }
      // 2) Verifikasi password via Supabase Auth.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes('invalid login credentials')
            ? 'Kata sandi salah. Silakan coba lagi.'
            : `Gagal masuk: ${signInError.message}`,
        )
        return
      }
      // 3) Profil + validasi peran.
      const { data: profile, error: profileError } = await supabase
        .from('master_users')
        .select('*')
        .eq('auth_user_id', signInData.user.id)
        .maybeSingle()
      if (profileError) throw profileError
      if (!profile) {
        await supabase.auth.signOut()
        setError('Profil pegawai belum terdaftar di Master User. Hubungi Admin Organisasi.')
        return
      }
      if (!allowed.includes(profile.peran)) {
        await supabase.auth.signOut()
        setError(`Akun ini terdaftar sebagai "${profile.peran}". Pilih peran yang sesuai.`)
        return
      }
      supabase.rpc('record_login', { p_auth_user_id: signInData.user.id }).then(() => {})
      onLogin(toProfile(profile))
    } catch (err) {
      setError(`Gagal masuk: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#004D40] p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal login"
            className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-700/60 text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-2 border border-emerald-500/30">
            Akses Terbatas
          </span>
          <h3 className="text-xl font-bold">{title}</h3>
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

          <div>
            <label htmlFor="modal-peran" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Peran / Role Pengguna
            </label>
            <select
              id="modal-peran"
              value={portalRole}
              onChange={(e) => {
                setPortalRole(e.target.value)
                setUsername('')
                setError('')
              }}
              className="w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5"
            >
              {portalRoles.map((role) => (
                <option key={role.label} value={role.label}>{role.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="modal-username" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username Pegawai
            </label>
            <select
              id="modal-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loadingUsers}
              className="w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5 disabled:opacity-60"
            >
              <option value="">{loadingUsers ? 'Memuat daftar username…' : '-- Pilih username --'}</option>
              {filteredUsers.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.username} — {u.nama_lengkap}
                </option>
              ))}
            </select>
            {!loadingUsers && filteredUsers.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">Belum ada username aktif untuk peran ini. Tambahkan lewat Master User.</p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="modal-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kata Sandi
              </label>
              <button type="button" className="text-xs text-emerald-700 hover:underline">
                Lupa sandi?
              </button>
            </div>
            <div className="relative">
              <input
                id="modal-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm rounded-xl border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 bg-slate-50 py-2.5 pr-11"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-[#004D40] hover:bg-[#00382E] text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-all active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? 'Memverifikasi otentikasi…' : 'Masuk ke Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
