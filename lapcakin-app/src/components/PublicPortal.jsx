import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import LoginModal from './LoginModal'

// ---------- Data galeri (dokumentasi lapangan) ----------
const galleryItems = [
  {
    unit: 'Subbag TU',
    badgeClass: 'bg-emerald-700',
    date: '20 Jan 2026',
    title: 'Rapat Koordinasi Evaluasi & Sinkronisasi Perjanjian Kinerja 2026',
    desc: 'Penetapan target IKSK berbasis KMA 1807 bersama seluruh kepala seksi dan pejabat perencana.',
    status: 'Dokumen Terverifikasi',
    location: 'Aula Utama',
    img: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=700&q=80',
  },
  {
    unit: 'Seksi Madrasah',
    badgeClass: 'bg-blue-700',
    date: '18 Jan 2026',
    title: 'Bimtek Akreditasi & Digitalisasi Rapor Madrasah Berkelanjutan',
    desc: 'Monitoring capaian mutu guru dan realisasi anggaran BOS madrasah swasta triwulan berjalan.',
    status: 'Capaian 100%',
    location: 'MAN 1 Model',
    img: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=700&q=80',
  },
  {
    unit: 'Bimas Islam',
    badgeClass: 'bg-emerald-800',
    date: '15 Jan 2026',
    title: 'Inspeksi Lapangan Revitalisasi KUA Ramah Inklusi & Simkah',
    desc: 'Peninjauan kepatuhan SOP pencatatan pernikahan dan standarisasi fasilitas bimbingan calon pengantin.',
    status: '94.8% Akurasi',
    location: 'KUA Kec. Kota',
    img: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=700&q=80',
  },
  {
    unit: 'Seksi PHU',
    badgeClass: 'bg-amber-600',
    date: '12 Jan 2026',
    title: 'Verifikasi Pelunasan Bipih & Dokumen Paspor Jamaah Reguler',
    desc: 'Pemeriksaan bio-visa terpadu bersama instansi keimigrasian demi kelancaran pemberangkatan musim 1447H.',
    status: 'On Schedule',
    location: 'PLHUT Terpadu',
    img: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=700&q=80',
  },
]

// ---------- Data simulasi capaian per triwulan (capped 120%) ----------
// Dipakai hingga tabel realisasi tersedia; ditandai "Data Simulasi".
const triwulanData = {
  TW1: [
    { unit: 'Penmad', full: 'Seksi Pendidikan Madrasah', capaian: 102.5, color: '#059669' },
    { unit: 'Bimas', full: 'Seksi Bimas Islam', capaian: 94.8, color: '#2563EB' },
    { unit: 'PHU', full: 'Seksi PHU', capaian: 88.15, color: '#D97706' },
    { unit: 'Subbag TU', full: 'Subbagian Tata Usaha', capaian: 96.4, color: '#10B981' },
    { unit: 'Pakis', full: 'Seksi Pakis', capaian: 91.2, color: '#0D9488' },
  ],
  TW2: [
    { unit: 'Penmad', full: 'Seksi Pendidikan Madrasah', capaian: 105.2, color: '#059669' },
    { unit: 'Bimas', full: 'Seksi Bimas Islam', capaian: 97.1, color: '#2563EB' },
    { unit: 'PHU', full: 'Seksi PHU', capaian: 92.4, color: '#D97706' },
    { unit: 'Subbag TU', full: 'Subbagian Tata Usaha', capaian: 98.0, color: '#10B981' },
    { unit: 'Pakis', full: 'Seksi Pakis', capaian: 93.5, color: '#0D9488' },
  ],
  TW3: [
    { unit: 'Penmad', full: 'Seksi Pendidikan Madrasah', capaian: 98.7, color: '#059669' },
    { unit: 'Bimas', full: 'Seksi Bimas Islam', capaian: 90.3, color: '#2563EB' },
    { unit: 'PHU', full: 'Seksi PHU', capaian: 95.6, color: '#D97706' },
    { unit: 'Subbag TU', full: 'Subbagian Tata Usaha', capaian: 99.2, color: '#10B981' },
    { unit: 'Pakis', full: 'Seksi Pakis', capaian: 89.8, color: '#0D9488' },
  ],
  TW4: [
    { unit: 'Penmad', full: 'Seksi Pendidikan Madrasah', capaian: 110.4, color: '#059669' },
    { unit: 'Bimas', full: 'Seksi Bimas Islam', capaian: 101.3, color: '#2563EB' },
    { unit: 'PHU', full: 'Seksi PHU', capaian: 97.9, color: '#D97706' },
    { unit: 'Subbag TU', full: 'Subbagian Tata Usaha', capaian: 103.6, color: '#10B981' },
    { unit: 'Pakis', full: 'Seksi Pakis', capaian: 99.1, color: '#0D9488' },
  ],
}

const triwulanOptions = [
  { id: 'TW1', label: 'TW I' },
  { id: 'TW2', label: 'TW II' },
  { id: 'TW3', label: 'TW III' },
  { id: 'TW4', label: 'TW IV' },
]

function predikat(capaian) {
  if (capaian >= 100) return { label: 'Sangat Baik', cls: 'bg-emerald-100 text-emerald-800' }
  if (capaian >= 85) return { label: 'Baik', cls: 'bg-blue-100 text-blue-800' }
  if (capaian >= 70) return { label: 'Cukup', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'Kurang', cls: 'bg-rose-100 text-rose-700' }
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-800">{row.full}</p>
      <p className="font-semibold text-emerald-700">Capaian: {row.capaian.toLocaleString('id-ID')}%</p>
      <p className="text-slate-400">Periode {label}</p>
    </div>
  )
}

function PublicPortal({ onLogin }) {
  const [loginMode, setLoginMode] = useState(null)
  const [triwulan, setTriwulan] = useState('TW1')
  const [rankTab, setRankTab] = useState('unit')
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef(null)

  // Ringkasan real dari Supabase (graceful fallback bila tabel belum ada).
  const [counts, setCounts] = useState({ iksk: 0, unit: 0, pegawai: 0 })
  const [ikskRows, setIkskRows] = useState([])
  const [pegawaiRows, setPegawaiRows] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [iksk, unit, pegawai] = await Promise.all([
          supabase.from('perkin_iksk').select('id, uraian, target_tahunan, satuan').order('nomor_urut', { ascending: true }).limit(50),
          supabase.from('unit_kerja').select('id', { count: 'exact', head: true }),
          supabase.from('master_users').select('nama_lengkap, username, jabatan, peran, unit_kerja_nama, status').eq('status', 'Aktif').order('nama_lengkap').limit(50),
        ])
        if (cancelled) return
        setIkskRows(iksk.data ?? [])
        setPegawaiRows(pegawai.data ?? [])
        setCounts({
          iksk: (iksk.data ?? []).length,
          unit: typeof unit.count === 'number' ? unit.count : 0,
          pegawai: (pegawai.data ?? []).length,
        })
      } catch {
        // Tabel belum tersedia — biarkan fallback 0 / empty state.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Carousel: geser 1 kartu, loop, autoplay 4 detik ----------
  const stepWidth = useCallback(() => {
    const el = trackRef.current
    if (!el) return 336
    const card = el.querySelector('[data-card]')
    return (card?.offsetWidth ?? 320) + 16
  }, [])

  const goTo = useCallback((index) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: index * stepWidth(), behavior: 'smooth' })
  }, [stepWidth])

  const goNext = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth - 8
    if (el.scrollLeft >= max) goTo(0)
    else el.scrollBy({ left: stepWidth(), behavior: 'smooth' })
  }, [goTo, stepWidth])

  const goPrev = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    if (el.scrollLeft <= 8) goTo(galleryItems.length - 1)
    else el.scrollBy({ left: -stepWidth(), behavior: 'smooth' })
  }, [goTo, stepWidth])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') goNext()
    }, 4000)
    return () => clearInterval(timer)
  }, [paused, goNext])

  const handleTrackScroll = () => {
    const el = trackRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / stepWidth())
    setActiveSlide(Math.max(0, Math.min(galleryItems.length - 1, idx)))
  }

  const chartRows = triwulanData[triwulan]
  const rankedUnits = [...chartRows].sort((a, b) => b.capaian - a.capaian)
  const orgAvg = chartRows.reduce((sum, r) => sum + r.capaian, 0) / chartRows.length
  const orgPredikat = predikat(orgAvg)

  const rankTabs = [
    { id: 'unit', label: 'Peringkat Unit Kerja' },
    { id: 'iksk', label: 'Peringkat IKSK' },
    { id: 'pelaksana', label: 'Peringkat Pelaksana Kinerja' },
  ]

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
      {/* ===== TopNavigationBar ===== */}
      <header className="w-full px-4 sm:px-8 lg:px-12 pt-6 pb-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white shadow-inner">
              <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-emerald-200 uppercase block">Portal Kinerja Terbuka</span>
              <span className="text-sm font-bold text-white tracking-wide">Sistem Pengukuran Kinerja Kemenag 2026</span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setLoginMode('laporan')}
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
              onClick={() => setLoginMode('otentikasi')}
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
        {/* ===== Hero ===== */}
        <section className="mb-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#014438]/80 border border-emerald-500/30 text-emerald-100 text-xs font-medium backdrop-blur shadow-sm mb-3">
            <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
            <span>Rekapitulasi Capaian Kinerja Terbuka — Tahun 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-white tracking-tight leading-tight">
            Transparansi &amp; Akuntabilitas Kinerja Berjenjang
          </h1>
          <p className="mt-2 text-emerald-100/90 text-sm sm:text-base max-w-3xl leading-relaxed font-normal">
            Perhitungan kinerja pegawai terakumulasi otomatis ke tingkat Seksi/Satker hingga Capaian Kinerja Organisasi, sesuai KMA Nomor 1807 Tahun 2025.
          </p>
        </section>

        {/* ===== 1. Galeri Potret Pelaksanaan Kinerja (auto carousel) ===== */}
        <section className="mb-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 shadow-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Dokumentasi Lapangan
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Galeri Potret Pelaksanaan Kinerja Lapang
              </h2>
              <p className="text-xs text-emerald-100/80 font-normal mt-0.5">Potret realisasi program kerja, pembinaan, dan akuntabilitas pelayanan publik tahun 2026</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <div className="flex gap-1 mr-2">
                {galleryItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ke slide ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={`h-1.5 rounded-full transition-all ${i === activeSlide ? 'w-5 bg-emerald-300' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Slide sebelumnya"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Slide berikutnya"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          <div
            ref={trackRef}
            onScroll={handleTrackScroll}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin', scrollBehavior: 'smooth' }}
          >
            {galleryItems.map((item) => (
              <article
                key={item.title}
                data-card
                className="min-w-[280px] sm:min-w-[320px] max-w-[340px] flex-shrink-0 bg-white rounded-xl overflow-hidden shadow-lg border border-slate-100/20 group snap-start flex flex-col"
              >
                <div className="relative h-44 overflow-hidden bg-emerald-950">
                  <img src={item.img} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-white text-[10px] font-bold uppercase tracking-wide shadow-sm ${item.badgeClass}`}>
                    {item.unit}
                  </span>
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-emerald-100 text-[10px] font-medium">
                    {item.date}
                  </span>
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between bg-white text-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-emerald-700 transition">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {item.status}
                    </span>
                    <span className="text-slate-400 font-normal">{item.location}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ===== 2. Stat cards & metric summary ===== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase leading-snug">Persentase Capaian Organisasi</span>
            </div>
            <div className="mt-4 text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              {orgAvg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Predikat:</span>
              <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md border ${orgPredikat.cls} border-transparent`}>
                {orgPredikat.label}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-5 overflow-hidden">
              <div className="bg-emerald-600 h-full" style={{ width: `${Math.min(100, orgAvg)}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" /><circle cx="12" cy="12" r="5" strokeWidth="2" /><circle cx="12" cy="12" r="1.5" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase leading-snug">Persentase Capaian Realisasi Target</span>
            </div>
            <div className="mt-4 text-3xl lg:text-4xl font-extrabold text-blue-600 tracking-tight">95,00%</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
              <span>Benchmark Target:</span>
              <span className="font-bold text-slate-900">100.00%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-5 overflow-hidden">
              <div className="bg-blue-600 h-full w-[95%] rounded-full shadow-sm" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm font-black text-lg">$</div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase leading-snug">Persentase Realisasi Anggaran</span>
            </div>
            <div className="mt-4 text-3xl lg:text-4xl font-extrabold text-amber-500 tracking-tight">0,00%</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Rp 0.0jt <span className="text-slate-400">/ 0.0jt DIPA</span></div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-5 overflow-hidden">
              <div className="bg-amber-400 h-full w-0" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase leading-snug">Persentase Laporan Tepat Waktu</span>
            </div>
            <div className="mt-4 text-3xl lg:text-4xl font-extrabold text-orange-600 tracking-tight">100,00%</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" />
              </svg>
              <span>Sesuai Jadwal</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-5 overflow-hidden">
              <div className="bg-orange-600 h-full w-full rounded-full" />
            </div>
          </div>
        </section>

        {/* Mini metrics (data real) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Indikator', value: counts.iksk },
            { label: 'Seksi/Satker', value: counts.unit },
            { label: 'Pegawai', value: counts.pegawai },
            { label: 'Lap. Disetujui', value: 0 },
          ].map((m) => (
            <div key={m.label} className="bg-emerald-900/35 border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur-sm shadow-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-200/90">{m.label}</div>
                <div className="text-lg font-bold text-white leading-none mt-0.5">{m.value}</div>
              </div>
            </div>
          ))}
        </section>

        {/* ===== 3. Grafik capaian kinerja per unit kerja (recharts) ===== */}
        <section className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                Grafik Capaian Kinerja Per Unit Kerja
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">Pemantauan distribusi progres komparatif unit kerja periode berjalan</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {triwulanOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTriwulan(opt.id)}
                    className={`text-xs px-3 py-1.5 font-bold transition-colors ${triwulan === opt.id ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 tracking-wide uppercase">
                Data Simulasi
              </span>
            </div>
          </div>

          <div className="pt-4" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 16, right: 16, bottom: 8, left: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="unit" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                <YAxis
                  domain={[0, 120]}
                  ticks={[0, 20, 40, 60, 80, 100, 120]}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <ReferenceLine y={100} stroke="#059669" strokeDasharray="8 4" strokeWidth={2} label={{ value: 'Standar 100%', position: 'insideTopRight', fontSize: 11, fontWeight: 700, fill: '#047857' }} />
                <Bar dataKey="capaian" name="Capaian" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {chartRows.map((row) => (
                    <Cell key={row.unit} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-2">
            <p className="text-[11px] text-slate-400 font-medium">
              Garis putus-putus menandai ambang 100% (Standar Capping System 0%–120%)
            </p>
          </div>
        </section>

        {/* ===== 4. Peringkat capaian kinerja ===== */}
        <section className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70">
            <div className="flex flex-wrap sm:flex-nowrap">
              {rankTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRankTab(tab.id)}
                  className={`flex-1 py-3.5 px-6 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-150 border-b-2 ${
                    rankTab === tab.id
                      ? 'bg-emerald-50/80 text-emerald-800 border-emerald-700'
                      : 'text-slate-400 hover:text-slate-600 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {rankTab === 'unit' && (
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Nama Unit Kerja</th>
                    <th className="py-3 px-4 text-center">Capaian ({triwulan.replace('TW', 'TW ')})</th>
                    <th className="py-3 px-4 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {rankedUnits.map((row, i) => {
                    const p = predikat(row.capaian)
                    return (
                      <tr key={row.unit} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-xs ${i === 0 ? 'bg-amber-100 text-amber-800' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-amber-700/20 text-amber-900' : 'bg-slate-100 text-slate-500'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.full}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-700">{row.capaian.toLocaleString('id-ID')}%</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${p.cls}`}>{p.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-slate-400">Peringkat mengikuti triwulan aktif pada grafik di atas · Data simulasi.</p>
            </div>
          )}

          {rankTab === 'iksk' && (
            <div className="p-6">
              {ikskRows.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-slate-500">Belum ada data Indikator Kinerja Sasaran Kegiatan (IKSK).</p>
                  <p className="text-xs text-slate-400 mt-1">Data IKSK disinkronisasi melalui Renstra dan Perjanjian Kinerja tahun berjalan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4 w-16 text-center">No</th>
                        <th className="py-3 px-4">Indikator Kinerja Sasaran Kegiatan</th>
                        <th className="py-3 px-4 text-center">Target</th>
                        <th className="py-3 px-4 text-center">Satuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {ikskRows.map((row, i) => (
                        <tr key={row.id ?? i} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 text-center">{i + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{row.uraian}</td>
                          <td className="py-3.5 px-4 text-center">{row.target_tahunan}</td>
                          <td className="py-3.5 px-4 text-center">{row.satuan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {rankTab === 'pelaksana' && (
            <div className="p-6">
              {pegawaiRows.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-slate-500">Belum ada rekapitulasi capaian individu pegawai.</p>
                  <p className="text-xs text-slate-400 mt-1">Hasil evaluasi SKP triwulan I tahun 2026 akan diumumkan serentak.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4 w-16 text-center">No</th>
                        <th className="py-3 px-4">Nama Pelaksana</th>
                        <th className="py-3 px-4">Unit Kerja</th>
                        <th className="py-3 px-4 text-center">Peran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {pegawaiRows.map((row, i) => (
                        <tr key={row.username ?? i} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 text-center">{i + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{row.nama_lengkap}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{row.jabatan}</div>
                          </td>
                          <td className="py-3.5 px-4">{row.unit_kerja_nama}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">{row.peran}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-emerald-200/80">
          <p>© 2026 Portal Akuntabilitas Kinerja Berjenjang Terbuka. Dioptimalkan sesuai KMA Nomor 1807 Tahun 2025.</p>
        </footer>
      </main>

      {/* ===== 5. Modal login interaktif (overlay) ===== */}
      {loginMode && (
        <LoginModal mode={loginMode} onClose={() => setLoginMode(null)} onLogin={onLogin} />
      )}
    </div>
  )
}

export default PublicPortal
