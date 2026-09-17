import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { supabase, isSupabaseConfigured } from '../lib/supabase'

function parseNum(str) {
  if (str === null || str === undefined) return NaN
  const m = String(str).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

function calcRealisasiPersen(total, target, satuan) {
  if (Number.isNaN(total)) return null
  const t = parseNum(target)
  if (Number.isNaN(t)) return null
  if (satuan === 'Persen') {
    if (t === 0) return null
    return Math.min(120, Math.max(0, (total / t) * 100))
  }
  return t - total
}

function calcCapaian(persenRealisasi, targetTahunan, polaritas) {
  if (persenRealisasi === null || persenRealisasi === undefined) return null
  const t = parseNum(targetTahunan)
  if (Number.isNaN(t)) return null
  let v
  if (polaritas === 'Negative') {
    if (persenRealisasi === 0) return null
    v = 2 * (t / persenRealisasi) * 100
  } else {
    if (t === 0) return null
    v = (persenRealisasi / t) * 100
  }
  if (!Number.isFinite(v)) return null
  return Math.min(120, Math.max(0, v))
}

function formatRupiahShort(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  if (Math.abs(num) >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (Math.abs(num) >= 1_000_000) return `Rp ${(num / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (Math.abs(num) >= 1000) return `Rp ${(num / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
  return `Rp ${num.toLocaleString('id-ID')}`
}

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs max-w-[260px]">
      <p className="font-bold text-slate-800">IKSK {row.nomor}</p>
      <p className="text-slate-500">{row.uraian}</p>
      <p className="font-semibold text-emerald-700">
        Capaian: {row.capaian === null ? '-' : `${row.capaian.toFixed(2)}%`}
      </p>
    </div>
  )
}

function DashboardSeksi({ currentUser, onNavigate }) {
  const [skList, setSkList] = useState([])
  const [ikskList, setIkskList] = useState([])
  const [unitList, setUnitList] = useState([])
  const [cascadingRows, setCascadingRows] = useState([])
  const [rencanaRows, setRencanaRows] = useState([])
  const [realisasiRows, setRealisasiRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [filterTahun, setFilterTahun] = useState('')

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFetchError('Konfigurasi Supabase belum ditemukan. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.')
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    const [skRes, ikskRes, unitRes, cascRes, rencanaRes, realRes] = await Promise.all([
      supabase.from('perkin_sk').select('*').order('tahun_anggaran', { ascending: false }).order('nomor', { ascending: true }),
      supabase.from('perkin_iksk').select('*').order('created_at', { ascending: true }),
      supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }),
      supabase.from('cascading_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('rencana_aksi_kinerja').select('*').order('created_at', { ascending: false }),
      supabase.from('realisasi_kinerja').select('*').order('tanggal_kegiatan', { ascending: false }),
    ])
    const firstError = skRes.error || ikskRes.error || unitRes.error || cascRes.error || rencanaRes.error || realRes.error
    if (firstError) {
      if (firstError.code === '42P01') {
        setFetchError('Salah satu tabel belum ada. Jalankan seluruh file SQL di folder supabase/ secara berurutan di SQL Editor, kemudian Muat ulang.')
      } else {
        setFetchError(`Gagal memuat data: ${firstError.message}`)
      }
    } else {
      setSkList(skRes.data ?? [])
      setIkskList(ikskRes.data ?? [])
      setUnitList(unitRes.data ?? [])
      setCascadingRows(cascRes.data ?? [])
      setRencanaRows(rencanaRes.data ?? [])
      setRealisasiRows(realRes.data ?? [])
      const years = [...new Set([
        ...(cascRes.data ?? []).map((c) => String(c.tahun_anggaran)),
        ...(rencanaRes.data ?? []).map((r) => String(r.tahun_anggaran)),
      ])].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
      setFilterTahun((cur) => cur || years[0] || 'Semua')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const skById = useMemo(() => Object.fromEntries(skList.map((s) => [s.id, s])), [skList])
  const ikskById = useMemo(() => Object.fromEntries(ikskList.map((i) => [i.id, i])), [ikskList])
  const cascadingById = useMemo(() => Object.fromEntries(cascadingRows.map((c) => [c.id, c])), [cascadingRows])
  const rencanaById = useMemo(() => Object.fromEntries(rencanaRows.map((r) => [r.id, r])), [rencanaRows])

  const ikskNumber = useCallback((iksk) => {
    if (!iksk) return '-'
    const sk = skById[iksk.sk_id]
    return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
  }, [skById])

  const userUnit = useMemo(() => {
    const name = (currentUser?.unitKerjaNama ?? '').trim().toLowerCase()
    if (!name || unitList.length === 0) return null
    return (
      unitList.find((u) => (u.nama_unit ?? '').trim().toLowerCase() === name) ??
      unitList.find((u) => (u.nama_unit ?? '').toLowerCase().includes(name) || name.includes((u.nama_unit ?? '').toLowerCase())) ??
      null
    )
  }, [currentUser, unitList])

  const tahunOptions = useMemo(() => {
    const set = new Set([...cascadingRows.map((c) => String(c.tahun_anggaran)), ...rencanaRows.map((r) => String(r.tahun_anggaran))])
    return [...set].filter((t) => t && t !== 'undefined').sort((a, b) => Number(b) - Number(a))
  }, [cascadingRows, rencanaRows])

  const inTahun = useCallback((tahun) => filterTahun === 'Semua' || filterTahun === '' || String(tahun) === String(filterTahun), [filterTahun])
  const inUnit = useCallback((cascading) => !userUnit || cascading?.unit_kerja_id === userUnit.id, [userUnit])

  // Cascading IKSK milik seksi + tahun aktif.
  const myCascading = useMemo(
    () => cascadingRows.filter((c) => inUnit(c) && inTahun(c.tahun_anggaran)),
    [cascadingRows, inUnit, inTahun],
  )

  // Rencana milik seksi + tahun aktif.
  const myRencana = useMemo(() => rencanaRows
    .filter((r) => inTahun(r.tahun_anggaran))
    .map((r) => ({ ...r, cascading: cascadingById[r.cascading_id] || null }))
    .filter((r) => inUnit(r.cascading)),
  [rencanaRows, cascadingById, inTahun, inUnit])

  const myRealisasi = useMemo(() => {
    const rencanaIds = new Set(myRencana.map((r) => r.id))
    return realisasiRows.filter((e) => rencanaIds.has(e.rencana_aksi_id) && inTahun(e.tahun_anggaran))
  }, [realisasiRows, myRencana, inTahun])

  // Agregat per IKSK untuk grafik + tabel.
  const perIksk = useMemo(() => {
    const map = new Map()
    for (const r of myRencana) {
      const cascading = r.cascading
      const iksk = cascading ? ikskById[cascading.iksk_id] || null : null
      if (!iksk) continue
      if (!map.has(iksk.id)) {
        const sk = skById[iksk.sk_id] || null
        map.set(iksk.id, { iksk, sk, rencana: [], entries: [] })
      }
      map.get(iksk.id).rencana.push(r)
    }
    for (const e of myRealisasi) {
      const rencana = rencanaById[e.rencana_aksi_id]
      const cascading = rencana ? cascadingById[rencana.cascading_id] : null
      const ikskId = cascading?.iksk_id
      if (ikskId && map.has(ikskId)) map.get(ikskId).entries.push(e)
    }
    return [...map.values()]
      .map((g) => {
        // Total realisasi vs total target rencana dalam IKSK ini.
        // Tiap rencana diambil 1 nilai pengisian TERAKHIR (nilai sudah
        // akumulasi, sama dengan tabel riwayat) lalu dijumlah antar rencana.
        // Menjumlah seluruh entri mentah menyebabkan double-count.
        const latestByRencana = new Map()
        for (const e of [...g.entries].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))) {
          if (latestByRencana.has(e.rencana_aksi_id)) continue
          const n = parseNum(e.realisasi_kinerja)
          if (Number.isNaN(n)) continue
          latestByRencana.set(e.rencana_aksi_id, n)
        }
        const realNums = [...latestByRencana.values()]
        const targetNums = g.rencana.map((r) => parseNum(r.target_kinerja)).filter((n) => !Number.isNaN(n))
        const totalReal = realNums.length > 0 ? realNums.reduce((a, b) => a + b, 0) : NaN
        const totalTarget = targetNums.length > 0 ? targetNums.reduce((a, b) => a + b, 0) : NaN
        const satuan = g.rencana[0]?.satuan ?? 'Persen'
        let persen = null
        if (!Number.isNaN(totalReal) && !Number.isNaN(totalTarget)) {
          persen = satuan === 'Persen'
            ? (totalTarget === 0 ? null : Math.min(120, Math.max(0, (totalReal / totalTarget) * 100)))
            : totalTarget - totalReal
        }
        const capaian = calcCapaian(satuan === 'Persen' ? persen : null, g.iksk.target_tahunan, g.iksk.polaritas ?? 'Positive')
        const anggaran = g.rencana.reduce((s, r) => s + (r.anggaran === null ? 0 : Number(r.anggaran) || 0), 0)
        const serapan = g.entries.reduce((s, e) => s + (e.realisasi_anggaran === null ? 0 : Number(e.realisasi_anggaran) || 0), 0)
        return { ...g, satuan, persen, capaian, anggaran, serapan }
      })
      .sort((a, b) => {
        const skA = a.sk?.nomor ?? 999
        const skB = b.sk?.nomor ?? 999
        if (skA !== skB) return skA - skB
        return (a.iksk.nomor_urut ?? 999) - (b.iksk.nomor_urut ?? 999)
      })
  }, [myRencana, myRealisasi, ikskById, skById, rencanaById, cascadingById])

  const summary = useMemo(() => {
    const capaians = perIksk.map((g) => g.capaian).filter((c) => c !== null)
    const bukti = myRealisasi.filter((e) => e.bukti_path).length
    return {
      iksk: perIksk.length,
      rencana: myRencana.length,
      realisasi: myRealisasi.length,
      bukti,
      rataCapaian: capaians.length > 0 ? capaians.reduce((a, b) => a + b, 0) / capaians.length : null,
      anggaran: myRencana.reduce((s, r) => s + (r.anggaran === null ? 0 : Number(r.anggaran) || 0), 0),
      serapan: myRealisasi.reduce((s, e) => s + (e.realisasi_anggaran === null ? 0 : Number(e.realisasi_anggaran) || 0), 0),
    }
  }, [perIksk, myRencana, myRealisasi])

  const serapanPersen = summary.anggaran > 0 ? Math.min(100, (summary.serapan / summary.anggaran) * 100) : 0

  const chartData = useMemo(() => perIksk
    .filter((g) => g.capaian !== null)
    .map((g, i) => ({
      nomor: ikskNumber(g.iksk),
      uraian: g.iksk.uraian,
      capaian: Number(g.capaian.toFixed(2)),
      color: ['#059669', '#2563EB', '#D97706', '#0D9488', '#7C3AED'][i % 5],
    })), [perIksk, ikskNumber])

  const latest = useMemo(() => {
    const withRencana = myRealisasi.map((e) => ({ ...e, rencana: rencanaById[e.rencana_aksi_id] || null }))
    return withRencana.slice(0, 5)
  }, [myRealisasi, rencanaById])

  const cards = [
    { label: 'IKSK Dibebankan', value: String(summary.iksk), icon: 'account_tree', sub: `${summary.rencana} rencana aksi` },
    { label: 'Realisasi Tercatat', value: String(summary.realisasi), icon: 'edit_note', sub: `${summary.bukti} dokumen bukti` },
    {
      label: 'Rata-rata Capaian', value: summary.rataCapaian === null ? '-' : `${summary.rataCapaian.toFixed(2)}%`,
      icon: 'analytics', sub: summary.rataCapaian === null ? 'Belum terhitung' : summary.rataCapaian >= 100 ? 'Sangat Baik' : summary.rataCapaian >= 70 ? 'Baik' : 'Perlu perhatian',
    },
    { label: 'Serapan Anggaran', value: formatRupiahShort(summary.serapan), icon: 'payments', sub: `dari ${formatRupiahShort(summary.anggaran)} rencana` },
  ]

  return (
    <div className="flex flex-col gap-space-lg w-full">
      {/* Header konteks */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
              <span className="material-symbols-outlined text-[16px]">school</span>
              {userUnit?.nama_unit ?? currentUser?.unitKerjaNama ?? 'Seksi'}
            </span>
            <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-container-high text-secondary font-label-md text-label-md">
              <span className="material-symbols-outlined text-[16px] text-primary">calendar_clock</span>
              Tahun Anggaran {filterTahun || 'Semua'}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mt-space-2xs">Dashboard Seksi</h1>
          <p className="font-body-md text-body-md text-secondary max-w-3xl">
            Pantau beban IKSK, kemajuan rencana aksi, capaian kinerja, dan serapan anggaran seksi Anda — langsung dari
            data Supabase, bukan angka contoh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs shrink-0">
          <div className="relative">
            <select
              value={filterTahun}
              onChange={(event) => setFilterTahun(event.target.value)}
              aria-label="Filter tahun"
              className="h-[42px] rounded-lg border border-outline-variant bg-surface pl-space-sm pr-10 font-body-sm text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed appearance-none"
            >
              <option value="Semua">Semua Tahun</option>
              {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">calendar_month</span>
          </div>
          {onNavigate && (
            <button
              type="button" onClick={() => onNavigate('input-realisasi-kinerja')}
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-primary-container hover:bg-primary text-on-primary font-title-sm text-title-sm shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              <span>Input Realisasi</span>
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="flex items-start gap-space-sm rounded-xl border border-error bg-error-container/40 p-space-md text-error">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <div className="flex-1">
            <h3 className="font-title-sm text-title-sm font-bold">Terjadi kesalahan</h3>
            <p className="font-body-sm text-body-sm">{fetchError}</p>
          </div>
          <button
            type="button" onClick={fetchAll}
            className="inline-flex items-center gap-space-2xs rounded-lg border border-error/30 px-space-sm py-space-2xs font-body-sm text-body-sm font-bold hover:bg-error-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Muat ulang
          </button>
        </div>
      )}

      {!userUnit && !loading && (
        <div className="flex items-start gap-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-md text-secondary">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <p className="font-body-sm text-body-sm">
            Unit kerja akun Anda tidak cocok dengan Master Unit Kerja, sehingga menampilkan seluruh data.
            Samakan nama unit di Master User agar dashboard terfilter otomatis per seksi.
          </p>
        </div>
      )}

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {cards.map((c) => (
          <div key={c.label} className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-secondary uppercase font-bold">{c.label}</span>
                <span className="font-data-metric text-data-metric text-on-surface mt-space-2xs">
                  {loading ? '…' : c.value}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-secondary mt-space-md">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* Grafik + serapan */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        <div className="xl:col-span-8 p-space-lg rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-space-md">
            <div>
              <h3 className="font-title-sm text-title-sm font-bold text-on-surface">Capaian Kinerja per IKSK</h3>
              <p className="font-body-sm text-body-sm text-secondary">Ambang 100% — capping 0–120%</p>
            </div>
          </div>
          {loading ? (
            <p className="py-space-xl text-center font-body-sm text-body-sm text-secondary">Memuat grafik...</p>
          ) : chartData.length > 0 ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="nomor" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                  <YAxis domain={[0, 120]} ticks={[0, 20, 40, 60, 80, 100, 120]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                  <ReferenceLine y={100} stroke="#059669" strokeDasharray="8 4" strokeWidth={2} label={{ value: 'Standar 100%', position: 'insideTopRight', fontSize: 11, fontWeight: 700, fill: '#047857' }} />
                  <Bar dataKey="capaian" name="Capaian" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {chartData.map((row) => (
                      <Cell key={row.nomor} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-space-xl text-center font-body-sm text-body-sm text-secondary">
              Belum ada capaian terhitung — isi Rencana Aksi dan Realisasi terlebih dahulu.
            </p>
          )}
        </div>

        <div className="xl:col-span-4 flex flex-col gap-space-lg">
          <div className="p-space-lg rounded-xl bg-gradient-to-br from-primary-container via-primary to-surface-tint text-on-primary shadow-md">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed-dim">Serapan Anggaran</span>
            <div className="font-display-lg text-display-lg font-extrabold text-on-primary mt-space-2xs">
              {loading ? '…' : formatRupiahShort(summary.serapan)}
            </div>
            <div className="w-full h-3 rounded-full bg-on-primary/20 overflow-hidden mt-space-md">
              <div className="h-full rounded-full bg-primary-fixed transition-all duration-500" style={{ width: `${serapanPersen}%` }} />
            </div>
            <div className="flex justify-between items-center mt-space-xs text-primary-fixed-dim font-label-sm text-label-sm">
              <span>dari {formatRupiahShort(summary.anggaran)} rencana</span>
              <span className="text-on-primary font-semibold">{serapanPersen.toFixed(1)}%</span>
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm">
            <h3 className="font-title-sm text-title-sm font-bold text-on-surface mb-space-sm">Realisasi Terakhir</h3>
            {latest.length > 0 ? (
              <div className="flex flex-col divide-y divide-surface-container-low">
                {latest.map((e) => (
                  <div key={e.id} className="py-space-xs flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0">task_alt</span>
                    <div className="min-w-0">
                      <div className="font-body-sm text-body-sm font-bold text-on-surface truncate">
                        {e.rencana?.rencana_aksi ?? 'Rencana terhapus'}
                      </div>
                      <div className="font-label-sm text-label-sm text-secondary">
                        {e.realisasi_kinerja} • {formatTanggal(e.tanggal_kegiatan)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-secondary">Belum ada catatan realisasi.</p>
            )}
            {onNavigate && (
              <button
                type="button" onClick={() => onNavigate('laporan-kinerja-seksi')}
                className="mt-space-md inline-flex items-center gap-space-2xs font-body-sm text-body-sm font-bold text-primary hover:underline"
              >
                Lihat laporan lengkap
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabel per IKSK */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="p-space-md pb-0">
          <h3 className="font-title-sm text-title-sm font-bold text-on-surface">Rincian per IKSK</h3>
          <p className="font-body-sm text-body-sm text-secondary">{perIksk.length} IKSK dibebankan ke seksi</p>
        </div>
        <div className="overflow-x-auto mt-space-sm">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/50">
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[90px]">No IKSK</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary">IKSK</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[100px]">Rencana</th>
                <th className="text-center px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[100px]">Realisasi</th>
                <th className="text-left px-space-md py-space-sm font-label-sm text-label-sm text-secondary whitespace-nowrap w-[150px]">% Capaian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">Memuat data...</td>
                </tr>
              ) : perIksk.length > 0 ? perIksk.map((g) => (
                <tr key={g.iksk.id} className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-space-md py-space-sm font-mono font-bold text-primary whitespace-nowrap">{ikskNumber(g.iksk)}</td>
                  <td className="px-space-md py-space-sm max-w-[420px]">
                    <span className="font-body-sm text-body-sm text-on-surface">{g.iksk.uraian}</span>
                    <span className="block font-body-sm text-body-sm text-secondary">Target tahunan: <span className="font-bold">{g.iksk.target_tahunan}</span> ({g.iksk.satuan}, {g.iksk.polaritas})</span>
                  </td>
                  <td className="px-space-md py-space-sm text-center font-body-sm text-body-sm font-bold">{g.rencana.length}</td>
                  <td className="px-space-md py-space-sm text-center font-body-sm text-body-sm font-bold">{g.entries.length}</td>
                  <td className="px-space-md py-space-sm">
                    {g.capaian === null ? (
                      <span className="text-secondary">-</span>
                    ) : (
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <span className="font-bold text-primary">{g.capaian.toFixed(2)}%</span>
                        <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                          <div className="h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, g.capaian)}%` }} />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-space-md py-space-xl text-center font-body-sm text-body-sm text-secondary">
                    Belum ada cascading IKSK untuk seksi ini — hubungi Admin Organisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DashboardSeksi
