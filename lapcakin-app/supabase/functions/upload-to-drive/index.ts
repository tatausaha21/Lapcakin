// Supabase Edge Function: upload-to-drive
// Upload mirror file bukti dukung ke Google Drive pribadi via OAuth refresh_token.
// Secrets (diatur di Dashboard / CLI, BUKAN di frontend):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID (opsional default)
//
// POST  multipart/form-data: file=<blob>, fileName?=<string>, folderId?=<string>, tahun?=<string>
// DELETE ?fileId=xxx  -> hapus file di Drive
//
// Deploy: supabase functions deploy upload-to-drive
// Secrets: supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... GOOGLE_DRIVE_FOLDER_ID=...

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Gagal tukar refresh_token: ${data.error_description || data.error || res.status}`)
  }
  return data.access_token as string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
  const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
  const REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? ''
  const DEFAULT_FOLDER = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID') ?? ''

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return json(
      { error: 'Secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN belum diset di Edge Function.' },
      500,
    )
  }

  try {
    const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

    // ---- DELETE: hapus file Drive ----
    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const fileId = url.searchParams.get('fileId') ?? ''
      if (!fileId) return json({ error: 'Parameter fileId wajib.' }, 400)
      const del = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!del.ok && del.status !== 204) {
        const t = await del.text()
        return json({ error: `Gagal hapus Drive: ${t}` }, 502)
      }
      return json({ ok: true, id: fileId })
    }

    if (req.method !== 'POST') return json({ error: 'Gunakan POST multipart/form-data.' }, 405)

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'Field "file" wajib (multipart).' }, 400)
    if (file.size > 10 * 1024 * 1024) return json({ error: 'Ukuran maksimal 10 MB.' }, 400)

    const tahun = String(form.get('tahun') ?? new Date().getFullYear())
    const customName = String(form.get('fileName') ?? file.name ?? 'bukti-dukung')
    const safe = customName.replace(/[^a-zA-Z0-9._-]+/g, '_')
    const folderId = String(form.get('folderId') ?? DEFAULT_FOLDER ?? '')

    const metadata: Record<string, unknown> = {
      name: `${tahun}_${Date.now()}_${safe}`,
      mimeType: file.type || 'application/octet-stream',
    }
    if (folderId) metadata.parents = [folderId]

    // Multipart upload: metadata JSON + media blob
    const body = new FormData()
    body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    body.append('media', file, safe)

    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    })
    const result = await up.json()
    if (!up.ok) {
      return json({ error: `Drive upload gagal: ${result?.error?.message || up.status}` }, 502)
    }

    return json({
      id: result.id,
      name: result.name,
      mimeType: result.mimeType,
      size: result.size ? Number(result.size) : file.size,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
