import { supabase } from './supabase'

// Mirror file ke Google Drive via Edge Function `upload-to-drive`.
// Non-blocking: kalau function belum di-deploy / secrets belum diset,
// kembalikan null agar upload Supabase Storage tetap sukses.
export async function mirrorToDrive(file, tahun) {
  try {
    const form = new FormData()
    form.append('file', file, file.name)
    if (tahun) form.append('tahun', String(tahun))

    const { data, error } = await supabase.functions.invoke('upload-to-drive', { body: form })
    if (error) {
      console.warn('[drive] mirror dilewati:', error.message)
      return null
    }
    if (!data || data.error || !data.id) {
      if (data?.error) console.warn('[drive] mirror dilewati:', data.error)
      return null
    }
    return { id: data.id, link: data.webViewLink || data.webContentLink || null }
  } catch (err) {
    console.warn('[drive] mirror dilewati:', err?.message || err)
    return null
  }
}

export async function deleteFromDrive(fileId) {
  if (!fileId) return
  try {
    const { error } = await supabase.functions.invoke(`upload-to-drive?fileId=${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    })
    if (error) console.warn('[drive] hapus dilewati:', error.message)
  } catch (err) {
    console.warn('[drive] hapus dilewati:', err?.message || err)
  }
}
