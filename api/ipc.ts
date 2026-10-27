import { handleTursoIpc } from '../src/shared/turso-backend'

export default async function handler(req: any, res: any) {
  // Cấu hình CORS để web gọi API không bị chặn
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const { channel, payload } = body

    if (!channel) {
      res.status(400).json({ success: false, error: 'Thiếu channel' })
      return
    }

    const data = await handleTursoIpc(channel, payload)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    console.error('[Vercel API IPC] Lỗi:', err)
    res.status(200).json({ success: false, error: err?.message || String(err) })
  }
}
