// Agregasi level organisasi — dipakai bersama oleh:
// - src/components/LaporanKinerjaOrganisasi.jsx (tabel + footer + export)
// - src/components/PublicPortal.jsx (statistic cards)
// Rumus disamakan dengan Laporan Kinerja Seksi.

export function parseNum(str) {
  if (str === null || str === undefined) return NaN
  const m = String(str).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

// % realisasi target per rencana (sama persis dengan laporan seksi):
// Persen -> (total / target) * 100 capping 0..120;
// selain itu -> target - total.
export function calcRealisasiPersen(total, target, satuan) {
  if (Number.isNaN(total)) return null
  if (satuan === 'Persen') {
    const t = parseNum(target)
    if (Number.isNaN(t) || t === 0) return null
    return Math.min(120, Math.max(0, (total / t) * 100))
  }
  const t = parseNum(target)
  if (Number.isNaN(t)) return null
  return t - total
}

// % capaian kinerja dari polaritas IKSK (capping 0..120) — sama dengan seksi:
// Positive -> (%realisasi / target tahunan) * 100
// Negative -> (2 * (target tahunan / %realisasi)) * 100
export function calcCapaian(persenRealisasi, targetTahunan, polaritas) {
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

// Pengisian TERAKHIR sebuah rencana = entri dengan waktu input (created_at)
// terbaru. Nilai realisasi_kinerja tersimpan sudah akumulasi, sehingga %
// selalu dihitung dari 1 nilai terakhir ini — JANGAN menjumlah seluruh entri
// (menjumlah ulang menyebabkan double-count). Sama dengan 1 baris per rencana
// di tabel riwayat Input Realisasi Kinerja.
export function latestRealisasiOf(entries) {
  if (!entries || entries.length === 0) return null
  return [...entries].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null
}

export function triwulanOf(dateStr) {
  if (!dateStr) return null
  const m = new Date(`${dateStr}T00:00:00`).getMonth() + 1
  if (m >= 1 && m <= 3) return 'TW I'
  if (m >= 4 && m <= 6) return 'TW II'
  if (m >= 7 && m <= 9) return 'TW III'
  if (m >= 10 && m <= 12) return 'TW IV'
  return null
}

export const TW_OPTIONS = ['TW I', 'TW II', 'TW III', 'TW IV']

export function twIndex(tw) {
  const norm = normalizeTw(tw) ?? tw
  const i = TW_OPTIONS.indexOf(norm)
  return i >= 0 ? i + 1 : 0
}

// Cek apakah tanggal kegiatan masuk dalam filter triwulan.
// Bila kumulatif=true, triwulan sebelumnya ikut terhitung
// (mis. filter TW II mencakup realisasi TW I + TW II).
export function isTwMasuk(tanggalKegiatan, filterTriwulan, kumulatif = false) {
  if (!filterTriwulan || filterTriwulan === 'Semua') return true
  const twEntry = triwulanOf(tanggalKegiatan)
  if (!twEntry) return false
  if (!kumulatif) return twEntry === filterTriwulan
  return twIndex(twEntry) <= twIndex(filterTriwulan)
}

// Target triwulan untuk % capaian kinerja organisasi:
// TW I = 25%, TW II = 50%, TW III = 75%, TW IV = 100%.
export const TW_TARGET_PERSEN = {
  'TW I': 25,
  'TW II': 50,
  'TW III': 75,
  'TW IV': 100,
}

// Normalisasi label triwulan ('TW1', 'TW I', 'tw ii', ...) -> 'TW I' | ... | null
export function normalizeTw(label) {
  if (!label || label === 'Semua') return null
  const s = String(label).toUpperCase().replace(/\s+/g, ' ').trim()
  const m = s.match(/TW\s*([IV1234]+)/)
  if (!m) return null
  const v = m[1]
  if (v === '1' || v === 'I') return 'TW I'
  if (v === '2' || v === 'II') return 'TW II'
  if (v === '3' || v === 'III') return 'TW III'
  if (v === '4' || v === 'IV') return 'TW IV'
  return null
}

export function targetTriwulanOf(filterTriwulan) {
  if (!filterTriwulan || filterTriwulan === 'Semua') return 100
  const norm = normalizeTw(filterTriwulan) ?? filterTriwulan
  return TW_TARGET_PERSEN[norm] ?? 100
}

export function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return `Rp ${num.toLocaleString('id-ID')}`
}

/**
 * Agregasi per IKSK level organisasi.
 *
 * @param {object} args
 * @param {Array} args.skList
 * @param {Array} args.ikskList
 * @param {Array} args.unitList
 * @param {Array} args.cascadingRows
 * @param {Array} args.rencanaRows
 * @param {Array} args.realisasiRows
 * @param {string} args.filterTahun 'Semua' | '2026'
 * @param {string} args.filterTriwulan 'Semua' | 'TW I' | ...
 * @returns {{ rows: Array, footer: object }}
 *
 * Setiap row:
 * { iksk, sk, seksiNames[], rencanaCount, persenOrg (rata-rata % realisasi),
 *   anggaran, realisasiAnggaran, capaian, kendalaList[], bukti[], entriesCount }
 */
export function computeOrganisasi({
  skList = [],
  ikskList = [],
  unitList = [],
  cascadingRows = [],
  rencanaRows = [],
  realisasiRows = [],
  filterTahun = 'Semua',
  filterTriwulan = 'Semua',
  kumulatif = false,
}) {
  const skById = Object.fromEntries(skList.map((s) => [s.id, s]))
  const ikskById = Object.fromEntries(ikskList.map((i) => [i.id, i]))
  const cascadingById = Object.fromEntries(cascadingRows.map((c) => [c.id, c]))
  const unitById = Object.fromEntries(unitList.map((u) => [u.id, u]))

  const inTahunRencana = (t) => filterTahun === 'Semua' || String(t) === String(filterTahun)
  const inTahunRealisasi = (t) => filterTahun === 'Semua' || String(t) === String(filterTahun)
  const inTw = (tgl) => isTwMasuk(tgl, filterTriwulan, kumulatif)

  // Hitung % realisasi per rencana dulu (rumus seksi), lalu kelompokkan per IKSK.
  const perRencana = rencanaRows
    .filter((r) => inTahunRencana(r.tahun_anggaran))
    .map((r) => {
      const cascading = cascadingById[r.cascading_id] || null
      if (!cascading) return null
      const iksk = ikskById[cascading.iksk_id] || null
      if (!iksk) return null
      const unit = unitById[cascading.unit_kerja_id] || null
      const entries = realisasiRows.filter((e) => {
        if (e.rencana_aksi_id !== r.id) return false
        if (!inTahunRealisasi(e.tahun_anggaran)) return false
        if (!inTw(e.tanggal_kegiatan)) return false
        return true
      })
      const latest = latestRealisasiOf(entries)
      const total = latest ? parseNum(latest.realisasi_kinerja) : NaN
      const persen = calcRealisasiPersen(total, r.target_kinerja, r.satuan)
      const angNums = entries
        .map((e) => (e.realisasi_anggaran === null || e.realisasi_anggaran === undefined ? NaN : Number(e.realisasi_anggaran)))
        .filter((n) => !Number.isNaN(n))
      const totalAnggaran = angNums.length > 0 ? angNums.reduce((a, b) => a + b, 0) : 0
      const kendalaList = entries
        .filter((e) => e.catatan_kendala && String(e.catatan_kendala).trim() !== '')
        .map((e) => ({
          id: e.id,
          teks: String(e.catatan_kendala).trim(),
          tanggal: e.tanggal_kegiatan,
          seksi: unit?.nama_unit ?? '-',
          realisasi: e.realisasi_kinerja,
        }))
      const bukti = entries.filter((e) => e.bukti_path)
      return {
        rencana: r,
        cascading,
        iksk,
        sk: skById[iksk.sk_id] || null,
        unit,
        entries,
        persen,
        totalAnggaran,
        kendalaList,
        bukti,
      }
    })
    .filter(Boolean)

  const groups = new Map()
  for (const pr of perRencana) {
    const id = pr.iksk.id
    if (!groups.has(id)) {
      groups.set(id, {
        iksk: pr.iksk,
        sk: pr.sk,
        items: [],
      })
    }
    groups.get(id).items.push(pr)
  }

  const rows = [...groups.values()]
    .map((g) => {
      const { iksk, sk, items } = g
      // % Realisasi Target organisasi = rata-rata % realisasi seluruh seksi
      // pada IKSK yang sama. Rencana yang null dihitung 0%.
      const persenOrg = items.length > 0
        ? items.reduce((s, it) => s + (it.persen ?? 0), 0) / items.length
        : null
      const capaian = calcCapaian(persenOrg, iksk?.target_tahunan, iksk?.polaritas ?? 'Positive')
      const anggaran = items.reduce((s, it) => s + (it.rencana.anggaran === null || it.rencana.anggaran === undefined ? 0 : Number(it.rencana.anggaran) || 0), 0)
      const realisasiAnggaran = items.reduce((s, it) => s + (it.totalAnggaran ?? 0), 0)
      const kendalaList = items.flatMap((it) => it.kendalaList)
      const bukti = items.flatMap((it) => it.bukti)
      const seksiNames = [...new Set(items.map((it) => it.unit?.nama_unit ?? '-'))]
      const entriesCount = items.reduce((s, it) => s + it.entries.length, 0)
      return {
        iksk, sk, items,
        seksiNames,
        rencanaCount: items.length,
        entriesCount,
        persenOrg,
        anggaran,
        realisasiAnggaran,
        capaian,
        kendalaList,
        bukti,
      }
    })
    .sort((a, b) => {
      const skA = a.sk?.nomor ?? 999
      const skB = b.sk?.nomor ?? 999
      if (skA !== skB) return skA - skB
      return (a.iksk?.nomor_urut ?? 999) - (b.iksk?.nomor_urut ?? 999)
    })

  const capaians = rows.map((r) => r.capaian ?? 0)
  const rataCapaian = rows.length > 0 ? capaians.reduce((a, b) => a + b, 0) / rows.length : null
  const avgRealisasiTarget = rows.length > 0 ? rows.reduce((s, r) => s + (r.persenOrg ?? 0), 0) / rows.length : null
  // Target hitung = target 1 tahun (100%). Target per triwulan (25/50/75/100)
  // hanya dipakai sebagai teks info tampilan, tidak dalam perhitungan.
  const targetTriwulan = 100
  const targetTriwulanInfo = targetTriwulanOf(filterTriwulan)
  // % capaian kinerja organisasi = rata-rata capaian terhadap target tahunan.
  const persenCapaianOrg = rataCapaian
  const jumlahAnggaran = rows.reduce((s, r) => s + (r.anggaran ?? 0), 0)
  const jumlahRealisasi = rows.reduce((s, r) => s + (r.realisasiAnggaran ?? 0), 0)
  const persenRealisasiAnggaran = jumlahAnggaran > 0 ? (jumlahRealisasi / jumlahAnggaran) * 100 : null
  const seksiSet = new Set(perRencana.map((p) => p.cascading?.unit_kerja_id).filter(Boolean))

  const footer = {
    rataCapaian,
    targetTriwulan,
    targetTriwulanInfo,
    persenCapaianOrg,
    jumlahAnggaran,
    jumlahRealisasi,
    persenRealisasiAnggaran,
    avgRealisasiTarget,
    ikskCount: rows.length,
    rencanaCount: perRencana.length,
    seksiCount: seksiSet.size,
  }

  return { rows, footer }
}

export function shortUnitName(nama) {
  if (!nama) return '-'
  return nama
    .replace(/^Seksi\s+/i, '')
    .replace(/^Subbagian\s+/i, 'Subbag ')
    .replace(/^Sub Bagian\s+/i, 'Subbag ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ')
}

export function ikskNumberOf(iksk, skById) {
  if (!iksk) return '-'
  const sk = skById?.[iksk.sk_id]
  return sk ? `${sk.nomor}.${iksk.nomor_urut}` : `-.${iksk.nomor_urut}`
}

/**
 * Agregasi per seksi / unit kerja — dipakai bersama oleh:
 * - src/components/DashboardAdmin.jsx (grafik + tabel rekap seksi)
 * - src/components/PublicPortal.jsx (grafik capaian per unit kerja)
 *
 * Rumus % realisasi + % capaian per rencana sama persis dengan
 * Laporan Kinerja Seksi; rata-rata capaian = jumlah capaian rencana
 * unit tersebut dibagi jumlah rencana (yang belum ada realisasi /
 * null dihitung 0%), capping 0–120%. Unit tanpa rencana => null.
 *
 * @returns {Array} [{ unit, rencana, terealisasi, rataCapaian,
 *   anggaran, serapan, kendala, bukti }] terurut capaian tertinggi.
 */
export function computePerSeksi({
  unitList = [],
  cascadingRows = [],
  rencanaRows = [],
  realisasiRows = [],
  ikskList = [],
  filterTahun = 'Semua',
  filterTriwulan = 'Semua',
  kumulatif = false,
}) {
  const ikskById = Object.fromEntries(ikskList.map((i) => [i.id, i]))
  const cascadingById = Object.fromEntries(cascadingRows.map((c) => [c.id, c]))

  const inTahun = (t) => filterTahun === 'Semua' || String(t) === String(filterTahun)
  const inTw = (tgl) => isTwMasuk(tgl, filterTriwulan, kumulatif)

  const rencanaOfUnit = new Map()
  for (const r of rencanaRows) {
    if (!inTahun(r.tahun_anggaran)) continue
    const cascading = cascadingById[r.cascading_id] || null
    if (!cascading) continue
    const unitId = cascading.unit_kerja_id
    if (!rencanaOfUnit.has(unitId)) rencanaOfUnit.set(unitId, [])
    rencanaOfUnit.get(unitId).push({ rencana: r, cascading })
  }

  return unitList.map((unit) => {
    const items = (rencanaOfUnit.get(unit.id) ?? []).map(({ rencana, cascading }) => {
      const iksk = ikskById[cascading.iksk_id] || null
      const entries = realisasiRows.filter((e) => {
        if (e.rencana_aksi_id !== rencana.id) return false
        if (!inTahun(e.tahun_anggaran)) return false
        if (!inTw(e.tanggal_kegiatan)) return false
        return true
      })
      const latest = latestRealisasiOf(entries)
      const total = latest ? parseNum(latest.realisasi_kinerja) : NaN
      const persen = calcRealisasiPersen(total, rencana.target_kinerja, rencana.satuan)
      const capaian = calcCapaian(persen, iksk?.target_tahunan, iksk?.polaritas ?? 'Positive')
      const anggaran = rencana.anggaran === null || rencana.anggaran === undefined ? 0 : Number(rencana.anggaran) || 0
      const serapan = entries.reduce((s, e) => s + (e.realisasi_anggaran === null || e.realisasi_anggaran === undefined ? 0 : Number(e.realisasi_anggaran) || 0), 0)
      const kendala = entries.filter((e) => e.catatan_kendala && String(e.catatan_kendala).trim() !== '').length
      const bukti = entries.filter((e) => e.bukti_path).length
      return { rencana, iksk, entries, persen, capaian, anggaran, serapan, kendala, bukti }
    })
    // Rencana yang belum ada realisasi (capaian null) dihitung 0%.
    // Hanya unit tanpa rencana yang rataCapaiannya null.
    return {
      unit,
      rencana: items.length,
      terealisasi: items.filter((it) => it.entries.length > 0).length,
      rataCapaian: items.length > 0
        ? items.reduce((s, it) => s + (it.capaian ?? 0), 0) / items.length
        : null,
      anggaran: items.reduce((s, it) => s + it.anggaran, 0),
      serapan: items.reduce((s, it) => s + it.serapan, 0),
      kendala: items.reduce((s, it) => s + it.kendala, 0),
      bukti: items.reduce((s, it) => s + it.bukti, 0),
    }
  }).sort((a, b) => {
    if (a.rataCapaian === null && b.rataCapaian === null) return a.unit.nama_unit.localeCompare(b.unit.nama_unit, 'id')
    if (a.rataCapaian === null) return 1
    if (b.rataCapaian === null) return -1
    return b.rataCapaian - a.rataCapaian
  })
}
