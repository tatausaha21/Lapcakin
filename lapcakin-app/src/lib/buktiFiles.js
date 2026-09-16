import { supabase } from './supabase'
import { mirrorToDrive, deleteFromDrive } from './driveUpload'

export { deleteFromDrive }

function safeName(name) {
  return String(name ?? 'bukti-dukung').replace(/[^a-zA-Z0-9._-]+/g, '_')
}

// Upload satu berkas ke Storage (+ mirror Drive non-blocking).
// Mengembalikan metadata siap insert ke realisasi_bukti.
export async function uploadSingleBukti(file, tahun) {
  const path = `${tahun}/${Date.now()}_${safeName(file.name)}`
  const { error } = await supabase.storage.from('bukti-dukung').upload(path, file)
  if (error) throw error
  const drive = await mirrorToDrive(file, tahun)
  return {
    bukti_path: path,
    bukti_nama: file.name,
    bukti_tipe: file.type || '-',
    bukti_size: file.size,
    ...(drive?.id ? { bukti_drive_id: drive.id, bukti_drive_link: drive.link } : {}),
  }
}

// Upload N berkas berurutan. Kalau salah satu gagal, yang sudah
// terunggah di batch ini dibersihkan agar tidak yatim.
export async function uploadMultipleBukti(files, tahun) {
  const results = []
  try {
    for (const file of files) {
      results.push(await uploadSingleBukti(file, tahun))
    }
    return results
  } catch (err) {
    await cleanupUploaded(results)
    throw err
  }
}

export async function cleanupUploaded(items) {
  for (const item of items) {
    try {
      if (item?.bukti_path) await supabase.storage.from('bukti-dukung').remove([item.bukti_path])
    } catch { /* abaikan cleanup */ }
    try {
      if (item?.bukti_drive_id) await deleteFromDrive(item.bukti_drive_id)
    } catch { /* abaikan cleanup */ }
  }
}

// Ambil seluruh lampiran untuk daftar id realisasi -> Map(realisasi_id => rows[]).
export async function fetchBuktiMap(realisasiIds) {
  const map = new Map()
  if (!realisasiIds || realisasiIds.length === 0) return map
  const { data, error } = await supabase
    .from('realisasi_bukti')
    .select('*')
    .in('realisasi_id', realisasiIds)
    .order('created_at', { ascending: true })
  if (error) {
    // Tabel belum dimigrasi (404/42P01): kembalikan map kosong agar
    // seluruh halaman tetap jalan dengan kolom legacy bukti_*.
    console.warn('[bukti] tabel realisasi_bukti belum ada:', error.message)
    return map
  }
  for (const row of data ?? []) {
    if (!map.has(row.realisasi_id)) map.set(row.realisasi_id, [])
    map.get(row.realisasi_id).push(row)
  }
  return map
}

// Hapus satu baris lampiran: storage + drive + row db.
export async function deleteBuktiRow(row) {
  if (!row) return
  if (row.bukti_path) {
    try {
      await supabase.storage.from('bukti-dukung').remove([row.bukti_path])
    } catch { /* lanjut */ }
  }
  if (row.bukti_drive_id) {
    try {
      await deleteFromDrive(row.bukti_drive_id)
    } catch { /* lanjut */ }
  }
  const { error } = await supabase.from('realisasi_bukti').delete().eq('id', row.id)
  if (error) throw error
}
